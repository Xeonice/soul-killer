import type { WebSearchExtraction } from '../../ingest/web-adapter.js'
import type { OnProgress } from '../soul-capture-agent.js'
import type { SearchStrategy, SearchExecutors } from './types.js'
import { logger } from '../../utils/logger.js'

/**
 * PUBLIC_ENTITY strategy: Tavily (news/interviews) + Wikipedia.
 * Best for: living or recently active public figures.
 */
export const publicEntityStrategy: SearchStrategy = {
  async search(
    englishName: string,
    chineseName: string,
    origin: string,
    executors: SearchExecutors,
    onProgress?: OnProgress,
  ): Promise<WebSearchExtraction[]> {
    const extractions: WebSearchExtraction[] = []
    const cleanOrigin = origin.replace(/[:"']/g, ' ').trim()

    // Tavily queries — targets news, interviews, speeches
    const queries = [
      `${englishName} interview quotes`,
      `${englishName} personality style`,
      `${englishName} ${cleanOrigin} views philosophy`,
    ]
    if (chineseName && chineseName !== englishName) {
      queries.push(`${chineseName} 观点 理念 风格`)
    }

    for (const query of queries) {
      logger.debug('[strategy:public-entity] Tavily search:', query)
      onProgress?.({ type: 'tool_call', tool: 'search', query })

      try {
        const results = await executors.search(query)
        logger.debug('[strategy:public-entity] Tavily result:', query, '→', results.length, 'results')
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
        logger.warn('[strategy:public-entity] Tavily failed:', query, err)
        onProgress?.({ type: 'tool_result', tool: 'search', resultCount: 0 })
      }
    }

    // Wikipedia supplement
    logger.debug('[strategy:public-entity] Wikipedia EN:', englishName)
    onProgress?.({ type: 'tool_call', tool: 'wikipedia', query: englishName })
    try {
      const wikiResults = await executors.wikipedia(englishName, 'en')
      logger.debug('[strategy:public-entity] Wikipedia EN result:', wikiResults.length)
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
      logger.warn('[strategy:public-entity] Wikipedia EN failed:', err)
      onProgress?.({ type: 'tool_result', tool: 'wikipedia', resultCount: 0 })
    }

    logger.info('[strategy:public-entity] Done:', extractions.length, 'extractions')
    return extractions
  },
}
