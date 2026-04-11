import type { ToolLoopAgent } from 'ai'
import { logger } from '../utils/logger.js'
import type { AgentLogger } from '../utils/agent-logger.js'
import { t } from '../i18n/index.js'

// ── Error classification ──

export interface ApiErrorInfo {
  statusCode?: number
  message: string
  isPayment: boolean    // 402
  isAuth: boolean       // 401
  isRateLimit: boolean  // 429
}

function extractStatusCode(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const e = err as { statusCode?: number; status?: number; code?: number }
    return e.statusCode ?? e.status ?? e.code
  }
  return undefined
}

export function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { statusCode?: number; data?: { error?: { message?: string } }; message?: string }
    if (e.data?.error?.message) {
      return e.statusCode ? `API error ${e.statusCode}: ${e.data.error.message}` : e.data.error.message
    }
    if (e.message) {
      const msg = e.message.replace(/^[A-Za-z_]+Error\s*\[.*?\]:\s*/, '')
      return e.statusCode ? `API error ${e.statusCode}: ${msg}` : msg
    }
  }
  return String(err)
}

export function classifyApiError(err: unknown): ApiErrorInfo {
  const message = extractApiErrorMessage(err)
  let statusCode = extractStatusCode(err)

  // Also try to extract status code from error message (e.g. "API error 402: ...")
  if (!statusCode) {
    const match = message.match(/\b(40[0-9]|429)\b/)
    if (match) statusCode = parseInt(match[1]!, 10)
  }

  return {
    statusCode,
    message,
    isPayment: statusCode === 402,
    isAuth: statusCode === 401,
    isRateLimit: statusCode === 429,
  }
}

export function toUserFacingError(info: ApiErrorInfo): string {
  if (info.isPayment) return t('agent.error.payment')
  if (info.isAuth) return t('agent.error.auth')
  if (info.isRateLimit) return t('agent.error.rate_limit')
  return info.message
}

// ── Timeout helper ──

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ])
}

// ── Agent loop ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamEvent = { type: string; [key: string]: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamResult = Awaited<ReturnType<ToolLoopAgent<never, any, never>['stream']>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentLoopOptions<TResult = void> {
  agent: ToolLoopAgent<never, any, never>
  prompt: string
  tag: string
  agentLog: AgentLogger

  // Timeouts
  watchdogMs?: number              // default 90_000
  connectTimeoutMs?: number        // default 30_000
  resultTimeoutMs?: number         // default 10_000

  // Circuit breaker
  circuitBreakerLimit?: number     // default 3

  // External abort
  abortSignal?: AbortSignal

  // Caller-specific event handling (called for every stream event)
  onEvent?: (event: StreamEvent) => void

  // Progress callback for reasoning events (backward compat with export callers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProgress?: (event: any) => void

  // Post-stream result extraction (runs inside timeout protection)
  extractResult?: (streamResult: StreamResult) => Promise<TResult>
}

export interface AgentLoopResult<TResult = void> {
  stepCount: number
  llmError?: string
  aborted: boolean
  extracted?: TResult
}

export async function runAgentLoop<TResult = void>(
  options: AgentLoopOptions<TResult>,
): Promise<AgentLoopResult<TResult>> {
  const {
    agent,
    prompt,
    tag,
    agentLog,
    watchdogMs = 90_000,
    connectTimeoutMs = 30_000,
    resultTimeoutMs = 10_000,
    circuitBreakerLimit = 3,
    abortSignal,
    onEvent,
    onProgress,
    extractResult,
  } = options

  const abortController = new AbortController()
  // Chain external abort signal if provided
  if (abortSignal) {
    if (abortSignal.aborted) {
      return { stepCount: 0, aborted: true }
    }
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
  let streamError: string | undefined
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

  let streamResult: StreamResult

  try {
    // Phase 1: Initial connection with timeout protection
    try {
      streamResult = await withTimeout(
        agent.stream({ prompt, abortSignal: abortController.signal }),
        connectTimeoutMs,
        t('agent.error.connect_timeout'),
      )
    } catch (err) {
      if (watchdog) clearTimeout(watchdog)

      // Classify error for user-friendly message
      const info = classifyApiError(err)
      if (info.isPayment || info.isAuth || info.isRateLimit) {
        throw new Error(toUserFacingError(info))
      }

      if (abortController.signal.aborted) {
        return { stepCount: 0, aborted: true }
      }
      throw new Error(info.message)
    }

    // Phase 2: Stream consumption
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

      // Dispatch caller-specific handler first
      onEvent?.(event as StreamEvent)

      // Built-in event handling
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
            onProgress?.({
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
          onProgress?.({
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

        // Check for payment/auth errors in tool errors
        const info = classifyApiError(e.error)
        if (info.isPayment || info.isAuth || info.isRateLimit) {
          logger.error(`${tag} API error detected in tool: ${toUserFacingError(info)}`)
          abortController.abort()
          throw new Error(toUserFacingError(info))
        }

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

        // Check for payment/auth errors
        const info = classifyApiError(e.error)
        if (info.isPayment || info.isAuth || info.isRateLimit) {
          throw new Error(toUserFacingError(info))
        }

        streamError = errStr
        break
      } else if (evType === 'finish-step' || evType === 'finish') {
        const e = event as { rawFinishReason?: string; finishReason?: string }
        if (e.rawFinishReason === 'error' || e.finishReason === 'error') {
          llmError = `LLM returned error (finishReason=${e.rawFinishReason ?? e.finishReason})`
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

    // Phase 3: Post-stream — throw immediately on stream error before any await
    if (streamError) {
      throw new Error(`Agent stream error: ${streamError}`)
    }

    // Phase 4: Extract result with timeout protection
    let extracted: TResult | undefined
    if (extractResult) {
      try {
        extracted = await withTimeout(
          extractResult(streamResult),
          resultTimeoutMs,
          'extractResult',
        )
      } catch (err) {
        logger.warn(`${tag} extractResult failed: ${String(err)}`)
        // Don't throw — caller can check extracted === undefined
      }
    }

    return { stepCount, llmError, aborted: false, extracted }
  } catch (err) {
    if (watchdog) clearTimeout(watchdog)
    const isAbort = err instanceof Error && (err.name === 'AbortError' || String(err).includes('abort'))
    if (isAbort) {
      return { stepCount, llmError, aborted: true }
    }

    // Final classification pass for errors that bubble up from stream iteration
    const info = classifyApiError(err)
    if (info.isPayment || info.isAuth || info.isRateLimit) {
      throw new Error(toUserFacingError(info))
    }

    throw err
  }
}
