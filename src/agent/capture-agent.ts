import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SoulkillerConfig } from '../config/schema.js'
import type { CaptureStrategy, CaptureResult, OnProgress } from './capture-strategy.js'
import { createAgentTools } from './tools/search-factory.js'
import { logger } from '../utils/logger.js'
import { AgentLogger } from '../utils/agent-logger.js'
import { ensureSearxng } from './tools/searxng-search.js'

const DOOM_LOOP_THRESHOLD = 3

/**
 * Generic capture agent loop shared by Soul and World capture.
 * Strategy pattern determines the system prompt, dimensions, and result processing.
 */
export async function runCaptureAgent(
  strategy: CaptureStrategy,
  name: string,
  config: SoulkillerConfig,
  onProgress?: OnProgress,
  hint?: string,
): Promise<CaptureResult> {
  const startTime = Date.now()
  const tag = `[capture:${strategy.type}]`
  logger.info(`${tag} Start:`, { name, hint, model: config.llm.default_model })

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: 'https://openrouter.ai/api/v1',
  })
  const model = provider(config.llm.default_model)

  // Initialize SearXNG if configured as search provider
  let searxngAvailable = false
  if (config.search?.provider === 'searxng') {
    searxngAvailable = await ensureSearxng()
    logger.info(`${tag} SearXNG available:`, searxngAvailable)
  }

  // Resolve search provider name for logging
  const configProvider = config.search?.provider
  const resolvedProvider = configProvider === 'searxng' && searxngAvailable ? 'searxng'
    : configProvider === 'exa' && config.search?.exa_api_key ? 'exa'
    : configProvider === 'tavily' && config.search?.tavily_api_key ? 'tavily'
    : searxngAvailable ? 'searxng'
    : config.search?.exa_api_key ? 'exa'
    : config.search?.tavily_api_key ? 'tavily'
    : 'none'

  const userMessage = strategy.buildUserMessage(name, hint)

  const agentLog = new AgentLogger(userMessage, {
    model: config.llm.default_model,
    provider: resolvedProvider,
    raw: { search: config.search, temperature: 0 },
  })

  const tools = createAgentTools(config, { searxngAvailable, agentLog, strategy })

  onProgress?.({ type: 'phase', phase: 'initiating' })

  let stepCount = 0
  let currentPhase = 'initiating'
  const toolCallTimers = new Map<string, number>()
  const maxSteps = strategy.maxSteps
  const collectionStart = strategy.collectionStartStep

  const agent = new ToolLoopAgent({
    model,
    instructions: strategy.systemPrompt,
    tools,
    toolChoice: 'auto',
    temperature: 0,
    stopWhen: [
      stepCountIs(maxSteps),
      hasToolCall('reportFindings'),
    ],
    prepareStep: async ({ stepNumber, steps }) => {
      // Last step: force reportFindings
      if (stepNumber >= maxSteps - 1) {
        logger.info(`${tag} Last step, forcing reportFindings`)
        return { toolChoice: { type: 'tool' as const, toolName: 'reportFindings' as const } }
      }

      // Doom loop detection
      if (steps.length >= DOOM_LOOP_THRESHOLD) {
        const recent = steps.slice(-DOOM_LOOP_THRESHOLD)
        const calls = recent
          .map((s) => s.toolCalls?.[0])
          .filter((c): c is NonNullable<typeof c> => c != null)

        if (calls.length === DOOM_LOOP_THRESHOLD) {
          const first = calls[0]!
          const allSame = calls.every(
            (c) => c.toolName === first.toolName && JSON.stringify(c.input) === JSON.stringify(first.input),
          )
          if (allSame) {
            logger.warn(`${tag} Doom loop detected, forcing reportFindings`)
            return { toolChoice: { type: 'tool' as const, toolName: 'reportFindings' as const } }
          }
        }
      }

      return {}
    },
  })

  logger.info(`${tag} Running ToolLoopAgent (streaming)...`)
  const streamResult = await agent.stream({ prompt: userMessage })

  // Consume fullStream for real-time progress events + session logging
  for await (const event of streamResult.fullStream) {
    if (event.type === 'start-step') {
      stepCount++
      if (stepCount === 1) {
        currentPhase = 'searching'
        onProgress?.({ type: 'phase', phase: 'searching' })
      } else if (stepCount === 3) {
        currentPhase = 'classifying'
        onProgress?.({ type: 'phase', phase: 'classifying' })
      } else if (stepCount === collectionStart + 1) {
        currentPhase = 'analyzing'
        onProgress?.({ type: 'phase', phase: 'analyzing' })
      }
      agentLog.startStep(stepCount, currentPhase)
    } else if (event.type === 'text-delta') {
      agentLog.modelOutput(event.text)
    } else if (event.type === 'tool-call') {
      toolCallTimers.set(event.toolName, Date.now())
      agentLog.toolCall(event.toolName, event.input)

      if (event.toolName === 'search') {
        const input = event.input as { query: string }
        onProgress?.({ type: 'tool_call', tool: 'search', query: input.query })
      } else if (event.toolName === 'extractPage') {
        const input = event.input as { url: string }
        onProgress?.({ type: 'tool_call', tool: 'extractPage', query: input.url })
      } else if (event.toolName === 'planSearch') {
        onProgress?.({ type: 'tool_call', tool: 'planSearch', query: 'generating search plan...' })
      } else if (event.toolName === 'checkCoverage') {
        onProgress?.({ type: 'tool_call', tool: 'checkCoverage', query: 'analyzing coverage...' })
      } else if (event.toolName === 'reportFindings') {
        onProgress?.({ type: 'tool_call', tool: 'reportFindings', query: 'compiling report...' })
      }
    } else if (event.type === 'tool-result') {
      const callStartTime = toolCallTimers.get(event.toolName) ?? Date.now()
      const durationMs = Date.now() - callStartTime
      agentLog.toolResult(event.toolName, event.output, durationMs)

      if (event.toolName === 'search') {
        const output = event.output as { results: unknown[] }
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: output.results.length })
      } else if (event.toolName === 'extractPage') {
        const output = event.output as { content: string }
        onProgress?.({ type: 'tool_result', tool: 'extractPage', resultCount: output.content ? 1 : 0 })
      } else if (event.toolName === 'planSearch') {
        onProgress?.({ type: 'tool_result', tool: 'planSearch', resultCount: 1 })
        const planOutput = event.output as { dimensions?: { dimension: string; priority: string; queries: string[] }[] }
        if (planOutput.dimensions) {
          onProgress?.({ type: 'search_plan', dimensions: planOutput.dimensions.map((d) => ({ dimension: d.dimension, priority: d.priority, queries: d.queries ?? [] })) })
        }
      } else if (event.toolName === 'checkCoverage') {
        const output = event.output as { totalCovered: number; canReport?: boolean }
        onProgress?.({ type: 'tool_result', tool: 'checkCoverage', resultCount: output.totalCovered })
        if (output.canReport) {
          currentPhase = 'filtering'
          onProgress?.({ type: 'phase', phase: 'filtering' })
        }
      }
    }
  }

  logger.info(`${tag} Stream finished. Steps:`, stepCount)

  // Extract reportFindings from staticToolCalls
  const staticCalls = await streamResult.staticToolCalls
  const findingsCall = staticCalls.find((tc) => tc.toolName === 'reportFindings')

  if (findingsCall) {
    const args = findingsCall.input as {
      classification: string
      origin?: string
      summary: string
      extractions: { content: string; url?: string; searchQuery: string; dimension: string }[]
    }

    logger.info(`${tag} reportFindings:`, {
      classification: args.classification,
      origin: args.origin,
      extractionCount: args.extractions.length,
    })

    onProgress?.({ type: 'classification', classification: args.classification, origin: args.origin })

    const { classification, origin, chunks } = strategy.processFindings(args)

    onProgress?.({ type: 'chunks_extracted', count: chunks.length })

    // Determine unknown classification
    const unknownClassifications = ['UNKNOWN_ENTITY', 'UNKNOWN_SETTING']
    const isUnknown = unknownClassifications.includes(classification)
    onProgress?.({ type: 'phase', phase: isUnknown ? 'unknown' : 'complete' })

    const result: CaptureResult = {
      classification,
      origin,
      chunks,
      elapsedMs: Date.now() - startTime,
    }

    agentLog.writeResult(result, stepCount)
    agentLog.writeAnalysis(result, args.extractions.map((e) => ({
      dimension: e.dimension,
      content: e.content,
    })))

    return { ...result, agentLog }
  }

  // Fallback: agent hit max steps without calling reportFindings
  const unknownClassification = strategy.type === 'soul' ? 'UNKNOWN_ENTITY' : 'UNKNOWN_SETTING'
  logger.warn(`${tag} No reportFindings call found, returning ${unknownClassification}`)
  onProgress?.({ type: 'chunks_extracted', count: 0 })
  onProgress?.({ type: 'phase', phase: 'unknown' })

  const fallbackResult: CaptureResult = {
    classification: unknownClassification,
    chunks: [],
    elapsedMs: Date.now() - startTime,
  }

  agentLog.writeResult(fallbackResult, stepCount)
  agentLog.writeAnalysis(fallbackResult)

  return { ...fallbackResult, agentLog }
}
