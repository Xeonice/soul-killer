export interface SearchResult {
  title: string
  url: string
  content: string
}

/** Execute the Tavily search with full text content */
export async function executeTavilySearch(apiKey: string, query: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: 10,
      include_answer: false,
      include_raw_content: 'markdown',
    }),
  })

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    results: { title: string; url: string; content: string; raw_content?: string }[]
  }

  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.raw_content || r.content,
  }))
}
