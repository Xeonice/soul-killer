import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ToolLoopAgent, stepCountIs, hasToolCall, generateText, type LanguageModel } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SoulkillerConfig } from '../../config/schema.js'
import type { CaptureStrategy, CaptureResult, OnProgress } from './capture-strategy.js'
import type { DimensionPlan } from './dimension-framework.js'
import { t } from '../i18n/index.js'
import { createArrayArgRepair } from '../utils/repair-tool-call.js'
import { createEvaluationTools } from './tools/index.js'
import type { DimensionScore, ArticleScore } from './tools/evaluate-dimension.js'
import { readDimensionCache } from './tools/evaluate-dimension.js'
import { filterByTitles } from '../search/title-filter.js'
import type { TitleFilterInput } from '../search/title-filter.js'
import { runPlanningAgent } from './planning-agent.js'
import { withExacto, getProviderOptions, getToolChoice } from '../llm/client.js'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { logger } from '../utils/logger.js'
import { AgentLogger } from '../utils/agent-logger.js'
import { ensureSearxng } from '../search/searxng-search.js'
import type { SearchResult } from '../search/tavily-search.js'
import { runAgentLoop } from './agent-loop.js'

// ── Search executor: runs all planned queries deterministically ──

interface SearchExecutorConfig {
  searxngAvailable: boolean
  config: SoulkillerConfig
  agentLog: AgentLogger
}

async function createSearchRunner(execConfig: SearchExecutorConfig) {
  // Import search backends
  const { executeTavilySearch } = await import('../search/tavily-search.js')
  const { executeExaSearch } = await import('../search/exa-search.js')
  const { searxngSearch } = await import('../search/searxng-search.js')

  const config = execConfig.config
  const tavilyKey = config.search?.tavily_api_key
  const exaKey = config.search?.exa_api_key
  const configProvider = config.search?.provider

  const resolvedProvider = configProvider === 'searxng' && execConfig.searxngAvailable ? 'searxng'
    : configProvider === 'exa' && exaKey ? 'exa'
    : configProvider === 'tavily' && tavilyKey ? 'tavily'
    : execConfig.searxngAvailable ? 'searxng'
    : exaKey ? 'exa'
    : tavilyKey ? 'tavily'
    : 'none'

  const seenUrls = new Set<string>()

  return async function runSearch(query: string): Promise<SearchResult[]> {
    let results: SearchResult[]

    if (resolvedProvider === 'searxng') {
      results = await searxngSearch(query)
    } else if (resolvedProvider === 'exa') {
      results = await executeExaSearch(exaKey!, query)
    } else if (resolvedProvider === 'tavily') {
      results = await executeTavilySearch(tavilyKey!, query)
    } else {
      throw new Error('No search provider configured. Set search.provider in ~/.soulkiller/config.yaml')
    }

    // Dedup across all searches
    results = results.filter((r) => {
      if (seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      return true
    })

    return results
  }
}

async function executeDeterministicSearch(
  dimensionPlan: DimensionPlan,
  runSearch: (query: string) => Promise<SearchResult[]>,
  sessionDir: string,
  agentLog: AgentLogger,
  onProgress?: OnProgress,
): Promise<Map<string, SearchResult[]>> {
  const allResults = new Map<string, SearchResult[]>()

  const totalQueries = dimensionPlan.dimensions.reduce((sum, d) => sum + d.queries.length, 0)
  let queryIndex = 0

  for (const dim of dimensionPlan.dimensions) {
    const dimResults: SearchResult[] = []

    for (const query of dim.queries) {
      queryIndex++
      onProgress?.({ type: 'tool_call', tool: 'search', query: `[${queryIndex}/${totalQueries}] ${query}` })

      try {
        const results = await runSearch(query)
        dimResults.push(...results)
        agentLog.toolInternal(`Search "${query}" → ${results.length} results`)
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: results.length })
      } catch (err) {
        agentLog.toolInternal(`Search "${query}" failed: ${String(err)}`)
      }
    }

    allResults.set(dim.name, dimResults)

    // Write to file cache
    const cacheFile = path.join(sessionDir, `${dim.name}.json`)
    fs.writeFileSync(cacheFile, JSON.stringify({ query: dim.queries, results: dimResults }))

    logger.info(`[search-exec] ${dim.name}: ${dimResults.length} results from ${dim.queries.length} queries`)
  }

  return allResults
}

