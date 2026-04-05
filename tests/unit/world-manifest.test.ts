import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  createWorldManifest,
  createWorld,
  loadWorld,
  deleteWorld,
  listWorlds,
  worldExists,
  bumpPatchVersion,
} from '../../src/world/manifest.js'

// Use a temp dir to avoid polluting real config
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

describe('createWorldManifest', () => {
  it('creates a manifest with default values', () => {
    const m = createWorldManifest('night-city', '夜之城', 'A cyberpunk world')
    expect(m.name).toBe('night-city')
    expect(m.display_name).toBe('夜之城')
    expect(m.version).toBe('0.1.0')
    expect(m.entry_count).toBe(0)
    expect(m.defaults.context_budget).toBe(2000)
    expect(m.defaults.injection_position).toBe('after_soul')
  })
})

describe('createWorld', () => {
  it('creates world directory and manifest file', () => {
    const m = createWorld('night-city', '夜之城', 'desc')
    const worldDir = path.join(tmpDir, '.soulkiller', 'worlds', 'night-city')
    expect(fs.existsSync(worldDir)).toBe(true)
    expect(fs.existsSync(path.join(worldDir, 'world.json'))).toBe(true)
    expect(fs.existsSync(path.join(worldDir, 'entries'))).toBe(true)
    expect(m.name).toBe('night-city')
  })

  it('throws if world already exists', () => {
    createWorld('night-city', '夜之城', 'desc')
    expect(() => createWorld('night-city', '夜之城', 'desc')).toThrow('already exists')
  })
})

describe('loadWorld', () => {
  it('loads an existing world manifest', () => {
    createWorld('night-city', '夜之城', 'desc')
    const m = loadWorld('night-city')
    expect(m).not.toBeNull()
    expect(m!.name).toBe('night-city')
    expect(m!.display_name).toBe('夜之城')
  })

  it('returns null for non-existent world', () => {
    expect(loadWorld('nonexistent')).toBeNull()
  })
})

describe('deleteWorld', () => {
  it('removes the world directory', () => {
    createWorld('night-city', '夜之城', 'desc')
    deleteWorld('night-city')
    expect(worldExists('night-city')).toBe(false)
  })

  it('throws if world does not exist', () => {
    expect(() => deleteWorld('nonexistent')).toThrow('does not exist')
  })
})

describe('listWorlds', () => {
  it('returns all installed worlds', () => {
    createWorld('night-city', '夜之城', 'desc1')
    createWorld('corpo-life', '企业人生', 'desc2')
    const worlds = listWorlds()
    expect(worlds).toHaveLength(2)
    const names = worlds.map((w) => w.name).sort()
    expect(names).toEqual(['corpo-life', 'night-city'])
  })

  it('returns empty array when no worlds exist', () => {
    expect(listWorlds()).toEqual([])
  })
})

describe('bumpPatchVersion', () => {
  it('increments patch version', () => {
    expect(bumpPatchVersion('0.1.0')).toBe('0.1.1')
    expect(bumpPatchVersion('1.2.9')).toBe('1.2.10')
  })
})
