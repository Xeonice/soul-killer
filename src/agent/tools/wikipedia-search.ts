import { tool } from 'ai'
import { z } from 'zod'

export interface WikipediaResult {
  title: string
  extract: string
  url: string
}

/** Tool schema for LLM (no execute — handled manually in agent loop) */
export const wikipediaSearchSchema = tool({
  description: 'Search Wikipedia for authoritative information about a person, character, historical figure, or concept. Returns the article summary.',
  inputSchema: z.object({
    query: z.string().describe('The search query (person name, character name, etc.)'),
    lang: z.enum(['en', 'zh', 'ja']).default('en').describe('Wikipedia language'),
  }),
})

/** Execute Wikipedia search */
export async function executeWikipediaSearch(query: string, lang = 'en'): Promise<WikipediaResult[]> {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return []

  const searchData = (await searchRes.json()) as {
    query?: { search: { title: string; pageid: number }[] }
  }
  const pages = searchData.query?.search ?? []
  if (pages.length === 0) return []

  const results: WikipediaResult[] = []
  for (const page of pages.slice(0, 2)) {
    const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(page.title)}&format=json&origin=*`
    const extractRes = await fetch(extractUrl)
    if (!extractRes.ok) continue

    const extractData = (await extractRes.json()) as {
      query?: { pages: Record<string, { title: string; extract: string }> }
    }
    const pageData = Object.values(extractData.query?.pages ?? {})[0]
    if (pageData?.extract) {
      results.push({
        title: pageData.title,
        extract: pageData.extract.slice(0, 2000),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      })
    }
  }

  return results
}
