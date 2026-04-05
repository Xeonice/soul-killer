import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SoulkillerConfig } from '../config/schema.js'
import type { SoulChunk } from '../ingest/types.js'
import { webExtractionToChunks, type WebSearchExtraction } from '../ingest/web-adapter.js'
import { createAgentTools } from './tools/search-factory.js'
import { logger } from '../utils/logger.js'
import { AgentLogger } from '../utils/agent-logger.js'
import { ensureSearxng } from './tools/searxng-search.js'
import type { SoulDimension } from './dimensions.js'

export type TargetClassification =
  | 'DIGITAL_CONSTRUCT'
  | 'PUBLIC_ENTITY'
  | 'HISTORICAL_RECORD'
  | 'UNKNOWN_ENTITY'

export interface SearchPlanDimension {
  dimension: string
  priority: string
  queries: string[]
}

export type CaptureProgress =
  | { type: 'phase'; phase: 'initiating' | 'searching' | 'classifying' | 'analyzing' | 'filtering' | 'complete' | 'unknown' }
  | { type: 'tool_call'; tool: string; query: string }
  | { type: 'tool_result'; tool: string; resultCount: number }
  | { type: 'classification'; classification: TargetClassification; origin?: string }
  | { type: 'search_plan'; dimensions: SearchPlanDimension[] }
  | { type: 'filter_progress'; kept: number; total: number }
  | { type: 'chunks_extracted'; count: number }

export interface CaptureResult {
  classification: TargetClassification
  origin?: string
  chunks: SoulChunk[]
  elapsedMs: number
  agentLog?: AgentLogger
}

export type OnProgress = (progress: CaptureProgress) => void

const CAPTURE_SYSTEM_PROMPT = `You are a research assistant specialized in building comprehensive digital profiles of people and characters. Your job is to gather detailed information about a target from public web sources.

## Mission

Given a target name, research and collect information across 6 profile dimensions. Search systematically until you have sufficient coverage.

## Profile Dimensions

A complete profile requires data across these dimensions:

1. **identity** (REQUIRED) — Who they are: background, origin, role, affiliations
2. **quotes** (REQUIRED) — Their actual words: dialogue, famous lines, catchphrases, direct quotes
3. **expression** (REQUIRED) — How they communicate: tone, word choice, rhetoric, humor style, speech patterns
4. **thoughts** (IMPORTANT) — What they believe: values, philosophy, opinions, worldview
5. **behavior** (IMPORTANT) — How they act: decision patterns, conflict response, habits
6. **relations** (SUPPLEMENTARY) — Who they connect with: key relationships, social dynamics

You need at least 3 dimensions covered, with at least 2 of the 3 REQUIRED dimensions, before you can report.

## Workflow

### Phase 1: Reconnaissance (first 2 steps)
Search broadly to identify the target. The search engine automatically queries multiple sources including web pages, Wikipedia, and forums. Try different keywords and languages.

### Phase 2: Planning (step 3)
Call planSearch with a summary of what you found. Include:
- The classification (DIGITAL_CONSTRUCT for fictional characters, PUBLIC_ENTITY for public figures, HISTORICAL_RECORD for historical figures, or UNKNOWN_ENTITY if not found)
- The English name (if discovered)
- The local/original name
- The origin (source work, organization, era)

planSearch will return a structured research plan with recommended queries for each dimension.

### Phase 3: Collection (step 4+)
Follow the research plan. For each dimension:
- Use the recommended queries from the plan
- Adjust queries if results are poor
- Use extractPage for promising but short snippets
- Search in multiple languages (中文, English, 日本語)

After every 3-4 searches, call checkCoverage to see which dimensions are still missing. Focus your remaining searches on uncovered dimensions, especially REQUIRED ones.

## When to Stop

Call reportFindings when:
- checkCoverage shows canReport=true (3+ dimensions, 2+ required)
- OR you've exhausted search angles after 10+ searches
- OR the target is UNKNOWN_ENTITY (no results found)

When reporting, tag each extraction with its dimension.

## Extraction Guidelines

When calling reportFindings, submit MANY separate extractions — aim for 3-8 per covered dimension, 20-40 total. Quality comes from breadth:

- Each extraction = ONE distinct piece of information (one quote, one fact, one observation)
- Do NOT merge multiple search results into a single extraction
- Do NOT summarize — preserve raw content, direct quotes, and specific details
- Copy interesting paragraphs verbatim from search results rather than paraphrasing
- Include the source URL for every extraction
- For **quotes** dimension: each famous line or dialogue should be its own extraction
- For **identity** dimension: separate background, timeline, roles into individual extractions
- For **expression** dimension: each speech pattern example should be its own extraction

Bad: One extraction with 10 paragraphs covering everything about identity
Good: 5 separate extractions, each with a specific identity fact

## Rules

- IMPORTANT: Always use tools — do not generate plain text responses. Each step should result in a tool call.
- Follow the workflow strictly: search first (2 rounds), then planSearch, then collect by dimension, then checkCoverage, then reportFindings.
- Do NOT fabricate information. Only report what you actually found.
- Do NOT search the same query twice.
- Prefer content with direct quotes, personality analysis, and behavioral patterns — these make the profile vivid and authentic.
- When you discover the target's English name, use it for English-language searches.
- Always call planSearch before deep collection — it gives you the research strategy.`

