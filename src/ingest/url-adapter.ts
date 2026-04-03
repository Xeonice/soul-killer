import crypto from 'node:crypto'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import type { SoulChunk, ChunkTemporal } from './types.js'
import { t } from '../i18n/index.js'

const FETCH_TIMEOUT_MS = 8000
const MAX_CONTENT_LENGTH = 5000

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

export interface UrlExtractionResult {
  url: string
  title?: string
  content: string | null
  publishedDate?: string
  error?: string
}

/**
 * Fetch a URL and extract main content + metadata.
 */
export async function extractUrl(url: string): Promise<UrlExtractionResult> {
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

    if (!response.ok) {
      return { url, content: null, error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return { url, content: null, error: 'Not HTML' }
    }

    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document

    // Extract published date from meta tags
    const publishedDate = extractPublishedDate(doc)

    // Extract main content with Readability
    const reader = new Readability(doc)
    const article = reader.parse()

    if (!article?.content) {
      return { url, content: null, error: t('url.error.no_content') }
    }

    let markdown = turndown.turndown(article.content)
    if (markdown.length > MAX_CONTENT_LENGTH) {
      markdown = markdown.slice(0, MAX_CONTENT_LENGTH) + `\n\n[${t('url.content_truncated')}]`
    }

    return {
      url,
      title: article.title || undefined,
      content: markdown,
      publishedDate,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { url, content: null, error: msg }
  }
}

/**
 * Extract published date from HTML document metadata.
 * Tries: article:published_time meta → <time datetime> → datePublished JSON-LD
 */
function extractPublishedDate(doc: Document): string | undefined {
  // 1. OpenGraph article:published_time
  const ogDate = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
  if (ogDate) return ogDate.slice(0, 10)

  // 2. <time datetime="...">
  const timeEl = doc.querySelector('time[datetime]')
  const datetime = timeEl?.getAttribute('datetime')
  if (datetime) {
    const match = datetime.match(/\d{4}-\d{2}-\d{2}/)
    if (match) return match[0]
  }

  // 3. JSON-LD datePublished
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const script of ldScripts) {
    try {
      const data = JSON.parse(script.textContent ?? '')
      if (data.datePublished) {
        const match = String(data.datePublished).match(/\d{4}-\d{2}-\d{2}/)
        if (match) return match[0]
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  return undefined
}

/**
 * Convert URL extraction results to SoulChunks.
 */
export function urlResultToChunks(result: UrlExtractionResult): SoulChunk[] {
  if (!result.content) return []

  const paragraphs = result.content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20)

  const temporal: ChunkTemporal = result.publishedDate
    ? { date: result.publishedDate, confidence: 'exact' }
    : { confidence: 'unknown' }

  const chunks: SoulChunk[] = []
  const seen = new Set<string>()

  for (const paragraph of paragraphs) {
    const hash = crypto.createHash('sha256').update(paragraph).digest('hex').slice(0, 16)
    if (seen.has(hash)) continue
    seen.add(hash)

    chunks.push({
      id: `url-${hash}`,
      source: 'web',
      content: paragraph,
      timestamp: new Date().toISOString(),
      context: 'public',
      type: 'knowledge',
      metadata: {
        url: result.url,
        title: result.title,
      },
      temporal,
    })
  }

  return chunks
}
