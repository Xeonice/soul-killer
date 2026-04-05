import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  parseFrontmatter,
  serializeFrontmatter,
  addEntry,
  loadEntry,
  loadAllEntries,
  removeEntry,
  type EntryMeta,
} from '../../src/world/entry.js'
import { createWorld } from '../../src/world/manifest.js'

let tmpDir: string
let origHome: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('parseFrontmatter', () => {
  it('parses frontmatter with all field types', () => {
    const input = `---
name: megacorps
keywords: ["荒坂", "Arasaka"]
priority: 100
mode: keyword
scope: lore
---

Some content here.`

    const { meta, body } = parseFrontmatter(input)
    expect(meta.name).toBe('megacorps')
    expect(meta.keywords).toEqual(['荒坂', 'Arasaka'])
    expect(meta.priority).toBe(100)
    expect(meta.mode).toBe('keyword')
    expect(body).toBe('Some content here.')
  })

  it('returns empty meta when no frontmatter', () => {
    const { meta, body } = parseFrontmatter('Just plain text')
    expect(meta).toEqual({})
    expect(body).toBe('Just plain text')
  })

  it('handles empty keywords array', () => {
    const input = `---
name: core-rules
keywords: []
mode: always
---

Rules.`
    const { meta } = parseFrontmatter(input)
    expect(meta.keywords).toEqual([])
  })

  it('handles boolean values', () => {
    const input = `---
active: true
disabled: false
---

Body.`
    const { meta } = parseFrontmatter(input)
    expect(meta.active).toBe(true)
    expect(meta.disabled).toBe(false)
  })
})

describe('serializeFrontmatter', () => {
  it('produces valid frontmatter markdown', () => {
    const meta: EntryMeta = {
      name: 'megacorps',
      keywords: ['荒坂', 'Arasaka'],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
    }
    const result = serializeFrontmatter(meta, 'Content here.')
    expect(result).toContain('---')
    expect(result).toContain('name: megacorps')
    expect(result).toContain('keywords: ["荒坂", "Arasaka"]')
    expect(result).toContain('Content here.')
  })
})

describe('Entry CRUD', () => {
  const meta: EntryMeta = {
    name: 'megacorps',
    keywords: ['荒坂'],
    priority: 100,
    mode: 'keyword',
    scope: 'lore',
  }

  it('adds and loads an entry', () => {
    createWorld('test-world', 'Test', 'desc')
    addEntry('test-world', meta, '超企背景内容')

    const entry = loadEntry('test-world', 'megacorps')
    expect(entry).not.toBeNull()
    expect(entry!.meta.name).toBe('megacorps')
    expect(entry!.meta.mode).toBe('keyword')
    expect(entry!.content).toBe('超企背景内容')
  })

  it('loads all entries', () => {
    createWorld('test-world', 'Test', 'desc')
    addEntry('test-world', meta, 'Content 1')
    addEntry('test-world', { ...meta, name: 'cyberware' }, 'Content 2')

    const entries = loadAllEntries('test-world')
    expect(entries).toHaveLength(2)
  })

  it('removes an entry', () => {
    createWorld('test-world', 'Test', 'desc')
    addEntry('test-world', meta, 'Content')
    removeEntry('test-world', 'megacorps')
    expect(loadEntry('test-world', 'megacorps')).toBeNull()
  })

  it('returns empty array for world with no entries', () => {
    createWorld('empty-world', 'Empty', 'desc')
    expect(loadAllEntries('empty-world')).toEqual([])
  })
})
