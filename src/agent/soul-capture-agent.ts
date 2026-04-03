import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SoulkillerConfig } from '../config/schema.js'
import type { SoulChunk } from '../ingest/types.js'
import { createSearchTools } from './tools/search-factory.js'
import { webExtractionToChunks, type WebSearchExtraction } from '../ingest/web-adapter.js'
import { logger } from '../utils/logger.js'
import { getStrategyForClassification } from './strategies/index.js'
import type { SearchExecutors } from './strategies/types.js'

export type TargetClassification =
  | 'DIGITAL_CONSTRUCT'
  | 'PUBLIC_ENTITY'
  | 'HISTORICAL_RECORD'
  | 'UNKNOWN_ENTITY'

export type CaptureProgress =
  | { type: 'phase'; phase: 'initiating' | 'searching' | 'classifying' | 'analyzing' | 'filtering' | 'complete' | 'unknown' }
  | { type: 'tool_call'; tool: string; query: string }
  | { type: 'tool_result'; tool: string; resultCount: number }
  | { type: 'classification'; classification: TargetClassification; origin?: string }
  | { type: 'filter_progress'; kept: number; total: number }
  | { type: 'chunks_extracted'; count: number }

export interface CaptureResult {
  classification: TargetClassification
  origin?: string
  chunks: SoulChunk[]
  elapsedMs: number
}

export type OnProgress = (progress: CaptureProgress) => void

const CLASSIFY_PROMPT = `You are the Soulkiller Protocol. Your task is to CLASSIFY a target based on search results.

Analyze the provided search results about a target and output a JSON object (no markdown, no code fences, just raw JSON):

{
  "classification": "DIGITAL_CONSTRUCT",
  "english_name": "English Name",
  "origin": "source work, organization, or era",
  "summary": "one paragraph about who/what this is"
}

classification must be exactly one of:
- DIGITAL_CONSTRUCT = fictional character from game, anime, movie, novel, etc.
- PUBLIC_ENTITY = real living or recently active public figure
- HISTORICAL_RECORD = historical figure (no longer alive or active for decades)
- UNKNOWN_ENTITY = cannot find meaningful information from the search results

Output ONLY the JSON object, nothing else.`


// ========== Main Entry ==========

export async function captureSoul(
  name: string,
  config: SoulkillerConfig,
  onProgress?: OnProgress,
  hint?: string,
): Promise<CaptureResult> {
  const startTime = Date.now()
  logger.info('[captureSoul] Start:', { name, hint, model: config.llm.default_model })

  const { executors } = createSearchTools(config)
  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: 'https://openrouter.ai/api/v1',
  })
  const model = provider(config.llm.default_model)

  onProgress?.({ type: 'phase', phase: 'initiating' })

  // ========== Step 1: Deterministic Search ==========
  logger.info('[captureSoul] Step 1: Deterministic search')
  onProgress?.({ type: 'phase', phase: 'searching' })
  const searchExtractions = await runDeterministicSearch(name, hint, executors, onProgress)
  logger.info('[captureSoul] Step 1 done:', searchExtractions.length, 'extractions')

  // ========== Step 2: LLM Classification ==========
  logger.info('[captureSoul] Step 2: LLM classification')
  onProgress?.({ type: 'phase', phase: 'classifying' })
  const { classification, englishName, origin } = await classifyWithLLM(name, hint, searchExtractions, model)
  logger.info('[captureSoul] Step 2 done:', { classification, englishName, origin })

  onProgress?.({ type: 'classification', classification, origin })

  // ========== Step 3: Strategy-based Deep Search ==========
  const allExtractions = [...searchExtractions]

  if (classification !== 'UNKNOWN_ENTITY') {
    logger.info('[captureSoul] Step 3: Strategy deep search for', classification)
    onProgress?.({ type: 'phase', phase: 'analyzing' })

    const strategy = getStrategyForClassification(classification)
    const cn = name !== englishName ? name : ''
    const deepExtractions = await strategy.search(englishName, cn, origin ?? '', executors, onProgress)
    allExtractions.push(...deepExtractions)

    logger.info('[captureSoul] Step 3 done: total', allExtractions.length, 'extractions (initial:', searchExtractions.length, '+ deep:', deepExtractions.length, ')')
  } else {
    logger.info('[captureSoul] Step 3 skipped: classification is UNKNOWN_ENTITY')
  }

  // ========== Step 4: Relevance Filter ==========
  const targetDesc = `${name}${origin ? ` (${origin})` : ''}${hint ? ` — ${hint}` : ''}`
  let filteredExtractions: WebSearchExtraction[]
  if (classification !== 'UNKNOWN_ENTITY' && allExtractions.length > 0) {
    logger.info('[captureSoul] Step 4: Relevance filter on', allExtractions.length, 'extractions')
    onProgress?.({ type: 'phase', phase: 'filtering' })
    filteredExtractions = await filterRelevantExtractions(allExtractions, targetDesc, model, onProgress)
    logger.info('[captureSoul] Step 4 done:', filteredExtractions.length, '/', allExtractions.length, 'kept')
  } else {
    logger.info('[captureSoul] Step 4 skipped: no extractions to filter')
    filteredExtractions = []
  }

  // ========== Convert to chunks ==========
  const chunks = webExtractionToChunks(filteredExtractions)
  logger.info('[captureSoul] Final chunks:', chunks.length, '| elapsed:', Date.now() - startTime, 'ms')

  onProgress?.({ type: 'chunks_extracted', count: chunks.length })
  onProgress?.({
    type: 'phase',
    phase: classification === 'UNKNOWN_ENTITY' ? 'unknown' : 'complete',
  })

  return {
    classification,
    origin,
    chunks,
    elapsedMs: Date.now() - startTime,
  }
}

