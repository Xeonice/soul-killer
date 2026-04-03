import type { WebSearchExtraction } from '../../ingest/web-adapter.js'
import type { OnProgress } from '../soul-capture-agent.js'
import type { SearchStrategy, SearchExecutors } from './types.js'
import { logger } from '../../utils/logger.js'

/**
 * HISTORICAL_RECORD strategy: Wikipedia-first + Tavily supplement.
 * Best for: historical figures no longer alive or active.
 */
export const historicalRecordStrategy: SearchStrategy = {
  async search(
    englishName: string,
    chineseName: string,
    origin: string,
    executors: SearchExecutors,
    onProgress?: OnProgress,
  ): Promise<WebSearchExtraction[]> {
    const extractions: WebSearchExtraction[] = []

    // Wikipedia as primary source — both languages
    for (const [lang, query] of [['en', englishName], ['zh', chineseName || englishName]] as const) {
      logger.debug('[strategy:historical-record] Wikipedia', lang, ':', query)
      onProgress?.({ type: 'tool_call', tool: 'wikipedia', query })
      try {
        const results = await executors.wikipedia(query, lang)
        logger.debug('[strategy:historical-record] Wikipedia', lang, 'result:', results.length)
        onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: results.length })
        for (const r of results) {
          extractions.push({
            content: r.extract,
            url: r.url,
            searchQuery: query,
            extractionStep: 'gather_base',
          })
        }
      } catch (err) {
        logger.warn('[strategy:historical-record] Wikipedia', lang, 'failed:', err)
        onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: 0 })
      }
    }

    // Tavily supplement — quotes and philosophy
    const tavilyQueries = [
      `${englishName} famous quotes`,
      `${englishName} philosophy contributions`,
    ]
    if (chineseName && chineseName !== englishName) {
      tavilyQueries.push(`${chineseName} 名言 思想 贡献`)
    }

    for (const query of tavilyQueries) {
      logger.debug('[strategy:historical-record] Tavily search:', query)
      onProgress?.({ type: 'tool_call', tool: 'search', query })
      try {
        const results = await executors.search(query)
        logger.debug('[strategy:historical-record] Tavily result:', query, '→', results.length)
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: results.length })
        for (const r of results) {
          extractions.push({
            content: r.content,
            url: r.url,
            searchQuery: query,
            extractionStep: 'gather_deep',
          })
        }
      } catch (err) {
        logger.warn('[strategy:historical-record] Tavily failed:', query, err)
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: 0 })
      }
    }

    logger.info('[strategy:historical-record] Done:', extractions.length, 'extractions')
    return extractions
  },
}