// ── Parallel quality scoring ──

const SCORING_CONCURRENCY = 5

async function scoreDimensionsParallel(
  model: LanguageModel,
  dimensionPlan: DimensionPlan,
  sessionDir: string,
  agentLog: AgentLogger,
  targetName: string,
  hint: string | undefined,
  onProgress?: OnProgress,
  providerOpts?: SharedV3ProviderOptions,
): Promise<Map<string, DimensionScore>> {
  const scores = new Map<string, DimensionScore>()
  const dims = dimensionPlan.dimensions
  let completed = 0

  for (let i = 0; i < dims.length; i += SCORING_CONCURRENCY) {
    const batch = dims.slice(i, i + SCORING_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (dim) => {
        const results = readDimensionCache(sessionDir, dim.name)
        if (results.length === 0) {
          return {
            dimension: dim.name,
            totalArticles: 0,
            scores: [] as ArticleScore[],
            qualifiedCount: 0,
            minRequired: dim.minArticles,
            sufficient: false,
          } satisfies DimensionScore
        }

        onProgress?.({ type: 'tool_call', tool: 'checkCoverage', query: `scoring: ${dim.name} (${results.length} articles)` })

        // Build article list for LLM scoring
        const articleList = results.slice(0, 10).map((r, idx) =>
          `[${idx}] "${r.title}" (${r.url})\n${r.content.slice(0, 2000)}`,
        ).join('\n\n---\n\n')

        const criteriaList = dim.qualityCriteria.map((c) => `- ${c}`).join('\n')

        const hintLine = hint ? `\nUser description: "${hint}"` : ''

        try {
          const { text } = await generateText({
            model,
            providerOptions: providerOpts,
            system: `You are a search result quality evaluator. Score each article 1-5 against the criteria below.

Target: "${targetName}"${hintLine}
Dimension: ${dim.name} — ${dim.description}

Quality criteria:
${criteriaList}

Scoring guide:
1 = Irrelevant or empty content
2 = Mentions the topic but no depth
3 = Acceptable — has useful information
4 = Good — detailed and relevant
5 = Excellent — comprehensive, authoritative

Output JSON array only: [{"index": 0, "score": 4, "reason": "${t('capture.score_example_reason')}"}, ...]`,
            prompt: articleList.slice(0, 8000),
            temperature: 0,
          })

          const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
          const parsed = JSON.parse(jsonText) as { index: number; score: number; reason: string }[]

          const articleScores: ArticleScore[] = parsed.map((s) => ({
            index: s.index,
            title: results[s.index]?.title ?? '',
            url: results[s.index]?.url ?? '',
            score: s.score,
            reason: s.reason,
            keep: s.score >= 3,
          }))

          const qualifiedCount = articleScores.filter((s) => s.keep).length
          completed++
          agentLog.toolInternal(`Score ${dim.name}: ${qualifiedCount}/${dim.minArticles} qualified from ${articleScores.length} scored`)
          onProgress?.({ type: 'tool_result', tool: 'checkCoverage', resultCount: qualifiedCount })

          return {
            dimension: dim.name,
            totalArticles: results.length,
            scores: articleScores,
            qualifiedCount,
            minRequired: dim.minArticles,
            sufficient: qualifiedCount >= dim.minArticles,
          } satisfies DimensionScore
        } catch (err) {
          completed++
          agentLog.toolInternal(`Score ${dim.name} failed: ${String(err)}`)
          // Fallback: assume all articles qualify
          return {
            dimension: dim.name,
            totalArticles: results.length,
            scores: results.slice(0, 10).map((r, idx) => ({
              index: idx, title: r.title, url: r.url, score: 3, reason: 'scoring failed, default pass', keep: true,
            })),
            qualifiedCount: Math.min(results.length, 10),
            minRequired: dim.minArticles,
            sufficient: true,
          } satisfies DimensionScore
        }
      }),
    )

    for (const result of batchResults) {
      scores.set(result.dimension, result)
    }
  }

  return scores
}

