import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeWebSearch } from '../../src/agent/tools/web-search.js'

// Mock logger to avoid file writes during tests
vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('executeWebSearch (DuckDuckGo + Jina Reader)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('extracts URLs from DuckDuckGo and fetches via Jina Reader', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++
      // First call: DuckDuckGo
      if (typeof url === 'string' && url.includes('duckduckgo.com')) {
        return {
          ok: true,
          text: async () => `
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcyberpunk.fandom.com%2Fwiki%2FJohnny&rut=abc">Johnny</a>
          `,
        }
      }
      // Jina Reader call
      if (typeof url === 'string' && url.includes('r.jina.ai')) {
        return {
          ok: true,
          text: async () => 'Title: Johnny Silverhand\n\nURL Source: ...\n\nMarkdown Content:\n# Johnny Silverhand\n\nRockerboy and rebel veteran of the Fourth Corporate War.',
        }
      }
      return { ok: false }
    }) as unknown as typeof fetch

    const results = await executeWebSearch('Johnny Silverhand')

    expect(results.length).toBe(1)
    expect(results[0]!.url).toBe('https://cyberpunk.fandom.com/wiki/Johnny')
    expect(results[0]!.content).toContain('Rockerboy')
  })

  it('returns empty array on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch

    const results = await executeWebSearch('test')
    expect(results).toEqual([])
  })

  it('returns empty array for no results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body>No results</body></html>',
    }) as unknown as typeof fetch

    const results = await executeWebSearch('xyznonexistent')
    expect(results).toEqual([])
  })
})
