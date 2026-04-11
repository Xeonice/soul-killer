import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { generateText } from 'ai'
import { WorldDistiller } from '../../../src/world/distill.js'
import { createWorld } from '../../../src/world/manifest.js'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

let tmpDir: string
let origHome: string
let fixtureDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-review-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir

  fixtureDir = path.join(tmpDir, 'fixtures')
  fs.mkdirSync(fixtureDir, { recursive: true })
  fs.writeFileSync(
    path.join(fixtureDir, 'data.md'),
    '# Factions\n\nCao Wei was the strongest. Shu Han was founded by Liu Bei. Eastern Wu lasted longest.\n',
  )

  createWorld('test-world', 'Test', 'Test')
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

function setupMockForReview(reviewResponse: string) {
  let callIndex = 0
  const responses = [
    // classify: all as lore/factions
    JSON.stringify([
      { index: 0, scope: 'lore', dimension: 'factions' },
      { index: 1, scope: 'lore', dimension: 'factions' },
      { index: 2, scope: 'lore', dimension: 'factions' },
    ]),
    // extract: return 3 entries
    JSON.stringify([
      { name: 'entry-a', keywords: [], mode: 'keyword', priority: 500, content: 'Content A is detailed enough. It has multiple sentences. This explains the context and impact.' },
      { name: 'entry-b', keywords: [], mode: 'keyword', priority: 500, content: 'Content B is also detailed. It has several sentences explaining the topic thoroughly.' },
      { name: 'entry-c', keywords: [], mode: 'keyword', priority: 100, content: 'Short.' },
    ]),
    // review
    reviewResponse,
  ]
  vi.mocked(generateText).mockImplementation(async () => {
    return { text: responses[callIndex++] ?? '{}' } as any
  })
}

describe('WorldDistiller.reviewEntries', () => {
  it('deletes shallow entries identified by review', async () => {
    setupMockForReview(JSON.stringify({ merges: [], deletes: [2] }))
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    expect(entries.some((e) => e.meta.name === 'entry-c')).toBe(false)
    expect(entries.length).toBe(2)
  })

  it('merges duplicate entries identified by review', async () => {
    setupMockForReview(JSON.stringify({ merges: [[0, 1]], deletes: [] }))
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    const merged = entries.find((e) => e.meta.name === 'entry-a')
    expect(merged).toBeDefined()
    expect(merged!.content).toContain('Content A')
    expect(merged!.content).toContain('Content B')

    expect(entries.some((e) => e.meta.name === 'entry-b')).toBe(false)
  })

  it('gracefully handles review failure by returning entries unchanged', async () => {
    setupMockForReview('invalid json {{{}}}')
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    expect(entries.length).toBe(3)
  })
})
