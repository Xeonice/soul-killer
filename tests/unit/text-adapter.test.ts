import { describe, it, expect } from 'vitest'
import { textToChunks } from '../../src/infra/ingest/text-adapter.js'

describe('textToChunks', () => {
  it('converts a simple text to a single chunk', () => {
    const chunks = textToChunks('Hello world, this is some text.', 'test-soul')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.source).toBe('user-input')
    expect(chunks[0]!.type).toBe('knowledge')
    expect(chunks[0]!.content).toBe('Hello world, this is some text.')
    expect(chunks[0]!.temporal).toEqual({ confidence: 'unknown' })
  })

  it('splits by paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const chunks = textToChunks(text, 'test-soul')
    expect(chunks).toHaveLength(3)
    expect(chunks[0]!.content).toBe('First paragraph.')
    expect(chunks[2]!.content).toBe('Third paragraph.')
  })

  it('returns empty for empty/whitespace input', () => {
    expect(textToChunks('', 'soul')).toEqual([])
    expect(textToChunks('   \n\n   ', 'soul')).toEqual([])
  })

  it('splits long paragraphs at sentence boundaries', () => {
    const longText = '这是一段很长的文字。'.repeat(250) // ~2500 chars
    const chunks = textToChunks(longText, 'test-soul')
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(2100) // some tolerance
    }
  })

  it('generates stable ids for same content', () => {
    const a = textToChunks('Same content here.', 'soul')
    const b = textToChunks('Same content here.', 'soul')
    expect(a[0]!.id).toBe(b[0]!.id)
  })

  it('metadata includes text-input origin', () => {
    const chunks = textToChunks('Test content.', 'soul')
    expect(chunks[0]!.metadata.origin).toBe('text-input')
  })
})
