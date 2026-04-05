import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { assembleContext, type SoulFiles } from '../../src/world/context-assembler.js'
import { createWorld } from '../../src/world/manifest.js'
import { addEntry, type EntryMeta } from '../../src/world/entry.js'
import { bindWorld } from '../../src/world/binding.js'
import { emptyTagSet } from '../../src/tags/taxonomy.js'
import { setLocale } from '../../src/i18n/index.js'

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