const DOOM_LOOP_THRESHOLD = 3
const MAX_STEPS = 30

const COLLECTION_START = 3   // step 3+: collection phase for UI

export async function captureSoul(
  name: string,
  config: SoulkillerConfig,
  onProgress?: OnProgress,
  hint?: string,
): Promise<CaptureResult> {
  const startTime = Date.now()
  logger.info('[captureSoul] Start:', { name, hint, model: config.llm.default_model })

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
    logger.info('[captureSoul] SearXNG available:', searxngAvailable)
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

  const userMessage = [
    `Research and build a comprehensive profile of: "${name}"`,
    hint ? `Hint: ${hint}` : '',
  ].filter(Boolean).join('\n')

  const agentLog = new AgentLogger(userMessage, {
    model: config.llm.default_model,
    provider: resolvedProvider,
    raw: { search: config.search, temperature: 0 },
  })

  const tools = createAgentTools(config, { searxngAvailable, agentLog })

  onProgress?.({ type: 'phase', phase: 'initiating' })

  let stepCount = 0
  let currentPhase = 'initiating'
  const toolCallTimers = new Map<string, number>()

  const agent = new ToolLoopAgent({
    model,
    instructions: CAPTURE_SYSTEM_PROMPT,
    tools,
    toolChoice: 'auto',
    temperature: 0,
    stopWhen: [
      stepCountIs(MAX_STEPS),
      hasToolCall('reportFindings'),
    ],
    prepareStep: async ({ stepNumber, steps }) => {
      // Last step: force reportFindings
      if (stepNumber >= MAX_STEPS - 1) {
        logger.info('[captureSoul] Last step, forcing reportFindings')
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
            logger.warn('[captureSoul] Doom loop detected, forcing reportFindings')
            return { toolChoice: { type: 'tool' as const, toolName: 'reportFindings' as const } }
          }
        }
      }

      return {}
    },
  })

  logger.info('[captureSoul] Running ToolLoopAgent (streaming)...')
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
      } else if (stepCount === COLLECTION_START + 1) {
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
      const startTime = toolCallTimers.get(event.toolName) ?? Date.now()
      const durationMs = Date.now() - startTime
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

  logger.info('[captureSoul] Stream finished. Steps:', stepCount)

  // Extract reportFindings from staticToolCalls
  const staticCalls = await streamResult.staticToolCalls
  const findingsCall = staticCalls.find((tc) => tc.toolName === 'reportFindings')

  if (findingsCall) {
    const args = findingsCall.input as {
      classification: TargetClassification
      origin?: string
      summary: string
      extractions: { content: string; url?: string; searchQuery: string; dimension: SoulDimension }[]
    }

    logger.info('[captureSoul] reportFindings:', {
      classification: args.classification,
      origin: args.origin,
      extractionCount: args.extractions.length,
    })

    onProgress?.({ type: 'classification', classification: args.classification, origin: args.origin })

    const webExtractions: WebSearchExtraction[] = args.extractions.map((e) => ({
      content: e.content,
      url: e.url,
      searchQuery: e.searchQuery,
      extractionStep: e.dimension,
    }))

    const chunks = webExtractionToChunks(webExtractions)

    onProgress?.({ type: 'chunks_extracted', count: chunks.length })
    onProgress?.({
      type: 'phase',
      phase: args.classification === 'UNKNOWN_ENTITY' ? 'unknown' : 'complete',
    })

    const result: CaptureResult = {
      classification: args.classification,
      origin: args.origin,
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
  logger.warn('[captureSoul] No reportFindings call found, returning UNKNOWN_ENTITY')
  onProgress?.({ type: 'chunks_extracted', count: 0 })
  onProgress?.({ type: 'phase', phase: 'unknown' })

  const fallbackResult: CaptureResult = {
    classification: 'UNKNOWN_ENTITY',
    chunks: [],
    elapsedMs: Date.now() - startTime,
  }

  agentLog.writeResult(fallbackResult, stepCount)
  agentLog.writeAnalysis(fallbackResult)

  return { ...fallbackResult, agentLog }
}
