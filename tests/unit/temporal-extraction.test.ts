import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { extractTemporal, parseFrontmatterDate } from '../../src/ingest/markdown-adapter.js'
import { webExtractionToChunks } from '../../src/ingest/web-adapter.js'
import { MarkdownAdapter } from '../../src/ingest/markdown-adapter.js'
import { TwitterAdapter } from '../../src/ingest/twitter-adapter.js'

// ── helpers ──────────────────────────────────────────────────────────────────

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of iterable) results.push(item)
  return results
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

// ── Markdown temporal ────────────────────────────────────────────────────────

describe('parseFrontmatterDate', () => {
  it('extracts date from YAML frontmatter', () => {
    const content = '---\ntitle: Test\ndate: 2024-01-15\n---\n# Hello'
    expect(parseFrontmatterDate(content)).toBe('2024-01-15')
  })

  it('extracts date with quotes', () => {
    const content = '---\ndate: "2023-06-20"\n---\n# Hello'
    expect(parseFrontmatterDate(content)).toBe('2023-06-20')
  })

  it('returns undefined for no frontmatter', () => {
    expect(parseFrontmatterDate('# Just a heading\nContent.')).toBeUndefined()
  })

  it('returns undefined for frontmatter without date', () => {
    const content = '---\ntitle: No Date\ntags: [a, b]\n---\n# Hello'
    expect(parseFrontmatterDate(content)).toBeUndefined()
  })

  it('returns undefined for unclosed frontmatter', () => {
    const content = '---\ndate: 2024-01-01\n# No closing'
    expect(parseFrontmatterDate(content)).toBeUndefined()
  })
})

describe('extractTemporal', () => {
  const mtime = new Date('2025-03-10T12:00:00Z')

  it('prefers frontmatter date over filename and mtime', () => {
    const content = '---\ndate: 2024-01-15\n---\n# Hello'
    const result = extractTemporal(content, '2023-05-01-old.md', mtime)
    expect(result).toEqual({ date: '2024-01-15', confidence: 'exact' })
  })

  it('uses filename date pattern YYYY-MM-DD', () => {
    const result = extractTemporal('# Hello', '2024-01-15-my-thoughts.md', mtime)
    expect(result).toEqual({ date: '2024-01-15', confidence: 'exact' })
  })

  it('uses filename year-month pattern with inferred confidence', () => {
    const result = extractTemporal('# Hello', '2024-01-notes.md', mtime)
    expect(result).toEqual({ date: '2024-01-01', period: '2024-01', confidence: 'inferred' })
  })

  it('falls back to mtime with inferred confidence', () => {
    const result = extractTemporal('# Hello', 'random-name.md', mtime)
    expect(result).toEqual({ date: '2025-03-10', confidence: 'inferred' })
  })
})

describe('MarkdownAdapter temporal integration', () => {
  let tmpDir: string
  let adapter: MarkdownAdapter

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-temporal-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    adapter = new MarkdownAdapter()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('produces chunks with temporal field from frontmatter', async () => {
    writeFile(path.join(tmpDir, 'post.md'), '---\ndate: 2024-06-01\n---\n# Post\nContent here.')
    const chunks = await collect(adapter.adapt(tmpDir))
    expect(chunks[0]!.temporal).toEqual({ date: '2024-06-01', confidence: 'exact' })
  })

  it('produces chunks with temporal field from filename date', async () => {
    writeFile(path.join(tmpDir, '2023-12-25-christmas.md'), '# Xmas\nMerry Christmas.')
    const chunks = await collect(adapter.adapt(tmpDir))
    expect(chunks[0]!.temporal).toEqual({ date: '2023-12-25', confidence: 'exact' })
  })

  it('produces chunks with inferred temporal from mtime', async () => {
    writeFile(path.join(tmpDir, 'notes.md'), '# Notes\nSome notes.')
    const chunks = await collect(adapter.adapt(tmpDir))
    expect(chunks[0]!.temporal?.confidence).toBe('inferred')
    expect(chunks[0]!.temporal?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── Web adapter temporal ─────────────────────────────────────────────────────

describe('Web adapter temporal', () => {
  it('includes exact temporal when publishedDate is provided', () => {
    const chunks = webExtractionToChunks([{
      content: 'A long enough paragraph that exceeds the minimum twenty character threshold for inclusion.',
      url: 'https://example.com/article',
      searchQuery: 'test',
      extractionStep: 'identify',
      publishedDate: '2024-06-20T10:00:00Z',
    }])

    expect(chunks[0]!.temporal).toEqual({ date: '2024-06-20', confidence: 'exact' })
  })

  it('includes unknown temporal when no publishedDate', () => {
    const chunks = webExtractionToChunks([{
      content: 'A long enough paragraph that exceeds the minimum twenty character threshold for inclusion.',
      url: 'https://example.com/article',
      searchQuery: 'test',
      extractionStep: 'identify',
    }])

    expect(chunks[0]!.temporal).toEqual({ confidence: 'unknown' })
  })
})

// ── Twitter adapter temporal ─────────────────────────────────────────────────

describe('Twitter adapter temporal', () => {
  let tmpDir: string
  let adapter: TwitterAdapter

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-tw-temporal-${crypto.randomUUID()}`)
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true })
    adapter = new TwitterAdapter()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('produces chunks with exact temporal from tweet date', async () => {
    const tweetsJs = `window.YTD.tweet.part0 = ${JSON.stringify([
      { tweet: { id_str: '1', full_text: 'Hello world, this is a test tweet with enough text.', created_at: 'Wed Mar 15 12:00:00 +0000 2023' } },
    ])}`
    fs.writeFileSync(path.join(tmpDir, 'data', 'tweets.js'), tweetsJs)

    const chunks = await collect(adapter.adapt(tmpDir))
    expect(chunks[0]!.temporal).toEqual({ date: '2023-03-15', confidence: 'exact' })
  })
})