// ========== Step 1: Deterministic Search ==========

async function runDeterministicSearch(
  name: string,
  hint: string | undefined,
  executors: SearchExecutors,
  onProgress?: OnProgress,
): Promise<WebSearchExtraction[]> {
  const extractions: WebSearchExtraction[] = []

  const queries: { tool: 'search' | 'wikipedia'; query: string; lang?: string }[] = [
    { tool: 'search', query: name },
    { tool: 'wikipedia', query: name, lang: 'zh' },
    { tool: 'wikipedia', query: name, lang: 'en' },
  ]

  if (hint) {
    queries.splice(1, 0, { tool: 'search', query: `${name} ${hint}` })
  }

  logger.debug('[deterministicSearch] Queries planned:', queries.length, queries.map((q) => `${q.tool}:"${q.query}"`).join(', '))

  for (const q of queries) {
    onProgress?.({ type: 'tool_call', tool: q.tool, query: q.query })

    try {
      if (q.tool === 'search') {
        const results = await executors.search(q.query)
        logger.debug('[deterministicSearch] Tavily:', q.query, '→', results.length, 'results')
        for (const r of results) {
          logger.debug('[deterministicSearch]   -', r.title, '|', r.url, '|', r.content.slice(0, 80))
        }
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: results.length })
        for (const r of results) {
          extractions.push({ content: r.content, url: r.url, searchQuery: q.query, extractionStep: 'identify' })
        }
      } else {
        const results = await executors.wikipedia(q.query, q.lang)
        logger.debug('[deterministicSearch] Wikipedia', q.lang, ':', q.query, '→', results.length, 'results')
        for (const r of results) {
          logger.debug('[deterministicSearch]   -', r.title, '|', r.url, '|', r.extract.slice(0, 80))
        }
        onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: results.length })
        for (const r of results) {
          extractions.push({ content: r.extract, url: r.url, searchQuery: q.query, extractionStep: 'gather_base' })
        }
      }
    } catch (err) {
      logger.warn('[deterministicSearch] Failed:', q.tool, q.query, err)
      onProgress?.({ type: 'tool_result', tool: q.tool, resultCount: 0 })
    }
  }

  logger.info('[deterministicSearch] Done:', extractions.length, 'total extractions')
  return extractions
}

// ========== Step 2: LLM Classification ==========

interface ClassificationResult {
  classification: TargetClassification
  englishName: string
  origin?: string
}

async function classifyWithLLM(
  name: string,
  hint: string | undefined,
  extractions: WebSearchExtraction[],
  llmModel: ReturnType<ReturnType<typeof createOpenAICompatible>>,
): Promise<ClassificationResult> {
  const defaultResult: ClassificationResult = { classification: 'UNKNOWN_ENTITY', englishName: name }

  const contextParts = extractions.slice(0, 10).map((e, i) =>
    `[${i + 1}] ${e.url ?? 'unknown'}\n${e.content.slice(0, 400)}`
  )
  const searchContext = contextParts.join('\n\n---\n\n')

  const userContent = [
    `Target: "${name}"`,
    hint ? `User hint: ${hint}` : '',
    '',
    'Search results:',
    searchContext || '(no search results found)',
  ].filter(Boolean).join('\n')

  logger.debug('[classifyWithLLM] Input context length:', userContent.length, 'chars,', extractions.length, 'extractions used')

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      logger.debug('[classifyWithLLM] Attempt', attempt, 'calling LLM...')
      const result = await generateText({
        model: llmModel,
        messages: [
          { role: 'system', content: CLASSIFY_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
      })

      const text = result.text.trim()
      logger.debug('[classifyWithLLM] Attempt', attempt, 'response:', text.slice(0, 500))

      if (!text) {
        logger.warn('[classifyWithLLM] Attempt', attempt, 'returned empty text')
        continue
      }

      const parsed = parseIdentificationJSON(text)
      if (parsed) {
        logger.info('[classifyWithLLM] Parsed successfully:', parsed)
        return {
          classification: parsed.classification,
          englishName: parsed.english_name || name,
          origin: parsed.origin,
        }
      }

      logger.warn('[classifyWithLLM] Attempt', attempt, 'JSON parse failed, raw:', text.slice(0, 300))
    } catch (err) {
      logger.error('[classifyWithLLM] Attempt', attempt, 'error:', err)
    }
  }

  logger.warn('[classifyWithLLM] All attempts failed, returning UNKNOWN_ENTITY')
  return defaultResult
}

