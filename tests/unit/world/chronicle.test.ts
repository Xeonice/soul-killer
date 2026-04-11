import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  addChronicleEntry,
  loadChronicleTimeline,
  loadChronicleEvents,
  loadChronicleEntry,
  removeChronicleEntry,
  sortByChronicle,
} from '../../../src/world/chronicle.js'
import {
  getHistoryEventsDir,
  getHistoryTimelinePath,
} from '../../../src/world/entry.js'
import type { EntryMeta, WorldEntry } from '../../../src/world/entry.js'
import { createWorld } from '../../../src/world/manifest.js'

let tmpDir: string
let origHome: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-chronicle-test-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

const sampleTimeline: EntryMeta = {
  name: '2020-arasaka-nuke',
  keywords: ['荒坂塔'],
  priority: 950,
  mode: 'always',
  scope: 'chronicle',
  sort_key: 2020.613,
  display_time: '2020 年 8 月',
  event_ref: '2020-arasaka-nuke',
}

const sampleEvent: EntryMeta = {
  name: '2020-arasaka-nuke',
  keywords: ['荒坂塔', 'Arasaka Tower'],
  priority: 800,
  mode: 'keyword',
  scope: 'chronicle',
  sort_key: 2020.613,
  display_time: '2020 年 8 月 13 日',
}

describe('chronicle path resolution', () => {
  it('timeline lives at world/<name>/history/timeline.md (single file)', () => {
    createWorld('night-city', 'Night City', 'desc')
    const tl = getHistoryTimelinePath('night-city')
    expect(tl.endsWith(path.join('night-city', 'history', 'timeline.md'))).toBe(true)
  })
  it('events live under world/<name>/history/events/', () => {
    createWorld('night-city', 'Night City', 'desc')
    const ev = getHistoryEventsDir('night-city')
    expect(ev.endsWith(path.join('night-city', 'history', 'events'))).toBe(true)
  })
})

describe('addChronicleEntry / loadChronicleTimeline / loadChronicleEvents', () => {
  it('add a timeline entry then load it', () => {
    createWorld('night-city', 'Night City', 'desc')
    addChronicleEntry('night-city', 'timeline', sampleTimeline, '2020 年 8 月 · 荒坂塔核爆')
    const all = loadChronicleTimeline('night-city')
    expect(all).toHaveLength(1)
    expect(all[0]!.meta.name).toBe('2020-arasaka-nuke')
    expect(all[0]!.meta.sort_key).toBe(2020.613)
    expect(all[0]!.meta.display_time).toBe('2020 年 8 月')
    expect(all[0]!.meta.scope).toBe('chronicle')
    expect(all[0]!.content).toContain('荒坂塔核爆')
  })

  it('add timeline and events independently — same slug, different dirs', () => {
    createWorld('night-city', 'Night City', 'desc')
    addChronicleEntry('night-city', 'timeline', sampleTimeline, 'one-line')
    addChronicleEntry('night-city', 'events', sampleEvent, 'full description')

    expect(loadChronicleTimeline('night-city')).toHaveLength(1)
    expect(loadChronicleEvents('night-city')).toHaveLength(1)

    const ev = loadChronicleEntry('night-city', 'events', '2020-arasaka-nuke')
    expect(ev?.content).toBe('full description')
  })

  it('addChronicleEntry forces scope to "chronicle" even if meta says otherwise', () => {
    createWorld('night-city', 'Night City', 'desc')
    addChronicleEntry(
      'night-city',
      'timeline',
      { ...sampleTimeline, scope: 'lore' as EntryMeta['scope'] },
      'body',
    )
    const loaded = loadChronicleTimeline('night-city')
    expect(loaded[0]!.meta.scope).toBe('chronicle')
  })

  it('removeChronicleEntry deletes the file', () => {
    createWorld('night-city', 'Night City', 'desc')
    addChronicleEntry('night-city', 'timeline', sampleTimeline, 'body')
    removeChronicleEntry('night-city', 'timeline', '2020-arasaka-nuke')
    expect(loadChronicleTimeline('night-city')).toHaveLength(0)
  })
})

describe('legacy world without chronicle directory', () => {
  it('loadChronicleTimeline returns [] when chronicle/ does not exist', () => {
    createWorld('legacy', 'Legacy', 'desc')
    expect(loadChronicleTimeline('legacy')).toEqual([])
    expect(loadChronicleEvents('legacy')).toEqual([])
  })

  it('loadChronicleEntry returns null when file is missing', () => {
    createWorld('legacy', 'Legacy', 'desc')
    expect(loadChronicleEntry('legacy', 'timeline', 'whatever')).toBeNull()
  })
})

describe('sortByChronicle', () => {
  function entry(name: string, sort_key: number | undefined): WorldEntry {
    return {
      meta: {
        name,
        keywords: [],
        priority: 950,
        mode: 'always',
        scope: 'chronicle',
        ...(sort_key !== undefined ? { sort_key } : {}),
      },
      content: '',
    }
  }

  it('sorts by sort_key ascending', () => {
    const sorted = sortByChronicle([
      entry('c', 2077),
      entry('a', 2013),
      entry('b', 2020.5),
    ])
    expect(sorted.map((e) => e.meta.name)).toEqual(['a', 'b', 'c'])
  })

  it('puts entries without sort_key at the end', () => {
    const sorted = sortByChronicle([
      entry('no-key-1', undefined),
      entry('y2020', 2020),
      entry('y2013', 2013),
    ])
    expect(sorted.map((e) => e.meta.name)).toEqual(['y2013', 'y2020', 'no-key-1'])
  })

  it('breaks ties by name to keep ordering deterministic', () => {
    const sorted = sortByChronicle([
      entry('z-event', 1000),
      entry('a-event', 1000),
    ])
    expect(sorted.map((e) => e.meta.name)).toEqual(['a-event', 'z-event'])
  })

  it('does not mutate the input array', () => {
    const input = [entry('b', 2020), entry('a', 2013)]
    const original = [...input]
    sortByChronicle(input)
    expect(input).toEqual(original)
  })
})
