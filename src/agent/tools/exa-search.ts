import { Exa } from 'exa-js'
import type { SearchResult } from './tavily-search.js'

export async function executeExaSearch(apiKey: string, query: string): Promise<SearchResult[]> {
  const exa = new Exa(apiKey)
  const response = await exa.searchAndContents(query, {
    type: 'auto',
    numResults: 10,
    text: { maxCharacters: 3000 },
  })

  return response.results.map((r) => ({
    title: r.title ?? '',
    url: r.url,
    content: r.text ?? '',
  }))
}