// ========== Relevance Filter ==========

async function filterRelevantExtractions(
  extractions: WebSearchExtraction[],
  targetDesc: string,
  llmModel: ReturnType<ReturnType<typeof createOpenAICompatible>>,
  onProgress?: OnProgress,
): Promise<WebSearchExtraction[]> {
  if (extractions.length === 0) return []

  logger.info('[filter] Start: filtering', extractions.length, 'extractions for target:', targetDesc)

  const BATCH_SIZE = 10
  const relevant: WebSearchExtraction[] = []
  let processed = 0

  for (let i = 0; i < extractions.length; i += BATCH_SIZE) {
    const batch = extractions.slice(i, i + BATCH_SIZE)

    // Log what we're sending to the filter
    logger.debug('[filter] Batch', Math.floor(i / BATCH_SIZE) + 1, ':', batch.length, 'items')
    for (const [idx, e] of batch.entries()) {
      logger.debug('[filter]   [' + (idx + 1) + ']', e.url ?? 'no-url', '|', e.content.slice(0, 100))
    }

    const numbered = batch.map((e, idx) =>
      `[${idx + 1}] ${e.url ?? 'no-url'}\n${e.content.slice(0, 300)}`
    ).join('\n\n---\n\n')

    try {
      const result = await generateText({
        model: llmModel,
        messages: [
          {
            role: 'system',
            content: `You are a relevance filter. Given a target and a batch of search results, determine which results are about the SAME person/character.

Reply with ONLY the numbers of relevant results, comma-separated. Example: "1,3,5"
If none are relevant, reply "NONE".`,
          },
          {
            role: 'user',
            content: `Target: ${targetDesc}\n\nSearch results:\n\n${numbered}`,
          },
        ],
        temperature: 0,
      })

      const text = result.text.trim()
      logger.debug('[filter] LLM raw response:', JSON.stringify(text))

      if (text.toUpperCase() === 'NONE') {
        logger.debug('[filter] LLM said NONE — 0 kept from this batch')
      } else {
        const indices = text.split(/[,\s]+/)
          .map((s) => parseInt(s, 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= batch.length)

        logger.debug('[filter] Parsed indices:', indices, '(from raw:', JSON.stringify(text), ')')

        if (indices.length === 0) {
          logger.warn('[filter] LLM response could not be parsed as indices:', JSON.stringify(text), '— keeping all as fallback')
          relevant.push(...batch)
        } else {
          for (const idx of indices) {
            relevant.push(batch[idx - 1]!)
          }
        }
      }
    } catch (err) {
      logger.warn('[filter] LLM call failed, keeping all:', err)
      relevant.push(...batch)
    }

    processed += batch.length
    onProgress?.({ type: 'filter_progress', kept: relevant.length, total: processed })
  }

  logger.info('[filter] Done:', relevant.length, '/', extractions.length, 'kept')
  return relevant
}

// ========== JSON Parsing ==========

interface IdentificationResult {
  classification: TargetClassification
  english_name?: string
  origin?: string
  summary?: string
}

const VALID_CLASSIFICATIONS = new Set<string>([
  'DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY',
])

function parseIdentificationJSON(text: string): IdentificationResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.debug('[parseJSON] No JSON object found in text')
      return null
    }

    const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const rawClass = String(obj.classification ?? '').toUpperCase()

    if (!VALID_CLASSIFICATIONS.has(rawClass)) {
      logger.debug('[parseJSON] Invalid classification:', rawClass)
      return null
    }

    return {
      classification: rawClass as TargetClassification,
      english_name: obj.english_name ? String(obj.english_name) : undefined,
      origin: obj.origin ? String(obj.origin) : undefined,
      summary: obj.summary ? String(obj.summary) : undefined,
    }
  } catch (err) {
    logger.debug('[parseJSON] JSON.parse error:', err)
    return null
  }
}
