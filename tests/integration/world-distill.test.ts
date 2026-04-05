import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { WorldDistiller, type GeneratedEntry } from '../../src/world/distill.js'
import { createWorld, loadWorld, deleteWorld } from '../../src/world/manifest.js'
import { loadAllEntries } from '../../src/world/entry.js'

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

// Mock OpenAI client that returns predictable classifications and entries
function createMockClient() {
  let callCount = 0
  return {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          callCount++
          const systemMsg = messages[0]?.content ?? ''

          if (systemMsg.includes('classifier')) {
            // Classification phase — classify all as lore
            const userContent = messages[1]?.content ?? ''
            const indices = [...userContent.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1]))
            const result = indices.map(i => ({ index: i, scope: 'lore' }))
            return { choices: [{ message: { content: JSON.stringify(result) } }] }
          }

          if (systemMsg.includes('entry generator')) {
            // Extract phase — generate an entry
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    name: `generated-entry-${callCount}`,
                    keywords: ['test', 'keyword'],
                    mode: 'keyword',
                    priority: 500,
                    content: 'Generated world entry content from distillation.',
                  }),
                },
              }],
            }
          }

          return { choices: [{ message: { content: '{}' } }] }
        },
      },
    },
  }
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

    const client = createMockClient() as any
    const distiller = new WorldDistiller(client, 'test-model')

    const progressEvents: string[] = []
    distiller.on('progress', (p: any) => progressEvents.push(p.phase))

    const entries = await distiller.distill('distill-test', fixtureDir, 'markdown')

    expect(entries.length).toBeGreaterThan(0)
    expect(progressEvents).toContain('ingest')
    expect(progressEvents).toContain('classify')
    expect(progressEvents).toContain('cluster')
    expect(progressEvents).toContain('extract')

    // Write entries
    await distiller.writeEntries('distill-test', entries)
    const stored = loadAllEntries('distill-test')
    expect(stored.length).toBe(entries.length)

    // Verify manifest entry_count updated
    const manifest = loadWorld('distill-test')
    expect(manifest!.entry_count).toBe(entries.length)
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

    const client = createMockClient() as any
    const distiller = new WorldDistiller(client, 'test-model')

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
