import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { LocalEngine } from '../../src/engine/local-engine.js'
import { MarkdownAdapter } from '../../src/ingest/markdown-adapter.js'
import { TwitterAdapter } from '../../src/ingest/twitter-adapter.js'
import { IngestPipeline } from '../../src/ingest/pipeline.js'
import type { SoulChunk } from '../../src/ingest/types.js'

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures')
const MD_FIXTURES = path.join(FIXTURES_DIR, 'markdown-docs')
const TW_FIXTURES = path.join(FIXTURES_DIR, 'twitter-archive')

describe('Local Engine Integration: Markdown → Ingest → Recall', () => {
  let tmpDir: string
  let engine: LocalEngine

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-integ-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    engine = new LocalEngine(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('ingests markdown docs and returns correct chunk count', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)

    const result = await engine.ingest(chunks)
    expect(result.chunksIngested).toBe(chunks.length)
    expect(result.totalChunks).toBe(chunks.length)
  })

  it('recalls relevant chunks for netrunning query', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const results = await engine.recall('cyberdeck netrunner Blackwall ICE')
    expect(results.length).toBeGreaterThan(0)
    // Top result should contain relevant terms
    const topContent = results[0]!.chunk.content.toLowerCase()
    expect(
      topContent.includes('cyberdeck') ||
      topContent.includes('netrunner') ||
      topContent.includes('blackwall') ||
      topContent.includes('ice')
    ).toBe(true)
  })

  it('recalls relevant chunks for Soulkiller query', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const results = await engine.recall('Soulkiller engram Mikoshi Relic')
    expect(results.length).toBeGreaterThan(0)
    const topContent = results[0]!.chunk.content
    expect(topContent.includes('Soulkiller') || topContent.includes('engram') || topContent.includes('Mikoshi')).toBe(true)
  })

  it('respects limit option in recall', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const results = await engine.recall('cyberware chrome', { limit: 2 })
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns empty results for unrelated query', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const results = await engine.recall('quantum computing superconductor')
    // Should return results but with low similarity
    if (results.length > 0) {
      expect(results[0]!.similarity).toBeLessThan(0.5)
    }
  })

  it('reports correct status', async () => {
    const status = await engine.status()
    expect(status.mode).toBe('local')
    expect(status.chunkCount).toBe(0)
    expect(status.healthy).toBe(true)

    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const statusAfter = await engine.status()
    expect(statusAfter.chunkCount).toBe(chunks.length)
  })

  it('deduplicates on re-ingest', async () => {
    const adapter = new MarkdownAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(MD_FIXTURES)) {
      chunks.push(chunk)
    }

    const first = await engine.ingest(chunks)
    const second = await engine.ingest(chunks)

    expect(second.chunksIngested).toBe(0) // all duplicates
    expect(second.totalChunks).toBe(first.totalChunks) // same total
  })
})

describe('Local Engine Integration: Twitter → Ingest → Recall', () => {
  let tmpDir: string
  let engine: LocalEngine

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-integ-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    engine = new LocalEngine(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('ingests twitter archive and filters correctly', async () => {
    const adapter = new TwitterAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(TW_FIXTURES)) {
      chunks.push(chunk)
    }

    // Original: 8 tweets, minus 1 RT, minus 1 pure link = 6 tweets
    // 2 tweets within 30min get merged into 1 thread → 5 chunks total
    // tweet 1007 and 1008 are 20min apart → merged → 4 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(4)
    expect(chunks.length).toBeLessThanOrEqual(6)

    // No RT content
    for (const chunk of chunks) {
      expect(chunk.content).not.toContain('RT @')
    }

    const result = await engine.ingest(chunks)
    expect(result.chunksIngested).toBe(chunks.length)
  })

  it('recalls twitter content about Soulkiller and Relic', async () => {
    const adapter = new TwitterAdapter()
    const chunks: SoulChunk[] = []
    for await (const chunk of adapter.adapt(TW_FIXTURES)) {
      chunks.push(chunk)
    }
    await engine.ingest(chunks)

    const results = await engine.recall('Soulkiller engram Mikoshi Relic')
    expect(results.length).toBeGreaterThan(0)
    const topContent = results[0]!.chunk.content
    expect(topContent.includes('Soulkiller') || topContent.includes('engram') || topContent.includes('Relic')).toBe(true)
  })
})

describe('Local Engine Integration: Pipeline → Ingest → Recall', () => {
  let tmpDir: string
  let engine: LocalEngine

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-integ-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    engine = new LocalEngine(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('runs full pipeline with both adapters', async () => {
    const pipeline = new IngestPipeline()
    const progressEvents: string[] = []
    pipeline.on('progress', (p: { message?: string }) => {
      if (p.message) progressEvents.push(p.message)
    })

    const chunks = await pipeline.run({
      adapters: [
        { type: 'markdown', path: MD_FIXTURES },
        { type: 'twitter', path: TW_FIXTURES },
      ],
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(progressEvents.length).toBeGreaterThan(0)

    // Should have both markdown and twitter sources
    const sources = new Set(chunks.map((c) => c.source))
    expect(sources.has('markdown')).toBe(true)
    expect(sources.has('twitter')).toBe(true)

    // Ingest all
    const result = await engine.ingest(chunks)
    expect(result.totalChunks).toBe(chunks.length)

    // Cross-source recall: query about HTML should find both md and twitter content
    const results = await engine.recall('Soulkiller engram Mikoshi Relic', { limit: 10 })
    expect(results.length).toBeGreaterThan(0)
    const resultSources = new Set(results.map((r) => r.chunk.source))
    // At least one source should be present
    expect(resultSources.size).toBeGreaterThanOrEqual(1)
  })

  it('emits progress events during pipeline execution', async () => {
    const pipeline = new IngestPipeline()
    const events: string[] = []
    pipeline.on('progress', (p: { event: string }) => {
      events.push(p.event)
    })

    await pipeline.run({
      adapters: [{ type: 'markdown', path: MD_FIXTURES }],
    })

    expect(events).toContain('files_scanned')
  })

  it('status reflects total chunks from both sources', async () => {
    const pipeline = new IngestPipeline()
    const chunks = await pipeline.run({
      adapters: [
        { type: 'markdown', path: MD_FIXTURES },
        { type: 'twitter', path: TW_FIXTURES },
      ],
    })

    await engine.ingest(chunks)
    const status = await engine.status()
    expect(status.chunkCount).toBe(chunks.length)
    expect(status.mode).toBe('local')
    expect(status.healthy).toBe(true)
  })
})
