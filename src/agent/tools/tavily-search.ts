import { tool } from 'ai'
import { z } from 'zod'

export interface SearchResult {
  title: string
  url: string
  content: string
}

/** Tool schema for LLM (no execute — handled manually in agent loop) */
export const tavilySearchSchema = tool({
  description: 'Search the internet for information about a person, character, or topic. Returns relevant web pages with content.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
})

/** Execute the Tavily search */
export async function executeTavilySearch(apiKey: string, query: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    results: { title: string; url: string; content: string }[]
  }

  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }))
}
