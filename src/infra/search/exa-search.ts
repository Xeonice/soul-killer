import { Exa } from 'exa-js'
import type { SearchResult } from './tavily-search.js'

/** Detect if query contains CJK characters (Chinese, Japanese, Korean) */
export function hasCJK(query: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(query)
}

export async function executeExaSearch(apiKey: string, query: string): Promise<SearchResult[]> {
  const exa = new Exa(apiKey)
  const searchType = hasCJK(query) ? 'keyword' : 'auto'
  const response = await exa.searchAndContents(query, {
    type: searchType,
    numResults: 10,
    text: true,
  })

  return response.results.map((r) => ({
    title: r.title ?? '',
    url: r.url,
    content: r.text ?? '',
  }))
}
