import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { assembleContext, type SoulFiles } from '../../../src/world/context-assembler.js'
import { createWorld } from '../../../src/world/manifest.js'
import { addEntry, type EntryMeta } from '../../../src/world/entry.js'
import { addChronicleEntry } from '../../../src/world/chronicle.js'
import { bindWorld } from '../../../src/world/binding.js'
import { emptyTagSet } from '../../../src/soul/tags/taxonomy.js'
import { setLocale } from '../../../src/infra/i18n/index.js'

let tmpDir: string
let origHome: string
let soulDir: string

const soulFiles: SoulFiles = {
  identity: 'I am Johnny Silverhand',
  style: 'Rebellious and direct',
  behaviors: { combat: 'Always fights back' },
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
  setLocale('en')

  soulDir = path.join(tmpDir, '.soulkiller', 'souls', 'johnny')
  fs.mkdirSync(soulDir, { recursive: true })
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('assembleContext', () => {
  it('produces legacy output when no bindings', async () => {
    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [],
      userInput: 'hello',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).toContain('I am Johnny Silverhand')
    expect(result).toContain('Rebellious and direct')
    expect(result).toContain('Always fights back')
  })

  it('includes always entries from bound world', async () => {
    createWorld('night-city', '夜之城', 'desc')
    const meta: EntryMeta = {
      name: 'core-rules',
      keywords: [],
      priority: 100,
      mode: 'always',
      scope: 'background',
    }
    addEntry('night-city', meta, 'This is Night City. Danger everywhere.')

    const binding = bindWorld(soulDir, 'night-city')

    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: 'hello',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).toContain('This is Night City. Danger everywhere.')
    expect(result).toContain('I am Johnny Silverhand')
  })

  it('includes keyword-triggered entries', async () => {
    createWorld('night-city', '夜之城', 'desc')
    addEntry('night-city', {
      name: 'megacorps',
      keywords: ['荒坂', 'Arasaka'],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
    }, '荒坂公司是最强大的超企')

    const binding = bindWorld(soulDir, 'night-city')

    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: '告诉我关于荒坂的事',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).toContain('荒坂公司是最强大的超企')
  })

  it('does not include keyword entries when no match', async () => {
    createWorld('night-city', '夜之城', 'desc')
    addEntry('night-city', {
      name: 'megacorps',
      keywords: ['荒坂'],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
    }, '荒坂公司是最强大的超企')

    const binding = bindWorld(soulDir, 'night-city')

    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: '今天天气如何',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).not.toContain('荒坂公司是最强大的超企')
  })

  it('renders persona_context template', async () => {
    createWorld('night-city', '夜之城', 'desc')
    const binding = bindWorld(soulDir, 'night-city', {
      persona_context: '{{soul.display_name}} 是夜之城的传奇',
    })

    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: 'hello',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).toContain('Johnny 是夜之城的传奇')
  })
})

