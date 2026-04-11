import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getBoundWorlds, copyWorldToPackage, installWorldFromPackage } from '../../src/soul/package.js'
import { createWorld, worldExists, deleteWorld, getWorldDir } from '../../src/world/manifest.js'
import { addEntry } from '../../src/world/entry.js'
import { bindWorld } from '../../src/world/binding.js'

let tmpDir: string
let origHome: string
let soulDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-pkg-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir

  soulDir = path.join(tmpDir, '.soulkiller', 'souls', 'test-soul')
  fs.mkdirSync(soulDir, { recursive: true })
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('getBoundWorlds', () => {
  it('returns bound worlds with manifests', () => {
    createWorld('pkg-world', 'Package World', 'desc')
    bindWorld(soulDir, 'pkg-world')

    const results = getBoundWorlds(soulDir)
    expect(results).toHaveLength(1)
    expect(results[0].manifest.name).toBe('pkg-world')
    expect(results[0].binding.world).toBe('pkg-world')
  })

  it('returns empty when no bindings', () => {
    expect(getBoundWorlds(soulDir)).toEqual([])
  })
})

describe('copyWorldToPackage', () => {
  it('copies world directory to package staging area', () => {
    createWorld('copy-world', 'Copy World', 'desc')
    addEntry('copy-world', {
      name: 'test-entry',
      keywords: ['test'],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
    }, 'Test content')

    const stagingDir = path.join(tmpDir, 'package-worlds')
    fs.mkdirSync(stagingDir, { recursive: true })

    copyWorldToPackage('copy-world', stagingDir)

    const copiedDir = path.join(stagingDir, 'copy-world')
    expect(fs.existsSync(copiedDir)).toBe(true)
    expect(fs.existsSync(path.join(copiedDir, 'world.json'))).toBe(true)
    expect(fs.existsSync(path.join(copiedDir, 'factions', 'test-entry.md'))).toBe(true)
  })
})

describe('installWorldFromPackage', () => {
  it('installs new world', () => {
    // Create a package world dir
    const pkgWorldDir = path.join(tmpDir, 'pkg', 'install-world')
    fs.mkdirSync(path.join(pkgWorldDir, 'entries'), { recursive: true })
    fs.writeFileSync(
      path.join(pkgWorldDir, 'world.json'),
      JSON.stringify({ name: 'install-world', display_name: 'Install World', version: '0.1.0' }),
    )

    const result = installWorldFromPackage(pkgWorldDir, 'install-world')
    expect(result).toBe('installed')
    expect(worldExists('install-world')).toBe(true)
  })

  it('returns exists when world already present', () => {
    createWorld('existing-world', 'Existing', 'desc')

    const pkgWorldDir = path.join(tmpDir, 'pkg', 'existing-world')
    fs.mkdirSync(pkgWorldDir, { recursive: true })
    fs.writeFileSync(path.join(pkgWorldDir, 'world.json'), '{}')

    const result = installWorldFromPackage(pkgWorldDir, 'existing-world')
    expect(result).toBe('exists')
  })
})
