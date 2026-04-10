import type { ToolLoopAgent } from 'ai'
import type { OnExportProgress } from './types.js'
import { logger } from '../../utils/logger.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

// --- Shared agent loop helper ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentLoopOptions {
  agent: ToolLoopAgent<never, any, never>
  prompt: string
  abortSignal?: AbortSignal
  onProgress: OnExportProgress
  agentLog: AgentLogger
  tag: string
  watchdogMs?: number  // default 90_000
  circuitBreakerLimit?: number  // default 3
}

export interface AgentLoopResult {
  stepCount: number
  llmError?: string
  aborted: boolean
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    agent,
    prompt,
    abortSignal,
    onProgress,
    agentLog,
    tag,
    watchdogMs = 90_000,
    circuitBreakerLimit = 3,
  } = options

  const abortController = new AbortController()
  // Chain external abort signal if provided
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => abortController.abort(), { once: true })
  }

  let watchdog: ReturnType<typeof setTimeout> | undefined
  function resetWatchdog() {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      logger.warn(`${tag} Stream timeout after ${watchdogMs / 1000}s — aborting`)
      abortController.abort()
    }, watchdogMs)
  }
  resetWatchdog()

  let stepCount = 0
  let llmError: string | undefined
  const toolStartTimes = new Map<string, number>()
  let eventCounter = 0
  const eventTypeCounts: Record<string, number> = {}
  let lastHeartbeat = Date.now()

  // Circuit breaker
  let consecutiveToolErrors = 0
  let lastErrorToolName = ''

  // Reasoning bookkeeping
  let reasoningChars = 0
  let lastReasoningEmit = 0
  const REASONING_EMIT_INTERVAL_MS = 500
  let lastReasoningProgressTs = Date.now()
  const REASONING_HARD_LIMIT_CHARS = 200_000

  try {
    const streamResult = await agent.stream({ prompt, abortSignal: abortController.signal })

    for await (const event of streamResult.fullStream) {
      const evType = (event as { type?: string }).type ?? 'unknown'

      // Watchdog reset: only non reasoning-delta events count as progress
      if (evType !== 'reasoning-delta') {
        resetWatchdog()
      }
      eventCounter++
      eventTypeCounts[evType] = (eventTypeCounts[evType] ?? 0) + 1

      // Heartbeat every 5 seconds
      const now = Date.now()
      if (now - lastHeartbeat > 5000) {
        logger.info(`${tag} Heartbeat: ${eventCounter} events received so far. Recent counts: ${JSON.stringify(eventTypeCounts)}`)
        lastHeartbeat = now
      }

      if (evType === 'start-step') {
        stepCount++
        logger.info(`${tag} Step ${stepCount} started`)
        agentLog.startStep(stepCount, 'analyzing')
        // Reset reasoning budget when a new step starts
        reasoningChars = 0
        lastReasoningEmit = 0
        lastReasoningProgressTs = Date.now()
      } else if (evType === 'text-delta' || evType === 'text') {
        const text = (event as { text?: string; textDelta?: string }).text
          ?? (event as { textDelta?: string }).textDelta
          ?? ''
        if (text) agentLog.modelOutput(text)
        // Real text output → reset reasoning bookkeeping
        reasoningChars = 0
        lastReasoningEmit = 0
      } else if (evType === 'reasoning-start') {
        agentLog.modelOutput('\n[REASONING START]\n')
        reasoningChars = 0
        lastReasoningEmit = 0
        lastReasoningProgressTs = Date.now()
      } else if (evType === 'reasoning-delta') {
        const text = (event as { text?: string }).text ?? ''
        if (text) {
          agentLog.modelOutput(text)
          reasoningChars += text.length
          lastReasoningProgressTs = now
          if (
            now - lastReasoningEmit >= REASONING_EMIT_INTERVAL_MS &&
            reasoningChars - lastReasoningEmit >= 50
          ) {
            onProgress({
              type: 'reasoning_progress',
              chars: reasoningChars,
              tokens: Math.round(reasoningChars / 4),
            })
            lastReasoningEmit = reasoningChars
          }
          if (reasoningChars >= REASONING_HARD_LIMIT_CHARS) {
            logger.warn(
              `${tag} Reasoning runaway: ${reasoningChars} chars without tool/text output — aborting`,
            )
            agentLog.toolInternal(
              `FATAL: reasoning loop exceeded ${REASONING_HARD_LIMIT_CHARS} chars without tool/text output`,
            )
            abortController.abort()
            break
          }
        }
        void lastReasoningProgressTs
      } else if (evType === 'reasoning-end') {
        agentLog.modelOutput('\n[REASONING END]\n')
        if (reasoningChars > 0) {
          onProgress({
            type: 'reasoning_progress',
            chars: reasoningChars,
            tokens: Math.round(reasoningChars / 4),
          })
        }
      } else if (evType === 'tool-input-start' || evType === 'tool-input-delta' || evType === 'tool-input-end') {
        // Tool input streaming events — ignore deltas
      } else if (evType === 'tool-call') {
        const e = event as { toolName?: string; input?: unknown }
        const toolName = e.toolName ?? 'unknown'
        logger.info(`${tag} Step ${stepCount}: tool-call ${toolName}`)
        toolStartTimes.set(toolName, Date.now())
        agentLog.toolCall(toolName, e.input)
      } else if (evType === 'tool-result') {
        const e = event as { toolName?: string; output?: unknown }
        const toolName = e.toolName ?? 'unknown'
        const startTime = toolStartTimes.get(toolName) ?? Date.now()
        const durationMs = Date.now() - startTime
        agentLog.toolResult(toolName, e.output, durationMs)
        // Successful tool result → reset circuit breaker
        consecutiveToolErrors = 0
        lastErrorToolName = ''
      } else if (evType === 'tool-error') {
        const e = event as { toolName?: string; error?: unknown }
        const toolName = e.toolName ?? 'unknown'
        const errStr = String(e.error).slice(0, 200)
        agentLog.toolInternal(`TOOL ERROR [${toolName}]: ${errStr}`)
        logger.warn(`${tag} Tool error: ${toolName} — ${errStr}`)
        if (toolName === lastErrorToolName) {
          consecutiveToolErrors++
        } else {
          consecutiveToolErrors = 1
          lastErrorToolName = toolName
        }
        if (consecutiveToolErrors >= circuitBreakerLimit) {
          logger.error(`${tag} Circuit breaker: ${toolName} failed ${consecutiveToolErrors} times consecutively — aborting`)
          agentLog.toolInternal(
            `FATAL: Circuit breaker tripped — ${toolName} failed ${consecutiveToolErrors} times consecutively`,
          )
          abortController.abort()
          break
        }
      } else if (evType === 'error') {
        const e = event as { error?: unknown }
        const errStr = String(e.error)
        agentLog.toolInternal(`STREAM ERROR: ${errStr}`)
        logger.error(`${tag} Stream error:`, e.error)
      } else if (evType === 'finish-step' || evType === 'finish') {
        const e = event as { rawFinishReason?: string; finishReason?: string }
        if (e.rawFinishReason === 'error' || e.finishReason === 'error') {
          llmError = `LLM 返回错误 (finishReason=${e.rawFinishReason ?? e.finishReason})`
        }
        const snapshot = JSON.stringify(event, null, 2).slice(0, 500)
        agentLog.toolInternal(`EVENT [${evType}]: ${snapshot}`)
      } else {
        // Catch-all for diagnostics
        const snapshot = JSON.stringify(event, null, 2).slice(0, 500)
        agentLog.toolInternal(`UNHANDLED EVENT [${evType}]: ${snapshot}`)
        if (eventCounter <= 20) {
          logger.info(`${tag} Unhandled event type: ${evType}`)
        }
      }
    }

    logger.info(`${tag} Stream consumed ${eventCounter} events. Type counts: ${JSON.stringify(eventTypeCounts)}`)
    if (watchdog) clearTimeout(watchdog)

    return { stepCount, llmError, aborted: false }
  } catch (err) {
    if (watchdog) clearTimeout(watchdog)
    const isAbort = err instanceof Error && (err.name === 'AbortError' || String(err).includes('abort'))
    if (isAbort) {
      return { stepCount, llmError, aborted: true }
    }
    throw err
  }
}
