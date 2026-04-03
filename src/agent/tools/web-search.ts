import { tool } from 'ai'
import { z } from 'zod'
import type { SearchResult } from './tavily-search.js'
import { logger } from '../../utils/logger.js'

const JINA_READER_BASE = 'https://r.jina.ai'
const JINA_FETCH_TIMEOUT = 20000
const MAX_CONTENT_LENGTH = 3000

/** Tool schema for LLM (no execute — handled manually in agent loop) */
export const webSearchSchema = tool({
  description: 'Search the internet for information about a person, character, or topic. Returns relevant web pages with content.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
})

/**
 * Execute DuckDuckGo HTML search to get URLs, then fetch content via Jina Reader.
 */
export async function executeWebSearch(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`

  logger.debug('[web-search] DuckDuckGo query:', query)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    logger.warn('[web-search] DuckDuckGo fetch failed:', response.status)
    return []
  }

  const html = await response.text()
  const urls = extractDuckDuckGoUrls(html).slice(0, 5)
  logger.debug('[web-search] Extracted URLs:', urls.length, urls)

  if (urls.length === 0) return []

  // Fetch content via Jina Reader — try URLs until we have 3 successful results
  const results: SearchResult[] = []
  const MAX_RESULTS = 3

  for (const pageUrl of urls) {
    if (results.length >= MAX_RESULTS) break

    try {
      const content = await fetchViaJinaReader(pageUrl)
      if (content) {
        results.push({
          title: extractTitleFromContent(content, pageUrl),
          url: pageUrl,
          content,
        })
      }
    } catch (err) {
      logger.warn('[web-search] Jina Reader failed for', pageUrl, err)
    }
  }

  logger.debug('[web-search] Final results:', results.length)
  return results
}

/**
 * Extract URLs from DuckDuckGo HTML results.
 * Only extracts URLs — no snippet parsing needed.
 */
function extractDuckDuckGoUrls(html: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  // Match href in result links — DuckDuckGo wraps URLs in redirect
  const hrefPattern = /class="result__a"[^>]*href="([^"]*)"/g
  let match
  while ((match = hrefPattern.exec(html)) !== null) {
    const rawHref = match[1] ?? ''
    // Extract actual URL from DuckDuckGo redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
    const uddgMatch = rawHref.match(/uddg=([^&]+)/)
    if (uddgMatch) {
      const decoded = decodeURIComponent(uddgMatch[1]!)
      if (!seen.has(decoded)) {
        seen.add(decoded)
        urls.push(decoded)
      }
    }
  }

  return urls
}

/**
 * Fetch page content via Jina Reader API (free, no key needed).
 * Returns clean markdown content.
 */
async function fetchViaJinaReader(url: string): Promise<string | null> {
  const jinaUrl = `${JINA_READER_BASE}/${url}`
  logger.debug('[web-search] Jina Reader fetch:', url)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), JINA_FETCH_TIMEOUT)

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/markdown',
        'X-Retain-Images': 'none',
        'X-No-Cache': 'true',
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      logger.warn('[web-search] Jina Reader returned', response.status, 'for', url)
      return null
    }

    const text = await response.text()

    // Extract the Markdown Content section (skip title/URL header)
    const contentStart = text.indexOf('Markdown Content:')
    const content = contentStart !== -1 ? text.slice(contentStart + 17).trim() : text

    // Truncate
    if (content.length > MAX_CONTENT_LENGTH) {
      return content.slice(0, MAX_CONTENT_LENGTH)
    }

    logger.debug('[web-search] Jina Reader result:', url, '→', content.length, 'chars')
    return content || null
  } catch (err) {
    clearTimeout(timeout)
    logger.warn('[web-search] Jina Reader error:', url, err)
    return null
  }
}

function extractTitleFromContent(content: string, fallbackUrl: string): string {
  // Try to get first heading
  const headingMatch = content.match(/^#\s+(.+)/m)
  if (headingMatch) return headingMatch[1]!.trim()
  // Fallback to domain
  try {
    return new URL(fallbackUrl).hostname
  } catch {
    return fallbackUrl
  }
}
