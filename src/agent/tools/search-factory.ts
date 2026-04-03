import type { SoulkillerConfig } from '../../config/schema.js'
import { tavilySearchSchema, executeTavilySearch } from './tavily-search.js'
import { webSearchSchema, executeWebSearch } from './web-search.js'
import { wikipediaSearchSchema, executeWikipediaSearch } from './wikipedia-search.js'
import type { SearchResult } from './tavily-search.js'
import type { WikipediaResult } from './wikipedia-search.js'
import { extractPagesParallel } from './page-extractor.js'

/**
 * Creates tool schemas (for LLM) and executor functions (for manual loop).
 */
export function createSearchTools(config: SoulkillerConfig) {
  const tavilyKey = config.search?.tavily_api_key

  // Tool schemas — no execute, LLM sees these
  const searchTool = tavilyKey ? tavilySearchSchema : webSearchSchema
  const wikipediaTool = wikipediaSearchSchema

  // Executor functions — called manually in agent loop
  async function executeSearch(query: string): Promise<SearchResult[]> {
    let results: SearchResult[]
    if (tavilyKey) {
      results = await executeTavilySearch(tavilyKey, query)
      // For Tavily results with short content, fetch full page
      const shortResults = results.filter((r) => r.content.length < 200 && r.url)
      if (shortResults.length > 0) {
        const pages = await extractPagesParallel(shortResults.map((r) => r.url))
        for (const page of pages) {
          if (page.content) {
            const idx = results.findIndex((r) => r.url === page.url)
            if (idx !== -1) {
              results[idx] = { ...results[idx]!, content: page.content }
            }
          }
        }
      }
      return results
    }
    return executeWebSearch(query)
  }

  async function executeWikipedia(query: string, lang = 'en'): Promise<WikipediaResult[]> {
    return executeWikipediaSearch(query, lang)
  }

  return {
    // Schemas for LLM
    schemas: { search: searchTool, wikipedia: wikipediaTool },
    // Executors for manual loop
    executors: { search: executeSearch, wikipedia: executeWikipedia },
  }
}
