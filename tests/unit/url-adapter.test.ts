import { describe, it, expect } from 'vitest'
import { urlResultToChunks, type UrlExtractionResult } from '../../src/infra/ingest/url-adapter.js'

describe('urlResultToChunks', () => {
  it('converts successful extraction to chunks', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com/article',
      title: 'Test Article',
      content: 'First paragraph with enough text to pass threshold.\n\nSecond paragraph also with enough text to pass.',
    }

    const chunks = urlResultToChunks(result)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.source).toBe('web')
    expect(chunks[0]!.metadata.url).toBe('https://example.com/article')
    expect(chunks[0]!.metadata.title).toBe('Test Article')
    expect(chunks[0]!.type).toBe('knowledge')
  })

  it('returns empty for null content', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com/fail',
      content: null,
      error: 'HTTP 403',
    }

    expect(urlResultToChunks(result)).toEqual([])
  })

  it('filters out short paragraphs', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: 'Short.\n\nThis is a longer paragraph that should be included in the final output.',
    }

    const chunks = urlResultToChunks(result)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content).toContain('longer paragraph')
  })

  it('deduplicates identical paragraphs', () => {
    const repeated = 'This is a paragraph that appears twice and is long enough.'
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: `${repeated}\n\n${repeated}`,
    }

    const chunks = urlResultToChunks(result)
    expect(chunks).toHaveLength(1)
  })

  it('includes exact temporal when publishedDate is provided', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: 'A long enough paragraph for temporal metadata testing.',
      publishedDate: '2024-06-20',
    }

    const chunks = urlResultToChunks(result)
    expect(chunks[0]!.temporal).toEqual({ date: '2024-06-20', confidence: 'exact' })
  })

  it('includes unknown temporal when no publishedDate', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: 'A long enough paragraph for temporal metadata testing.',
    }

    const chunks = urlResultToChunks(result)
    expect(chunks[0]!.temporal).toEqual({ confidence: 'unknown' })
  })

  it('generates stable ids for same content', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: 'Deterministic content for ID stability test.',
    }

    const a = urlResultToChunks(result)
    const b = urlResultToChunks(result)
    expect(a[0]!.id).toBe(b[0]!.id)
  })

  it('chunk ids start with url- prefix', () => {
    const result: UrlExtractionResult = {
      url: 'https://example.com',
      content: 'Content for ID prefix verification test.',
    }

    const chunks = urlResultToChunks(result)
    expect(chunks[0]!.id).toMatch(/^url-/)
  })
})
