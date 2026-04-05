import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  bindWorld,
  unbindWorld,
  loadBindings,
  loadBinding,
  updateBinding,
} from '../../src/world/binding.js'
import { createWorld } from '../../src/world/manifest.js'

let tmpDir: string
let origHome: string
let soulDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir

  // Create a mock soul dir
  soulDir = path.join(tmpDir, '.soulkiller', 'souls', 'johnny')
  fs.mkdirSync(soulDir, { recursive: true })
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('bindWorld', () => {
  it('creates a binding file with defaults', () => {
    createWorld('night-city', '夜之城', 'desc')
    const binding = bindWorld(soulDir, 'night-city')

    expect(binding.world).toBe('night-city')
    expect(binding.enabled).toBe(true)
    expect(binding.order).toBe(0)

    const filePath = path.join(soulDir, 'bindings', 'night-city.json')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('creates a binding with custom options', () => {
    createWorld('night-city', '夜之城', 'desc')
    const binding = bindWorld(soulDir, 'night-city', {
      order: 1,
      persona_context: '{{soul.display_name}} 是夜之城的传奇',
    })

    expect(binding.order).toBe(1)
    expect(binding.persona_context).toBe('{{soul.display_name}} 是夜之城的传奇')
  })

  it('throws when world does not exist', () => {
    expect(() => bindWorld(soulDir, 'nonexistent')).toThrow('does not exist')
  })
})

describe('unbindWorld', () => {
  it('removes the binding file', () => {
    createWorld('night-city', '夜之城', 'desc')
    bindWorld(soulDir, 'night-city')
    unbindWorld(soulDir, 'night-city')

    const filePath = path.join(soulDir, 'bindings', 'night-city.json')
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('does nothing if binding does not exist', () => {
    expect(() => unbindWorld(soulDir, 'night-city')).not.toThrow()
  })
})

describe('loadBindings', () => {
  it('loads all enabled bindings sorted by order', () => {
    createWorld('night-city', '夜之城', 'desc')
    createWorld('corpo-life', '企业人生', 'desc')

    bindWorld(soulDir, 'night-city', { order: 1 })
    bindWorld(soulDir, 'corpo-life', { order: 0 })

    const bindings = loadBindings(soulDir)
    expect(bindings).toHaveLength(2)
    expect(bindings[0].world).toBe('corpo-life')
    expect(bindings[1].world).toBe('night-city')
  })

  it('filters out disabled bindings', () => {
    createWorld('night-city', '夜之城', 'desc')
    bindWorld(soulDir, 'night-city', { enabled: false })

    expect(loadBindings(soulDir)).toHaveLength(0)
  })

  it('returns empty array when no bindings', () => {
    expect(loadBindings(soulDir)).toEqual([])
  })
})

describe('loadBinding', () => {
  it('loads a specific binding', () => {
    createWorld('night-city', '夜之城', 'desc')
    bindWorld(soulDir, 'night-city')

    const binding = loadBinding(soulDir, 'night-city')
    expect(binding).not.toBeNull()
    expect(binding!.world).toBe('night-city')
  })

  it('returns null if not bound', () => {
    expect(loadBinding(soulDir, 'night-city')).toBeNull()
  })
})

describe('updateBinding', () => {
  it('overwrites existing binding', () => {
    createWorld('night-city', '夜之城', 'desc')
    bindWorld(soulDir, 'night-city', { order: 0 })

    updateBinding(soulDir, {
      world: 'night-city',
      enabled: true,
      order: 5,
    })

    const binding = loadBinding(soulDir, 'night-city')
    expect(binding!.order).toBe(5)
  })
})
