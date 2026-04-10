import { describe, it, expect, vi } from 'vitest'
import { generateText } from 'ai'
import { emptyTagSet, getTagAnchors } from '../../src/soul/tags/taxonomy.js'
import { parseTags } from '../../src/soul/tags/parser.js'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

describe('parseTags', () => {
  it('returns empty TagSet for empty input', async () => {
    const result = await parseTags('', {} as any)
    expect(result).toEqual(emptyTagSet())
    // Should not call LLM for empty input
    expect(generateText).not.toHaveBeenCalled()
  })

  it('returns empty TagSet for whitespace-only input', async () => {
    const result = await parseTags('   ', {} as any)
    expect(result).toEqual(emptyTagSet())
  })

  it('parses LLM JSON response into TagSet', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify({
      personality: ['INTJ'],
      communication: ['话少', '冷幽默'],
      values: [],
      behavior: ['技术洁癖'],
      domain: [],
    }) } as any)

    const result = await parseTags('INTJ 话少 冷幽默 技术洁癖', {} as any)
    expect(result.personality).toEqual(['INTJ'])
    expect(result.communication).toEqual(['话少', '冷幽默'])
    expect(result.behavior).toEqual(['技术洁癖'])
    expect(result.values).toEqual([])
    expect(result.domain).toEqual([])
  })

  it('handles JSON wrapped in markdown code blocks', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: '```json\n{"personality": ["ENFP"], "communication": [], "values": [], "behavior": [], "domain": []}\n```' } as any)

    const result = await parseTags('ENFP', {} as any)
    expect(result.personality).toEqual(['ENFP'])
  })

  it('returns empty TagSet on LLM error', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API error'))

    const result = await parseTags('something', {} as any)
    expect(result).toEqual(emptyTagSet())
  })

  it('filters out non-string values from LLM response', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify({
      personality: ['INTJ', 123, null, 'ENFP'],
      communication: [],
      values: [],
      behavior: [],
      domain: [],
    }) } as any)

    const result = await parseTags('INTJ ENFP', {} as any)
    expect(result.personality).toEqual(['INTJ', 'ENFP'])
  })
})

describe('getTagAnchors', () => {
  it('has all 5 categories', () => {
    expect(Object.keys(getTagAnchors())).toEqual([
      'personality', 'communication', 'values', 'behavior', 'domain',
    ])
  })

  it('each category has at least 5 anchor tags', () => {
    for (const [, tags] of Object.entries(getTagAnchors())) {
      expect(tags.length).toBeGreaterThanOrEqual(5)
    }
  })
})
