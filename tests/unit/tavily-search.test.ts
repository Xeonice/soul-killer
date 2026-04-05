import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeTavilySearch } from '../../src/agent/tools/tavily-search.js'

describe('executeTavilySearch', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns search results on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { title: 'Johnny Silverhand', url: 'https://example.com/1', content: 'A fictional character' },
          { title: 'Cyberpunk 2077', url: 'https://example.com/2', content: 'A video game' },
        ],
      }),
    }) as unknown as typeof fetch

    const results = await executeTavilySearch('tvly-test-key', 'Johnny Silverhand')

    expect(results).toHaveLength(2)
    expect(results[0]!.title).toBe('Johnny Silverhand')
    expect(results[0]!.content).toBe('A fictional character')
  })

  it('throws on API error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    await expect(executeTavilySearch('bad-key', 'test')).rejects.toThrow('Tavily search failed: 401')
  })

  it('sends correct parameters', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }) as unknown as typeof fetch

    await executeTavilySearch('tvly-key', '强尼银手 是谁')

    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(callBody.query).toBe('强尼银手 是谁')
    expect(callBody.api_key).toBe('tvly-key')
    expect(callBody.max_results).toBe(10)
    expect(callBody.search_depth).toBe('advanced')
    expect(callBody.include_raw_content).toBe('markdown')
  })
})