// ── Main capture function ──

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
  const model = provider(withExacto(config.llm.default_model))
  const providerOpts = getProviderOptions(config.llm.default_model)

  let searxngAvailable = false
  if (config.search?.provider === 'searxng') {
    searxngAvailable = await ensureSearxng()
  }

  const resolvedProvider = config.search?.provider === 'searxng' && searxngAvailable ? 'searxng'
    : config.search?.provider === 'exa' && config.search?.exa_api_key ? 'exa'
    : config.search?.provider === 'tavily' && config.search?.tavily_api_key ? 'tavily'
    : searxngAvailable ? 'searxng'
    : config.search?.exa_api_key ? 'exa'
    : config.search?.tavily_api_key ? 'tavily'
    : 'none'

  const agentLog = new AgentLogger(strategy.buildUserMessage(name, hint), {
    model: config.llm.default_model,
    provider: resolvedProvider,
    raw: { search: config.search, temperature: 0 },
  })

  onProgress?.({ type: 'phase', phase: 'initiating' })

  // ── Phase 1: Pre-search (multilingual) ──
  logger.info(`${tag} Pre-search with raw name: "${name}"`)
  onProgress?.({ type: 'phase', phase: 'searching' })

  const runSearchFn = await createSearchRunner({ searxngAvailable, config, agentLog })

  // Build multilingual pre-search queries from name + hint
  const preSearchQueries = [name]
  // Add English variant if hint contains English or name is CJK
  if (hint) {
    // Extract potential English name from hint
    const enMatch = hint.match(/[A-Za-z][\w\s]+[A-Za-z]/)?.[0]
    if (enMatch && enMatch.length > 3) preSearchQueries.push(enMatch)
  }
  // If name is CJK, also search a romanized/English version
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(name)
  if (hasCJK && hint) {
    preSearchQueries.push(`${name} ${hint}`)
  }

  let preSearchResults: SearchResult[] = []
  for (const query of preSearchQueries) {
    onProgress?.({ type: 'tool_call', tool: 'search', query })
    try {
      const results = await runSearchFn(query)
      preSearchResults.push(...results)
      onProgress?.({ type: 'tool_result', tool: 'search', resultCount: results.length })
    } catch (err) {
      logger.warn(`${tag} Pre-search "${query}" failed:`, String(err))
    }
  }
  logger.info(`${tag} Pre-search results: ${preSearchResults.length} from ${preSearchQueries.length} queries`)

  // ── Phase 2: Planning Agent ──
  onProgress?.({ type: 'phase', phase: 'classifying' })
  onProgress?.({ type: 'tool_call', tool: 'planSearch', query: 'Planning Agent: generating dimension plan...' })
  let dimensionPlan: DimensionPlan
  try {
    dimensionPlan = await runPlanningAgent(
      model, strategy.type, name, hint,
      preSearchResults, '', name,
      undefined, providerOpts,
    )
    const totalQueries = dimensionPlan.dimensions.reduce((sum, d) => sum + d.queries.length, 0)
    logger.info(`${tag} Planning Agent: ${dimensionPlan.dimensions.length} dimensions, ${totalQueries} queries`)
    onProgress?.({ type: 'tool_result', tool: 'planSearch', resultCount: dimensionPlan.dimensions.length })
    onProgress?.({ type: 'search_plan', dimensions: dimensionPlan.dimensions.map((d) => ({ dimension: d.name, priority: d.priority, queries: d.queries })) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`${tag} Planning Agent failed:`, message)
    throw new Error(`Planning Agent failed: ${message}`)
  }

  // ── Phase 3: Deterministic search execution ──
  onProgress?.({ type: 'phase', phase: 'searching' })

  // Replace template placeholders in queries before executing
  const effectiveLocalName = dimensionPlan.localName && dimensionPlan.localName !== dimensionPlan.englishName
    ? dimensionPlan.localName : dimensionPlan.englishName
  for (const dim of dimensionPlan.dimensions) {
    dim.queries = dim.queries.map((q) =>
      q.replace(/\{name\}/g, dimensionPlan.englishName)
       .replace(/\{localName\}/g, effectiveLocalName)
       .replace(/\{origin\}/g, dimensionPlan.origin),
    )
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const sessionDir = path.join(os.homedir(), '.soulkiller', 'cache', 'search', sessionId)
  fs.mkdirSync(sessionDir, { recursive: true })

  const searchResults = await executeDeterministicSearch(
    dimensionPlan, runSearchFn, sessionDir, agentLog, onProgress,
  )

  const totalResults = Array.from(searchResults.values()).reduce((sum, r) => sum + r.length, 0)
  logger.info(`${tag} Deterministic search complete: ${totalResults} total results across ${searchResults.size} dimensions`)

  // ── Phase 3b: Title-based quick filter ──
  const allTitles: TitleFilterInput[] = []
  for (const dim of dimensionPlan.dimensions) {
    const results = readDimensionCache(sessionDir, dim.name)
    results.forEach((r, idx) => {
      allTitles.push({ index: allTitles.length, title: r.title, url: r.url, dimension: dim.name })
    })
  }

  onProgress?.({ type: 'tool_call', tool: 'checkCoverage', query: `title filter: reviewing ${allTitles.length} articles` })
  const titleResults = await filterByTitles(
    model, name, dimensionPlan.classification, hint,
    dimensionPlan.dimensions.map((d) => ({ name: d.name, description: d.description })),
    allTitles,
  )
  onProgress?.({ type: 'tool_result', tool: 'checkCoverage', resultCount: titleResults.filter(r => r.keep).length })

  // Remove dropped articles from dimension caches
  let globalIdx = 0
  for (const dim of dimensionPlan.dimensions) {
    const results = readDimensionCache(sessionDir, dim.name)
    const dropSet = new Set<number>()
    for (let i = 0; i < results.length; i++) {
      const filterResult = titleResults[globalIdx]
      if (filterResult && !filterResult.keep) {
        dropSet.add(i)
      }
      globalIdx++
    }
    if (dropSet.size > 0) {
      const filtered = results.filter((_, i) => !dropSet.has(i))
      fs.writeFileSync(path.join(sessionDir, `${dim.name}.json`), JSON.stringify({ results: filtered }))
      logger.info(`${tag} Title filter: ${dim.name} dropped ${dropSet.size}/${results.length}, kept ${filtered.length}`)
    }
  }

  // ── Phase 4: Parallel quality scoring ──
  onProgress?.({ type: 'phase', phase: 'analyzing' })

  const dimensionScores = await scoreDimensionsParallel(
    model, dimensionPlan, sessionDir, agentLog, name, hint, onProgress, providerOpts,
  )

  let scoredSummary = Array.from(dimensionScores.values())
  let totalQualified = scoredSummary.reduce((sum, s) => sum + s.qualifiedCount, 0)
  let insufficientDims = scoredSummary.filter((s) => !s.sufficient).map((s) => s.dimension)
  logger.info(`${tag} Quality scoring complete: ${totalQualified} qualified articles, ${insufficientDims.length} insufficient dimensions: [${insufficientDims.join(', ')}]`)

  // ── Phase 4b: Auto-supplement loop (max 3 rounds) ──
  const MAX_SUPPLEMENT_ROUNDS = 3
  // Alternate language strategies per round
  const langStrategies = [
    (enName: string, _localName: string, dim: typeof dimensionPlan.dimensions[0]) => {
      // Round 1: English queries
      const words = dim.description.split(/[,，、\s]+/).filter((w) => w.length > 1).slice(0, 3)
      return words.map((w) => `${enName} ${w}`)
    },
    (_enName: string, localName: string, dim: typeof dimensionPlan.dimensions[0]) => {
      // Round 2: Japanese + mixed queries
      return [
        `${localName} ${dim.display} wiki`,
        `${localName} ${dim.display} 百科`,
        `${dim.display} 概要 特徴`,
      ]
    },
    (enName: string, localName: string, dim: typeof dimensionPlan.dimensions[0]) => {
      // Round 3: broader queries with signals
      const topSignals = dim.signals.slice(0, 3)
      return [
        ...topSignals.map((s) => `${enName} ${s}`),
        `${localName} ${dim.name} overview`,
      ]
    },
  ]

  for (let round = 0; round < MAX_SUPPLEMENT_ROUNDS && insufficientDims.length > 0; round++) {
    const strategy = langStrategies[round] ?? langStrategies[langStrategies.length - 1]!
    logger.info(`${tag} Supplement round ${round + 1}/${MAX_SUPPLEMENT_ROUNDS}: ${insufficientDims.length} dimensions need more data`)
    onProgress?.({ type: 'tool_call', tool: 'search', query: `supplement round ${round + 1}: ${insufficientDims.join(', ')}` })

    for (const dimName of insufficientDims) {
      const dim = dimensionPlan.dimensions.find((d) => d.name === dimName)
      if (!dim) continue

      const queries = strategy(dimensionPlan.englishName, dimensionPlan.localName, dim)

      for (const query of queries) {
        onProgress?.({ type: 'tool_call', tool: 'search', query: `[R${round + 1}] ${query}` })
        try {
          const results = await runSearchFn(query)
          if (results.length > 0) {
            const existing = readDimensionCache(sessionDir, dimName)
            const existingUrls = new Set(existing.map((r) => r.url))
            const newResults = results.filter((r) => !existingUrls.has(r.url))
            if (newResults.length > 0) {
              const combined = [...existing, ...newResults]
              fs.writeFileSync(path.join(sessionDir, `${dimName}.json`), JSON.stringify({ results: combined }))
              agentLog.toolInternal(`Supplement R${round + 1} ${dimName}: "${query}" → ${newResults.length} new`)
              onProgress?.({ type: 'tool_result', tool: 'search', resultCount: newResults.length })
            }
          }
        } catch { /* skip */ }
      }
    }

    // Re-score only the insufficient dimensions
    logger.info(`${tag} Re-scoring after round ${round + 1}...`)
    const reScores = await scoreDimensionsParallel(model, dimensionPlan, sessionDir, agentLog, name, hint, onProgress, providerOpts)
    for (const [dim, score] of reScores) {
      dimensionScores.set(dim, score)
    }

    scoredSummary = Array.from(dimensionScores.values())
    totalQualified = scoredSummary.reduce((sum, s) => sum + s.qualifiedCount, 0)
    insufficientDims = scoredSummary.filter((s) => !s.sufficient).map((s) => s.dimension)
    logger.info(`${tag} After round ${round + 1}: ${totalQualified} qualified, ${insufficientDims.length} still insufficient: [${insufficientDims.join(', ')}]`)

    if (insufficientDims.length === 0) break
  }

  // Write filtered caches: only keep score >= 3 articles, sorted by score desc
  for (const [dimName, score] of dimensionScores) {
    const results = readDimensionCache(sessionDir, dimName)
    const qualifiedIndices = score.scores
      .filter(s => s.keep)
      .sort((a, b) => b.score - a.score)
      .map(s => s.index)

    const filtered = qualifiedIndices
      .filter(idx => idx < results.length)
      .map(idx => ({
        ...results[idx],
        _score: score.scores.find(s => s.index === idx)?.score ?? 3,
        _reason: score.scores.find(s => s.index === idx)?.reason ?? '',
      }))

    fs.writeFileSync(path.join(sessionDir, `${dimName}.json`), JSON.stringify({ results: filtered }))
    logger.info(`${tag} Filtered cache: ${dimName} → ${filtered.length} qualified articles (from ${results.length})`)
  }

  // Emit per-dimension scoring as chunks_extracted for UI display
  onProgress?.({ type: 'chunks_extracted', count: totalQualified })

  // ── Phase 5: Agent reviews scores + supplements ──

  // Build dimension summary with scoring results
  const dimSummary = dimensionPlan.dimensions.map((d) => {
    const score = dimensionScores.get(d.name)
    const status = score
      ? `${score.qualifiedCount}/${score.minRequired} qualified${score.sufficient ? ' ✓' : ' ✗ NEEDS SUPPLEMENT'}`
      : 'not scored'
    return `- **${d.name}** (${d.priority}): ${d.description} — ${status}`
  }).join('\n')

  const userMessage = `Target: "${name}"${hint ? `\nHint: ${hint}` : ''}

## Quality Scoring Results

${dimSummary}

Review each dimension's scores by calling evaluateDimension. If any dimension is insufficient, use supplementSearch to add more data. Then call reportFindings.`

  const { tools } = createEvaluationTools(config, {
    agentLog, strategy, dimensionPlan, dimensionScores, sessionDir, searxngAvailable,
  })

  const dimCount = dimensionPlan.dimensions.length
  // Budget: each dimension gets ~3 steps (evaluate + 1-2 supplement), plus
  // reportFindings + retry buffer. Floor at 30 to ensure enough headroom
  // for models that don't support toolChoice:'required'.
  const maxSteps = Math.max(30, Math.min(dimCount * 3 + 8, 80))
  let stepCount = 0
  let reportFindingsBackup: unknown = undefined

  const agent = new ToolLoopAgent({
    model,
    instructions: (dimensionPlan && strategy.buildSystemPrompt) ? strategy.buildSystemPrompt(dimensionPlan) : strategy.systemPrompt,
    tools,
    toolChoice: getToolChoice(config.llm.default_model, 'required'),
    temperature: 0,
    providerOptions: providerOpts,
    stopWhen: [
      stepCountIs(maxSteps),
      hasToolCall('reportFindings'),
    ],
    experimental_repairToolCall: createArrayArgRepair(),
    prepareStep: async ({ stepNumber }) => {
      // After enough steps for all dimensions, force reportFindings
      if (stepNumber >= dimCount + 3 || stepNumber >= maxSteps - 2) {
        logger.info(`${tag} Step ${stepNumber}: forcing reportFindings (dimCount=${dimCount})`)
        const forced = getToolChoice(config.llm.default_model, 'required')
        if (forced === 'required') {
          return { toolChoice: { type: 'tool' as const, toolName: 'reportFindings' as const } }
        }
        // Fallback for models that don't support toolChoice:'required':
        // restrict activeTools to only reportFindings so the model has no
        // other option. This works with toolChoice:'auto' because the model
        // can only see one tool.
        return { activeTools: ['reportFindings' as const] }
      }
      return {}
    },
  })

  logger.info(`${tag} Running quality evaluation agent...`)

  const loopResult = await runAgentLoop({
    agent,
    prompt: userMessage,
    tag,
    agentLog,
    onEvent(event) {
      if (event.type === 'tool-call') {
        if (event.toolName === 'evaluateDimension') {
          const input = event.input as { dimensionName: string }
          onProgress?.({ type: 'tool_call', tool: 'checkCoverage', query: `evaluating: ${input.dimensionName}` })
        } else if (event.toolName === 'supplementSearch') {
          const input = event.input as { dimensionName: string; keywords: string[] }
          onProgress?.({ type: 'tool_call', tool: 'search', query: `supplement: ${input.keywords?.join(' ') ?? ''}` })
        } else if (event.toolName === 'reportFindings') {
          onProgress?.({ type: 'tool_call', tool: 'reportFindings', query: 'compiling report...' })
          reportFindingsBackup = event.input
        }
      } else if (event.type === 'tool-result') {
        if (event.toolName === 'evaluateDimension') {
          onProgress?.({ type: 'tool_result', tool: 'checkCoverage', resultCount: 1 })
        } else if (event.toolName === 'supplementSearch') {
          const output = event.output as { newResults?: number }
          onProgress?.({ type: 'tool_result', tool: 'search', resultCount: output.newResults ?? 0 })
        }
      }
    },
    async extractResult(streamResult) {
      const staticCalls = await streamResult.staticToolCalls
      let call = staticCalls.find((tc) => tc.toolName === 'reportFindings')

      // Fallback: recover from stream event backup if staticToolCalls missed it
      if (!call && reportFindingsBackup) {
        logger.warn(`${tag} staticToolCalls missed reportFindings, recovering from backup`)
        let input = reportFindingsBackup
        if (typeof input === 'string') {
          try { input = JSON.parse(input) } catch { /* keep as-is */ }
        }
        const parsed = input as Record<string, unknown>
        if (parsed && typeof parsed === 'object' && 'classification' in parsed && 'dimensionStatus' in parsed) {
          call = { toolName: 'reportFindings' as const, input } as any
          logger.info(`${tag} Backup recovery successful`)
        }
      }
      return call
    },
  })

  stepCount = loopResult.stepCount
  logger.info(`${tag} Stream finished. Steps:`, stepCount)

  if (loopResult.aborted) {
    throw new Error(`Capture agent aborted after ${stepCount} steps`)
  }

  const findingsCall = loopResult.extracted

  if (findingsCall) {
    const args = findingsCall.input as {
      classification: string
      origin?: string
      summary: string
      dimensionStatus: { dimension: string; qualifiedArticles: number; sufficient: boolean }[]
    }

    logger.info(`${tag} reportFindings:`, {
      classification: args.classification,
      origin: args.origin,
      dimensionStatus: args.dimensionStatus,
    })

    onProgress?.({ type: 'classification', classification: args.classification, origin: args.origin })

    const classification = args.classification
    const unknownClassifications = ['UNKNOWN_ENTITY', 'UNKNOWN_SETTING']
    const isUnknown = unknownClassifications.includes(classification)
    onProgress?.({ type: 'phase', phase: isUnknown ? 'unknown' : 'complete' })

    // Build dimensionScores summary for CaptureResult
    const scoresRecord: Record<string, { qualifiedCount: number; minRequired: number; sufficient: boolean }> = {}
    for (const [dim, score] of dimensionScores) {
      scoresRecord[dim] = { qualifiedCount: score.qualifiedCount, minRequired: score.minRequired, sufficient: score.sufficient }
    }

    const result: CaptureResult = {
      classification,
      origin: args.origin,
      summary: args.summary,
      sessionDir,
      elapsedMs: Date.now() - startTime,
      dimensionPlan,
      dimensionScores: scoresRecord,
    }

    agentLog.writeResult(result, stepCount)
    agentLog.writeAnalysis(result, args.dimensionStatus.map((s) => ({ dimension: s.dimension, content: `${s.qualifiedArticles} qualified articles, sufficient: ${s.sufficient}` })))

    return { ...result, agentLog }
  }

  // Fallback: no reportFindings
  const unknownClassification = strategy.type === 'soul' ? 'UNKNOWN_ENTITY' : 'UNKNOWN_SETTING'
  logger.warn(`${tag} No reportFindings call found, returning ${unknownClassification}`)
  onProgress?.({ type: 'phase', phase: 'unknown' })

  const fallbackResult: CaptureResult = {
    classification: unknownClassification,
    elapsedMs: Date.now() - startTime,
  }

  agentLog.writeResult(fallbackResult, stepCount)
  agentLog.writeAnalysis(fallbackResult)

  return { ...fallbackResult, agentLog }
}
