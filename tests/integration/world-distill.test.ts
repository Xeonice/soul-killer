import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { generateText } from 'ai'
import { WorldDistiller, type GeneratedEntry } from '../../src/world/distill.js'
import { createWorld, loadWorld, deleteWorld } from '../../src/world/manifest.js'
import { loadAllEntries } from '../../src/world/entry.js'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

let tmpDir: string
let origHome: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-distill-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

// Mock generateText that returns predictable classifications and entries
function setupMockClient() {
  let callCount = 0
  vi.mocked(generateText).mockImplementation(async (opts: any) => {
    callCount++
    const messages = opts.messages ?? []
    const systemMsg = messages[0]?.content ?? ''

    if (systemMsg.includes('classifier')) {
      const userContent = messages[1]?.content ?? ''
      const indices = [...userContent.matchAll(/\[(\d+)\]/g)].map((m: any) => parseInt(m[1]))
      const result = indices.map((i: number) => ({ index: i, scope: 'lore' }))
      return { text: JSON.stringify(result) } as any
    }

    if (systemMsg.includes('entry generator')) {
      return {
        text: JSON.stringify([{
          name: `generated-entry-${callCount}`,
          keywords: ['test', 'keyword'],
          mode: 'keyword',
          priority: 500,
          content: 'Generated world entry content from distillation. This is a detailed entry with multiple sentences explaining the context and significance.',
        }]),
      } as any
    }

    if (systemMsg.includes('editor')) {
      return { text: JSON.stringify({ merges: [], deletes: [] }) } as any
    }

    return { text: '{}' } as any
  })
}

describe('WorldDistiller', () => {
  it('distills entries from markdown source and writes them', async () => {
    // Setup: create world and test fixture
    createWorld('distill-test', 'Test World', 'For distill testing')

    const fixtureDir = path.join(tmpDir, 'fixtures')
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(
      path.join(fixtureDir, 'lore.md'),
      '# Night City History\n\nNight City was founded in 1994 by Richard Night.\n\n## Corporations\n\nArasaka and Militech dominate the city.\n',
    )

    setupMockClient()
    const distiller = new WorldDistiller({} as any)

    const progressEvents: string[] = []
    distiller.on('progress', (p: any) => progressEvents.push(p.phase))

    const entries = await distiller.distill('distill-test', fixtureDir, 'markdown')

    expect(entries.length).toBeGreaterThan(0)
    expect(progressEvents).toContain('ingest')
    expect(progressEvents).toContain('classify')
    expect(progressEvents).toContain('cluster')
    expect(progressEvents).toContain('extract')
    expect(progressEvents).toContain('review')

    // Write entries
    await distiller.writeEntries('distill-test', entries)
    const stored = loadAllEntries('distill-test')
    expect(stored.length).toBe(entries.length)

    // Verify manifest entry_count updated
    const manifest = loadWorld('distill-test')
    expect(manifest!.entry_count).toBe(entries.length)
  })

  it('uses custom dimensions from manifest for classify', async () => {
    createWorld('dim-test', 'Dim World', 'Custom dimensions')

    // Write custom dimensions to manifest (simulating Planning Agent output)
    const manifest = loadWorld('dim-test')!
    manifest.dimensions = [
      { name: 'geography', display: '地理', description: 'Locations', priority: 'required', source: 'planned', signals: ['location'], queries: [], distillTarget: 'background' },
      { name: 'military', display: '军事', description: 'Military strategy', priority: 'important', source: 'planned', signals: ['battle', '战役'], queries: [], distillTarget: 'lore' },
    ] as any
    const { saveWorld: save } = await import('../../src/world/manifest.js')
    save(manifest)

    const fixtureDir = path.join(tmpDir, 'dim-fixtures')
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(path.join(fixtureDir, 'data.md'), '# Battle\n\nThe battle of Chibi was decisive.\n')

    setupMockClient()
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('dim-test', fixtureDir, 'markdown')
    expect(entries.length).toBeGreaterThan(0)

    // Verify manifest still has dimensions after distill
    const updated = loadWorld('dim-test')!
    expect(updated.dimensions).toBeDefined()
    expect(updated.dimensions!.length).toBe(2)
    expect(updated.dimensions!.some((d: any) => d.name === 'military')).toBe(true)
  })

  it('evolve adds new entries and bumps version', async () => {
    createWorld('evolve-test', 'Evolve World', 'For evolve testing')

    // Add an existing entry
    const { addEntry } = await import('../../src/world/entry.js')
    addEntry('evolve-test', {
      name: 'existing-entry',
      keywords: ['existing'],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
    }, 'Existing content')

    const fixtureDir = path.join(tmpDir, 'evolve-fixtures')
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(path.join(fixtureDir, 'new-data.md'), '# New Data\n\nSome new world information.\n')

    setupMockClient()
    const distiller = new WorldDistiller({} as any)

    const { newEntries, conflicts } = await distiller.evolve('evolve-test', fixtureDir, 'markdown')

    // New entries should not conflict with existing
    expect(newEntries.length).toBeGreaterThan(0)

    // Finalize evolve
    await distiller.finalizeEvolve('evolve-test', newEntries)

    const manifest = loadWorld('evolve-test')
    expect(manifest!.version).toBe('0.1.1')  // Bumped from 0.1.0
    expect(manifest!.entry_count).toBeGreaterThan(1)  // Original + new
  })
})
