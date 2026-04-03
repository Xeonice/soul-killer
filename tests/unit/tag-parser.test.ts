import { describe, it, expect, vi } from 'vitest'
import { emptyTagSet, getTagAnchors } from '../../src/tags/taxonomy.js'
import { parseTags } from '../../src/tags/parser.js'

function mockClient(response: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: response } }],
        }),
      },
    },
  } as any
}

describe('parseTags', () => {
  it('returns empty TagSet for empty input', async () => {
    const client = mockClient('{}')
    const result = await parseTags('', client, 'test-model')
    expect(result).toEqual(emptyTagSet())
    // Should not call LLM for empty input
    expect(client.chat.completions.create).not.toHaveBeenCalled()
  })

  it('returns empty TagSet for whitespace-only input', async () => {
    const client = mockClient('{}')
    const result = await parseTags('   ', client, 'test-model')
    expect(result).toEqual(emptyTagSet())
  })

  it('parses LLM JSON response into TagSet', async () => {
    const client = mockClient(JSON.stringify({
      personality: ['INTJ'],
      communication: ['话少', '冷幽默'],
      values: [],
      behavior: ['技术洁癖'],
      domain: [],
    }))

    const result = await parseTags('INTJ 话少 冷幽默 技术洁癖', client, 'test-model')
    expect(result.personality).toEqual(['INTJ'])
    expect(result.communication).toEqual(['话少', '冷幽默'])
    expect(result.behavior).toEqual(['技术洁癖'])
    expect(result.values).toEqual([])
    expect(result.domain).toEqual([])
  })

  it('handles JSON wrapped in markdown code blocks', async () => {
    const client = mockClient('```json\n{"personality": ["ENFP"], "communication": [], "values": [], "behavior": [], "domain": []}\n```')

    const result = await parseTags('ENFP', client, 'test-model')
    expect(result.personality).toEqual(['ENFP'])
  })

  it('returns empty TagSet on LLM error', async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('API error')),
        },
      },
    } as any

    const result = await parseTags('something', client, 'test-model')
    expect(result).toEqual(emptyTagSet())
  })

  it('filters out non-string values from LLM response', async () => {
    const client = mockClient(JSON.stringify({
      personality: ['INTJ', 123, null, 'ENFP'],
      communication: [],
      values: [],
      behavior: [],
      domain: [],
    }))

    const result = await parseTags('INTJ ENFP', client, 'test-model')
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
