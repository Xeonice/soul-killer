import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractPageContent, extractPagesParallel } from '../../src/infra/search/page-extractor.js'

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Johnny Silverhand</title></head>
<body>
  <nav><a href="/">Home</a><a href="/wiki">Wiki</a></nav>
  <main>
    <article>
      <h1>Johnny Silverhand</h1>
      <p>Johnny Silverhand (born Robert John Linder) is a legendary rockerboy and the frontman of the band Samurai in the Cyberpunk universe.</p>
      <p>He is known for his rebellious nature, anti-corporate ideology, and his iconic silver cybernetic arm. Johnny is charismatic, aggressive, and deeply distrustful of authority.</p>
      <h2>Personality</h2>
      <p>Johnny is brash, impulsive, and fiercely independent. He has a sharp tongue and rarely holds back his opinions. His famous quote: "Wake up, samurai. We have a city to burn."</p>
    </article>
  </main>
  <footer><p>Copyright Fandom</p></footer>
</body>
</html>`

describe('extractPageContent', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('extracts main content from HTML and converts to Markdown', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => SAMPLE_HTML,
    }) as unknown as typeof fetch

    const content = await extractPageContent('https://cyberpunk.fandom.com/wiki/Johnny_Silverhand')

    expect(content).not.toBeNull()
    expect(content).toContain('Johnny Silverhand')
    expect(content).toContain('rockerboy')
    expect(content).toContain('Wake up, samurai')
    // Navigation should be stripped
    expect(content).not.toContain('Home')
    expect(content).not.toContain('Copyright Fandom')
  })

  it('returns null on fetch timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 100))
    ) as unknown as typeof fetch

    const content = await extractPageContent('https://slow-site.com')
    expect(content).toBeNull()
  })

  it('returns null for non-HTML content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/pdf']]),
      text: async () => '%PDF-1.4...',
    }) as unknown as typeof fetch

    const content = await extractPageContent('https://example.com/file.pdf')
    expect(content).toBeNull()
  })

  it('truncates content exceeding 3000 characters', async () => {
    const longContent = '<p>' + 'A'.repeat(5000) + '</p>'
    const longHtml = `<html><body><article>${longContent}</article></body></html>`

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => longHtml,
    }) as unknown as typeof fetch

    const content = await extractPageContent('https://example.com/long')

    expect(content).not.toBeNull()
    expect(content!.length).toBeLessThanOrEqual(3100) // 3000 + truncation notice
    expect(content).toContain('[内容已截断]')
  })

  it('returns null on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Map([['content-type', 'text/html']]),
    }) as unknown as typeof fetch

    const content = await extractPageContent('https://blocked-site.com')
    expect(content).toBeNull()
  })
})

describe('extractPagesParallel', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('extracts multiple URLs in parallel, partial failure does not block', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++
      if (url.includes('fail')) {
        return { ok: false, status: 500, headers: new Map([['content-type', 'text/html']]) }
      }
      return {
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => `<html><body><article><p>Content for ${url}</p></article></body></html>`,
      }
    }) as unknown as typeof fetch

    const results = await extractPagesParallel([
      'https://example.com/page1',
      'https://fail.com/page2',
      'https://example.com/page3',
    ])

    expect(results).toHaveLength(3)
    expect(results[0]!.content).toContain('page1')
    expect(results[1]!.content).toBeNull() // failed
    expect(results[2]!.content).toContain('page3')
  })
})
