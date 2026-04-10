import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { MarkdownAdapter } from '../../src/infra/ingest/markdown-adapter.js'

// ── helpers ───────────────────────────────────────────────────────────────────

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of iterable) {
    results.push(item)
  }
  return results
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('MarkdownAdapter', () => {
  let tmpDir: string
  let adapter: MarkdownAdapter

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-md-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    adapter = new MarkdownAdapter()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── heading splitting ──────────────────────────────────────────────────────

  describe('splitting by headings', () => {
    it('splits content at h1 headings into separate chunks', async () => {
      writeFile(path.join(tmpDir, 'doc.md'), [
        '# First',
        'Content of first section.',
        '',
        '# Second',
        'Content of second section.',
      ].join('\n'))

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(2)
      expect(chunks[0]!.content).toContain('First')
      expect(chunks[0]!.content).toContain('Content of first section.')
      expect(chunks[1]!.content).toContain('Second')
      expect(chunks[1]!.content).toContain('Content of second section.')
    })

    it('splits content at h2 headings into separate chunks', async () => {
      writeFile(path.join(tmpDir, 'doc.md'), [
        '## Alpha',
        'Alpha content.',
        '',
        '## Beta',
        'Beta content.',
      ].join('\n'))

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(2)
      expect(chunks[0]!.content).toContain('Alpha')
      expect(chunks[1]!.content).toContain('Beta')
    })

    it('handles a mix of h1 and h2 headings', async () => {
      writeFile(path.join(tmpDir, 'doc.md'), [
        '# Top level',
        'Top content.',
        '',
        '## Sub level',
        'Sub content.',
      ].join('\n'))

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(2)
    })

    it('prefixes each chunk content with the heading', async () => {
      writeFile(path.join(tmpDir, 'doc.md'), [
        '# My Heading',
        'Body text.',
      ].join('\n'))

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.content).toMatch(/^## My Heading/)
    })
  })

  // ── metadata extraction ────────────────────────────────────────────────────

  describe('metadata extraction', () => {
    it('includes the relative file path in metadata', async () => {
      writeFile(path.join(tmpDir, 'notes.md'), '# A\nsome content')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.metadata?.file).toBe('notes.md')
    })

    it('derives the topic tag from the subdirectory name', async () => {
      writeFile(path.join(tmpDir, 'work', 'tasks.md'), '# Task\ndo something')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.metadata?.topic).toBe('work')
    })

    it('sets topic to undefined for files at the root level', async () => {
      writeFile(path.join(tmpDir, 'root.md'), '# Root\ncontent here')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.metadata?.topic).toBeUndefined()
    })

    it('joins nested directory names with dots for topic', async () => {
      writeFile(path.join(tmpDir, 'work', 'projects', 'deep.md'), '# Deep\ndeep content')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.metadata?.topic).toBe('work.projects')
    })

    it('sets source to "markdown"', async () => {
      writeFile(path.join(tmpDir, 'a.md'), '# X\ncontent')
      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.source).toBe('markdown')
    })

    it('assigns a 16-character hex id to each chunk', async () => {
      writeFile(path.join(tmpDir, 'a.md'), '# X\ncontent')
      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.id).toMatch(/^[0-9a-f]{16}$/)
    })

    it('produces stable ids (same file → same id across runs)', async () => {
      writeFile(path.join(tmpDir, 'stable.md'), '# Title\nstable content')
      const first = await collect(adapter.adapt(tmpDir))
      const second = await collect(adapter.adapt(tmpDir))
      expect(first[0]!.id).toBe(second[0]!.id)
    })
  })

  // ── no headings ────────────────────────────────────────────────────────────

  describe('files with no headings', () => {
    it('treats the entire file as a single chunk', async () => {
      writeFile(path.join(tmpDir, 'plain.md'), [
        'Line one.',
        'Line two.',
        'Line three.',
      ].join('\n'))

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.content).toContain('Line one.')
      expect(chunks[0]!.content).toContain('Line three.')
    })

    it('chunk from headingless file has an empty heading in metadata', async () => {
      writeFile(path.join(tmpDir, 'plain.md'), 'Just text.')
      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks[0]!.metadata?.heading).toBe('')
    })
  })

  // ── empty files ────────────────────────────────────────────────────────────

  describe('empty files', () => {
    it('produces no chunks for a completely empty file', async () => {
      writeFile(path.join(tmpDir, 'empty.md'), '')
      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(0)
    })

    it('produces no chunks for a file containing only whitespace', async () => {
      writeFile(path.join(tmpDir, 'blank.md'), '   \n\n   ')
      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(0)
    })
  })

  // ── multi-file directory ───────────────────────────────────────────────────

  describe('scanning multiple files', () => {
    it('yields chunks from all markdown files in the directory', async () => {
      writeFile(path.join(tmpDir, 'a.md'), '# A\ncontent a')
      writeFile(path.join(tmpDir, 'b.md'), '# B\ncontent b')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(2)
    })

    it('ignores non-markdown files', async () => {
      writeFile(path.join(tmpDir, 'doc.md'), '# Doc\ncontent')
      writeFile(path.join(tmpDir, 'readme.txt'), 'plain text file')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(1)
    })

    it('ignores hidden directories', async () => {
      writeFile(path.join(tmpDir, '.hidden', 'secret.md'), '# Secret\nhidden')
      writeFile(path.join(tmpDir, 'visible.md'), '# Visible\npublic')

      const chunks = await collect(adapter.adapt(tmpDir))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.metadata?.file).toBe('visible.md')
    })
  })
})
