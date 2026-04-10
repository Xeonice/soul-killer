import { generateText, type LanguageModel } from 'ai'
import { logger } from '../utils/logger.js'

export interface TitleFilterInput {
  index: number
  title: string
  url: string
  dimension: string
}

export interface TitleFilterResult {
  index: number
  keep: boolean
}

const FILTER_TIMEOUT_MS = 90_000

/**
 * Filter articles for a single dimension by title relevance.
 * One LLM call per dimension — keeps prompt small and judgment focused.
 */
async function filterDimension(
  model: LanguageModel,
  targetName: string,
  classification: string,
  dimensionName: string,
  dimensionDescription: string,
  hint: string | undefined,
  articles: TitleFilterInput[],
): Promise<TitleFilterResult[]> {
  if (articles.length === 0) return []

  const titleList = articles.map((a) =>
    `[${a.index}] "${a.title}" (${a.url})`,
  ).join('\n')

  const hintLine = hint ? `\nUser description: "${hint}"` : ''

  const abortController = new AbortController()
  const timeout = setTimeout(() => {
    logger.warn(`[title-filter] Timeout for dimension "${dimensionName}" after ${FILTER_TIMEOUT_MS}ms — aborting`)
    abortController.abort()
  }, FILTER_TIMEOUT_MS)

  try {
    const { text } = await generateText({
      model,
      system: `You are a search result relevance filter. Review article titles and URLs to determine if they are relevant to the target AND the specified research dimension.

Target: "${targetName}" (${classification})${hintLine}
Dimension: "${dimensionName}" — ${dimensionDescription}

For each article, decide:
- keep: The article is likely relevant to the target AND this dimension, or you cannot tell from the title alone
- drop: The article is clearly NOT about the target (e.g., unrelated topic, different entity) OR clearly irrelevant to this dimension

Be conservative: when in doubt, keep the article. Only drop articles that are OBVIOUSLY irrelevant.

Output a JSON array: [{"index": 0, "keep": true}, {"index": 1, "keep": false}, ...]
Respond ONLY with the JSON array.`,
      prompt: titleList,
      temperature: 0,
      abortSignal: abortController.signal,
    })

    clearTimeout(timeout)

    const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    const parsed = JSON.parse(jsonText) as { index: number; keep: boolean }[]

    const resultMap = new Map(parsed.map((r) => [r.index, r.keep]))
    return articles.map((a) => ({
      index: a.index,
      keep: resultMap.get(a.index) ?? true,
    }))
  } catch (err) {
    clearTimeout(timeout)
    logger.warn(`[title-filter] Failed for dimension "${dimensionName}", keeping all: ${String(err)}`)
    return articles.map((a) => ({ index: a.index, keep: true }))
  }
}

/**
 * Filter articles by title relevance, one dimension at a time.
 * Each dimension gets its own LLM call with focused context.
 */
export interface DimensionInfo {
  name: string
  description: string
}

export async function filterByTitles(
  model: LanguageModel,
  targetName: string,
  classification: string,
  hint: string | undefined,
  dimensions: DimensionInfo[],
  articles: TitleFilterInput[],
): Promise<TitleFilterResult[]> {
  if (articles.length === 0) return []

  // Build dimension description lookup
  const dimDescMap = new Map(dimensions.map((d) => [d.name, d.description]))

  // Group articles by dimension
  const byDimension = new Map<string, TitleFilterInput[]>()
  for (const a of articles) {
    const group = byDimension.get(a.dimension) ?? []
    group.push(a)
    byDimension.set(a.dimension, group)
  }

  logger.info(`[title-filter] Filtering ${articles.length} articles across ${byDimension.size} dimensions for "${targetName}"`)

  // Run all dimensions concurrently
  const dimensionEntries = Array.from(byDimension.entries())
  const batchResults = await Promise.all(
    dimensionEntries.map(([dim, dimArticles]) =>
      filterDimension(model, targetName, classification, dim, dimDescMap.get(dim) ?? dim, hint, dimArticles),
    ),
  )

  // Merge results back, preserving original index order
  const resultMap = new Map<number, boolean>()
  for (const batch of batchResults) {
    for (const r of batch) {
      resultMap.set(r.index, r.keep)
    }
  }

  const results = articles.map((a) => ({
    index: a.index,
    keep: resultMap.get(a.index) ?? true,
  }))

  const dropCount = results.filter((r) => !r.keep).length
  logger.info(`[title-filter] Result: ${dropCount} dropped, ${results.length - dropCount} kept`)

  return results
}
