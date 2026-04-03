import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import { t } from '../../i18n/index.js'

const MAX_CONTENT_LENGTH = 3000
const FETCH_TIMEOUT_MS = 5000

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

/**
 * Extract full page content from a URL.
 * Returns clean Markdown text, or null on failure.
 */
export async function extractPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Soulkiller/0.1)',
        'Accept': 'text/html',
      },
    })

    clearTimeout(timeout)

    // Skip non-HTML
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return null
    }

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Parse with jsdom
    const dom = new JSDOM(html, { url })

    // Extract main content with readability
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article || !article.content) {
      return null
    }

    // Convert to Markdown
    const markdown = turndown.turndown(article.content)

    // Truncate if needed
    if (markdown.length > MAX_CONTENT_LENGTH) {
      return markdown.slice(0, MAX_CONTENT_LENGTH) + `\n\n[${t('url.content_truncated')}]`
    }

    return markdown
  } catch {
    return null
  }
}

export interface PageExtractionResult {
  url: string
  content: string | null
}

/**
 * Extract content from multiple URLs in parallel.
 */
export async function extractPagesParallel(urls: string[]): Promise<PageExtractionResult[]> {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      content: await extractPageContent(url),
    }))
  )
  return results
}
