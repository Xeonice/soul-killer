import type { WebSearchExtraction } from '../../ingest/web-adapter.js'
import type { OnProgress } from '../soul-capture-agent.js'
import type { SearchStrategy, SearchExecutors } from './types.js'
import { executeWebSearch } from '../tools/web-search.js'
import { logger } from '../../utils/logger.js'

/**
 * DIGITAL_CONSTRUCT strategy: DuckDuckGo + page extraction (fandom wikis) + Wikipedia.
 * Best for: fictional characters from games, anime, movies, novels.
 */
export const digitalConstructStrategy: SearchStrategy = {
  async search(
    englishName: string,
    chineseName: string,
    origin: string,
    executors: SearchExecutors,
    onProgress?: OnProgress,
  ): Promise<WebSearchExtraction[]> {
    const extractions: WebSearchExtraction[] = []
    const cleanOrigin = origin.replace(/[:"']/g, ' ').trim()

    // DuckDuckGo queries — targets fandom wikis, character databases
    const ddgQueries = [
      `${englishName} ${cleanOrigin} wiki`,
      `${englishName} ${cleanOrigin} character`,
    ]
    if (chineseName && chineseName !== englishName) {
      ddgQueries.push(`${chineseName} ${cleanOrigin} 角色`)
    }

    for (const query of ddgQueries) {
      logger.debug('[strategy:digital-construct] DuckDuckGo search:', query)
      onProgress?.({ type: 'tool_call', tool: 'duckduckgo', query })

      try {
        const results = await executeWebSearch(query)
        logger.debug('[strategy:digital-construct] DuckDuckGo result:', query, '→', results.length, 'results')
        for (const r of results) {
          logger.debug('[strategy:digital-construct]   -', r.title, '|', r.url, '|', r.content.slice(0, 80))
        }
        onProgress?.({ type: 'tool_result', tool: 'duckduckgo', resultCount: results.length })

        for (const r of results) {
          extractions.push({
            content: r.content,
            url: r.url,
            searchQuery: query,
            extractionStep: 'gather_deep',
          })
        }
      } catch (err) {
        logger.warn('[strategy:digital-construct] DuckDuckGo failed:', query, err)
        onProgress?.({ type: 'tool_result', tool: 'duckduckgo', resultCount: 0 })
      }
    }

    // Wikipedia English supplement
    logger.debug('[strategy:digital-construct] Wikipedia EN:', englishName)
    onProgress?.({ type: 'tool_call', tool: 'wikipedia', query: englishName })
    try {
      const wikiResults = await executors.wikipedia(englishName, 'en')
      logger.debug('[strategy:digital-construct] Wikipedia EN result:', wikiResults.length)
      onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: wikiResults.length })
      for (const r of wikiResults) {
        extractions.push({
          content: r.extract,
          url: r.url,
          searchQuery: englishName,
          extractionStep: 'gather_base',
        })
      }
    } catch (err) {
      logger.warn('[strategy:digital-construct] Wikipedia EN failed:', err)
      onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: 0 })
    }

    logger.info('[strategy:digital-construct] Done:', extractions.length, 'extractions')
    return extractions
  },
}
