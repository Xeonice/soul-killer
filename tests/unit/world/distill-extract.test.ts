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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-extract-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir

  fixtureDir = path.join(tmpDir, 'fixtures')
  fs.mkdirSync(fixtureDir, { recursive: true })
  fs.writeFileSync(
    path.join(fixtureDir, 'data.md'),
    '# History\n\nThe battle of Chibi in 208 AD was decisive.\n\n# Geography\n\nJingzhou was the most contested region.\n',
  )

  // Create world manifest
  createWorld('test-world', 'Test', 'Test')
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

function setupMockResponses(responses: string[]) {
  let callIndex = 0
  vi.mocked(generateText).mockImplementation(async () => {
    return { text: responses[callIndex++] ?? '[]' } as any
  })
}

describe('WorldDistiller.extractEntries (per-dimension merge)', () => {
  it('groups chunks by dimension and generates multiple entries per dimension', async () => {
    // Use a non-history dimension so we go through the single-pass extract
    // path (history routes to the dedicated three-pass flow).
    const classifyResponse = JSON.stringify([
      { index: 0, scope: 'lore', dimension: 'factions' },
      { index: 1, scope: 'lore', dimension: 'factions' },
    ])
    const extractResponse = JSON.stringify([
      { name: 'wei-court', keywords: ['wei'], mode: 'keyword', priority: 700, content: 'Detailed entry about Wei court. Multiple sentences here.' },
      { name: 'shu-court', keywords: ['shu'], mode: 'keyword', priority: 600, content: 'Detailed entry about Shu court. Also multiple sentences.' },
    ])
    const reviewResponse = JSON.stringify({ merges: [], deletes: [] })

    setupMockResponses([classifyResponse, extractResponse, reviewResponse])
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    expect(entries.length).toBe(2)
    expect(entries.some((e) => e.meta.name === 'wei-court')).toBe(true)
    expect(entries.some((e) => e.meta.name === 'shu-court')).toBe(true)
  })

  it('falls back to single entry when LLM returns invalid JSON', async () => {
    const classifyResponse = JSON.stringify([
      { index: 0, scope: 'lore', dimension: 'factions' },
      { index: 1, scope: 'lore', dimension: 'factions' },
    ])
    const reviewResponse = JSON.stringify({ merges: [], deletes: [] })

    setupMockResponses([classifyResponse, 'not valid json', reviewResponse])
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0]!.meta.name).toContain('entry-')
  })

  it('history dimension runs three-pass flow and produces timeline + events + non-event entries', async () => {
    // Three-pass mock sequence:
    //   1. classify
    //   2. Pass A — timeline list (1 event)
    //   3. Pass B — single event detail expansion
    //   4. Pass C — non-event long-term trends
    //   5. review
    const classifyResponse = JSON.stringify([
      { index: 0, scope: 'background', dimension: 'history' },
      { index: 1, scope: 'background', dimension: 'history' },
    ])
    const passAResponse = JSON.stringify([
      {
        name: 'battle-of-chibi',
        display_time: '208 年',
        sort_key: 208,
        one_line: '208 年 · 赤壁之战，三国格局奠定',
        source_excerpt: 'Battle of Chibi, 208 AD',
        sort_key_inferred: false,
        importance: 'high',
      },
    ])
    const passBResponse = 'In 208 AD, the allied southern forces decisively defeated Cao Cao at the Yangtze River. The defeat fixed the Three Kingdoms partition for decades to come.'
    const passCResponse = JSON.stringify([
      {
        name: 'general-history',
        keywords: ['history'],
        mode: 'keyword',
        priority: 500,
        content: 'General overview of the world history span, describing long-term trends without specific time anchors.',
      },
    ])
    const reviewResponse = JSON.stringify({ merges: [], deletes: [] })

    setupMockResponses([classifyResponse, passAResponse, passBResponse, passCResponse, reviewResponse])
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    // Timeline entry from Pass A
    const timeline = entries.find((e) => e.chronicleType === 'timeline')
    expect(timeline).toBeDefined()
    expect(timeline!.meta.name).toBe('battle-of-chibi')
    expect(timeline!.meta.scope).toBe('chronicle')
    expect(timeline!.meta.mode).toBe('always')
    expect(timeline!.meta.sort_key).toBe(208)
    expect(timeline!.meta.display_time).toBe('208 年')
    expect(timeline!.meta.sort_key_inferred).toBe(false)
    expect(timeline!.meta.importance).toBe('high')
    expect(timeline!.content).toContain('赤壁之战')

    // Events entry from Pass B (same name)
    const events = entries.find((e) => e.chronicleType === 'events')
    expect(events).toBeDefined()
    expect(events!.meta.name).toBe('battle-of-chibi')
    expect(events!.meta.scope).toBe('chronicle')
    expect(events!.meta.mode).toBe('keyword')
    expect(events!.content).toContain('208 AD')

    // Non-event entry from Pass C
    const nonEvent = entries.find((e) => e.meta.name === 'general-history')
    expect(nonEvent).toBeDefined()
    expect(nonEvent!.chronicleType).toBeUndefined()
    expect(nonEvent!.meta.dimension).toBe('history')
  })

  it('writeEntries routes chronicleType entries to chronicle/<kind>/', async () => {
    const distiller = new WorldDistiller({} as any)
    const { loadChronicleTimeline, loadChronicleEvents } = await import('../../../src/world/chronicle.js')
    const { loadAllEntries } = await import('../../../src/world/entry.js')

    await distiller.writeEntries('test-world', [
      {
        meta: {
          name: 'normal-bg', keywords: [], priority: 100, mode: 'always', scope: 'background',
        },
        content: 'normal background body',
      },
      {
        meta: {
          name: 'event-001', keywords: ['e1'], priority: 950, mode: 'always', scope: 'chronicle',
          sort_key: 100, display_time: 'Year 100',
        },
        content: '一行事件描述',
        chronicleType: 'timeline',
      },
      {
        meta: {
          name: 'event-001', keywords: ['e1'], priority: 800, mode: 'keyword', scope: 'chronicle',
          sort_key: 100,
        },
        content: '完整事件描述...',
        chronicleType: 'events',
      },
    ])

    // Normal entry lives in entries/
    expect(loadAllEntries('test-world').some((e) => e.meta.name === 'normal-bg')).toBe(true)
    // Chronicle entries split across timeline/ and events/
    const tl = loadChronicleTimeline('test-world')
    const ev = loadChronicleEvents('test-world')
    expect(tl).toHaveLength(1)
    expect(tl[0]!.meta.name).toBe('event-001')
    expect(tl[0]!.content).toContain('一行事件描述')
    expect(ev).toHaveLength(1)
    expect(ev[0]!.content).toContain('完整事件描述')
  })

  it('history dimension: when Pass A returns empty, only Pass C entries are produced', async () => {
    // Pass A returns [] → no timeline + no Pass B calls.
    // Pass C still runs and produces regular history entries.
    const classifyResponse = JSON.stringify([
      { index: 0, scope: 'background', dimension: 'history' },
    ])
    const passAEmpty = JSON.stringify([])
    const passCResponse = JSON.stringify([
      {
        name: 'just-prose',
        keywords: ['history'],
        mode: 'keyword',
        priority: 400,
        content: 'A general descriptive history paragraph with no time anchors.',
      },
    ])
    const reviewResponse = JSON.stringify({ merges: [], deletes: [] })

    setupMockResponses([classifyResponse, passAEmpty, passCResponse, reviewResponse])
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')
    expect(entries.every((e) => e.chronicleType === undefined)).toBe(true)
    expect(entries.some((e) => e.meta.name === 'just-prose')).toBe(true)
  })

  it('handles LLM returning a single object instead of array', async () => {
    const classifyResponse = JSON.stringify([
      { index: 0, scope: 'rule', dimension: 'systems' },
      { index: 1, scope: 'rule', dimension: 'systems' },
    ])
    const singleObject = JSON.stringify({
      name: 'tuntian-system', keywords: ['tuntian'],
      mode: 'always', priority: 800, content: 'Detailed tuntian entry.',
    })
    const reviewResponse = JSON.stringify({ merges: [], deletes: [] })

    setupMockResponses([classifyResponse, singleObject, reviewResponse])
    const distiller = new WorldDistiller({} as any)
    distiller.on('progress', () => {})

    const entries = await distiller.distill('test-world', fixtureDir, 'markdown', 'REAL_SETTING')

    expect(entries.some((e) => e.meta.name === 'tuntian-system')).toBe(true)
  })
})
