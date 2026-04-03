import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeWebSearch } from '../../src/agent/tools/web-search.js'

vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

/**
 * Tests that DuckDuckGo URLs get enriched with Jina Reader content.
 */
describe('WebSearch with Jina Reader enrichment', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const DUCKDUCKGO_HTML = `
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcyberpunk.fandom.com%2Fwiki%2FJohnny_Silverhand&rut=abc">Johnny Silverhand | Fandom</a>
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FJohnny&rut=def">Johnny Silverhand - Wikipedia</a>
  `

  it('fetches content via Jina Reader for extracted URLs', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString()

      if (urlStr.includes('duckduckgo.com/html')) {
        return { ok: true, text: async () => DUCKDUCKGO_HTML }
      }

      // Jina Reader for fandom
      if (urlStr.includes('r.jina.ai') && urlStr.includes('fandom.com')) {
        return {
          ok: true,
          text: async () => 'Title: Johnny Silverhand\n\nMarkdown Content:\n# Johnny Silverhand\n\nJohnny Silverhand (born Robert John Linder) is a legendary rockerboy. His famous line: "Wake up, samurai."',
        }
      }

      // Jina Reader for wikipedia
      if (urlStr.includes('r.jina.ai') && urlStr.includes('wikipedia.org')) {
        return {
          ok: true,
          text: async () => 'Title: Johnny\n\nMarkdown Content:\n# Johnny Silverhand\n\nA character in Cyberpunk 2077.',
        }
      }

      return { ok: false, status: 404 }
    }) as unknown as typeof fetch

    const results = await executeWebSearch('Johnny Silverhand character')

    expect(results.length).toBe(2)

    const fandomResult = results.find((r) => r.url.includes('fandom.com'))
    expect(fandomResult).toBeDefined()
    expect(fandomResult!.content).toContain('rockerboy')
    expect(fandomResult!.content).toContain('Wake up, samurai')
  })

  it('skips URLs where Jina Reader fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString()

      if (urlStr.includes('duckduckgo.com/html')) {
        return {
          ok: true,
          text: async () => `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=x">Example</a>`,
        }
      }

      // Jina Reader fails
      return { ok: false, status: 500 }
    }) as unknown as typeof fetch

    const results = await executeWebSearch('test query')
    expect(results).toEqual([])
  })
})
