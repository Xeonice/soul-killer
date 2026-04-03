import { describe, it, expect } from 'vitest'
import { webExtractionToChunks } from '../../src/ingest/web-adapter.js'

describe('webExtractionToChunks', () => {
  it('converts extractions to SoulChunks with web source', () => {
    const chunks = webExtractionToChunks([{
      content: 'Johnny Silverhand is a fictional character in Cyberpunk 2077.\n\nHe is a legendary rockerboy and rebel.',
      url: 'https://en.wikipedia.org/wiki/Johnny_Silverhand',
      searchQuery: 'Johnny Silverhand',
      extractionStep: 'gather_base',
    }])

    expect(chunks.length).toBe(2)
    expect(chunks[0]!.source).toBe('web')
    expect(chunks[0]!.metadata.url).toBe('https://en.wikipedia.org/wiki/Johnny_Silverhand')
    expect(chunks[0]!.metadata.extraction_step).toBe('gather_base')
  })

  it('deduplicates identical content', () => {
    const chunks = webExtractionToChunks([
      { content: 'Same content here for testing.', searchQuery: 'q1', extractionStep: 'identify' },
      { content: 'Same content here for testing.', searchQuery: 'q2', extractionStep: 'gather_base' },
    ])

    expect(chunks.length).toBe(1)
  })

  it('filters out short paragraphs', () => {
    const chunks = webExtractionToChunks([{
      content: 'Short.\n\nThis is a longer paragraph that should be included in the output.',
      searchQuery: 'test',
      extractionStep: 'identify',
    }])

    expect(chunks.length).toBe(1)
    expect(chunks[0]!.content).toContain('longer paragraph')
  })

  it('classifies chunk types by extraction step', () => {
    const chunks = webExtractionToChunks([
      { content: 'This is some factual knowledge about the person and their background.', searchQuery: 'q', extractionStep: 'identify' },
      { content: 'He said "Wake up samurai, we have a city to burn" in the famous scene.', searchQuery: 'q', extractionStep: 'gather_deep' },
      { content: 'MBTI analysis suggests this character has strong ENTJ personality traits.', searchQuery: 'q', extractionStep: 'personality' },
    ])

    expect(chunks[0]!.type).toBe('knowledge')
    expect(chunks[1]!.type).toBe('casual') // Contains quotes
    expect(chunks[2]!.type).toBe('reflection')
  })

  it('returns empty for empty input', () => {
    expect(webExtractionToChunks([])).toEqual([])
  })
})