describe('assembleContext — chronicle', () => {
  function chronicleMeta(name: string, sort_key: number, display: string): EntryMeta {
    return {
      name,
      keywords: [],
      priority: 950,
      mode: 'always',
      scope: 'chronicle',
      sort_key,
      display_time: display,
    }
  }

  it('injects chronicle timeline as a single sorted block after background entries', async () => {
    createWorld('night-city', 'Night City', 'desc')

    addEntry('night-city', {
      name: 'core-bg',
      keywords: [],
      priority: 100,
      mode: 'always',
      scope: 'background',
    }, 'CORE_BACKGROUND')

    addChronicleEntry('night-city', 'timeline',
      chronicleMeta('y2077', 2077, '2077'), 'V 植入 Relic')
    addChronicleEntry('night-city', 'timeline',
      chronicleMeta('y2013', 2013, '2013'), '第四次公司战争')
    addChronicleEntry('night-city', 'timeline',
      chronicleMeta('y2020', 2020.5, '2020 年 8 月'), '荒坂塔核爆')

    const binding = bindWorld(soulDir, 'night-city')
    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: 'hello',
      recentMessages: [],
      recallResults: [],
    })

    // Heading uses the i18n key (en locale → "Chronicle")
    expect(result).toContain('## Chronicle')
    // All three timeline events present
    expect(result).toContain('第四次公司战争')
    expect(result).toContain('荒坂塔核爆')
    expect(result).toContain('V 植入 Relic')
    // sort_key ordering: 2013 < 2020.5 < 2077
    const i2013 = result.indexOf('第四次公司战争')
    const i2020 = result.indexOf('荒坂塔核爆')
    const i2077 = result.indexOf('V 植入 Relic')
    expect(i2013).toBeLessThan(i2020)
    expect(i2020).toBeLessThan(i2077)
    // Block sits between background block and soul identity
    const iBackground = result.indexOf('CORE_BACKGROUND')
    const iIdentity = result.indexOf('I am Johnny Silverhand')
    expect(iBackground).toBeLessThan(i2013)
    expect(i2077).toBeLessThan(iIdentity)
  })

  it('does not render chronicle heading when no timeline entries exist', async () => {
    createWorld('night-city', 'Night City', 'desc')
    addEntry('night-city', {
      name: 'core',
      keywords: [],
      priority: 100,
      mode: 'always',
      scope: 'background',
    }, 'CORE_BACKGROUND')

    const binding = bindWorld(soulDir, 'night-city')
    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: 'hello',
      recentMessages: [],
      recallResults: [],
    })

    expect(result).not.toContain('## Chronicle')
    expect(result).not.toContain('## 编年史')
  })

  it('chronicle events go through keyword trigger flow (not the timeline block)', async () => {
    createWorld('night-city', 'Night City', 'desc')
    // Detail-layer event with keywords
    addChronicleEntry('night-city', 'events', {
      name: '2020-arasaka-nuke',
      keywords: ['荒坂塔', 'Arasaka Tower'],
      priority: 800,
      mode: 'keyword',
      scope: 'chronicle',
      sort_key: 2020.5,
    }, '2020 年 8 月 13 日，Johnny 引爆战术核武...')
    // Timeline counterpart so we can prove the two render in different places
    addChronicleEntry('night-city', 'timeline',
      chronicleMeta('2020-arasaka-nuke', 2020.5, '2020 年 8 月'), '荒坂塔核爆')

    const binding = bindWorld(soulDir, 'night-city')
    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [binding],
      userInput: '告诉我荒坂塔的事',
      recentMessages: [],
      recallResults: [],
    })

    // Detail event triggered via keyword and rendered in the World Context
    // section (after soul identity), not in the chronicle heading
    expect(result).toContain('Johnny 引爆战术核武')
    const iWorldContext = result.indexOf('## World Context')
    const iEventDetail = result.indexOf('Johnny 引爆战术核武')
    expect(iWorldContext).toBeGreaterThan(-1)
    expect(iEventDetail).toBeGreaterThan(iWorldContext)
  })

  it('orders chronicle blocks by world.order across multiple bindings', async () => {
    createWorld('world-a', 'World A', 'desc')
    createWorld('world-b', 'World B', 'desc')
    addChronicleEntry('world-a', 'timeline',
      chronicleMeta('a-event', 100, 'Year 100'), 'A happens')
    addChronicleEntry('world-b', 'timeline',
      chronicleMeta('b-event', 50, 'Year 50'), 'B happens')

    // Bind A first (order 0), then B (order 1)
    const bindingA = bindWorld(soulDir, 'world-a', { order: 0 })
    const bindingB = bindWorld(soulDir, 'world-b', { order: 1 })

    const result = await assembleContext({
      soulFiles,
      soulName: 'johnny',
      soulDisplayName: 'Johnny',
      soulTags: emptyTagSet(),
      bindings: [bindingA, bindingB],
      userInput: 'hi',
      recentMessages: [],
      recallResults: [],
    })

    // Even though B's sort_key is smaller, A renders first because it's bound earlier
    const iA = result.indexOf('A happens')
    const iB = result.indexOf('B happens')
    expect(iA).toBeGreaterThan(-1)
    expect(iB).toBeGreaterThan(-1)
    expect(iA).toBeLessThan(iB)
  })
})
