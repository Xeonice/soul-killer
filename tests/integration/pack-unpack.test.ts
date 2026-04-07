import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { packSoul, packWorld } from '../../src/pack/packer.js'
import { inspectPack, applyUnpack, suggestRename } from '../../src/pack/unpacker.js'

// These tests use real filesystem operations with isolated temp directories.
// They mock the soul/world home directory by creating structures in tmpdir.

describe('pack-unpack integration', () => {
  let originalHome: string
  let tmpHome: string
  let outputDir: string

  beforeEach(() => {
    originalHome = os.homedir()
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-home-'))
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-output-'))

    // Create .soulkiller directory structure
    const soulsDir = path.join(tmpHome, '.soulkiller', 'souls')
    const worldsDir = path.join(tmpHome, '.soulkiller', 'worlds')
    fs.mkdirSync(soulsDir, { recursive: true })
    fs.mkdirSync(worldsDir, { recursive: true })

    // Patch HOME for the test (used by soul/world path resolution)
    process.env.HOME = tmpHome
  })

  afterEach(() => {
    process.env.HOME = originalHome
    fs.rmSync(tmpHome, { recursive: true, force: true })
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  function createTestSoul(name: string) {
    const soulDir = path.join(tmpHome, '.soulkiller', 'souls', name)
    fs.mkdirSync(path.join(soulDir, 'soul', 'behaviors'), { recursive: true })
    fs.mkdirSync(path.join(soulDir, 'vectors'), { recursive: true })
    fs.mkdirSync(path.join(soulDir, 'examples'), { recursive: true })

    fs.writeFileSync(path.join(soulDir, 'manifest.json'), JSON.stringify({
      name,
      display_name: name.charAt(0).toUpperCase() + name.slice(1),
      version: '0.1.0',
      created_at: new Date().toISOString(),
      languages: ['zh'],
      description: `Test soul ${name}`,
      chunk_count: 5,
      embedding_model: 'local',
      engine_version: '0.1.0',
      soulType: 'public',
      tags: { personality: [], communication: [], values: [], behavior: [], domain: [] },
    }))

    fs.writeFileSync(path.join(soulDir, 'soul', 'identity.md'), `# ${name}\nTest identity`)
    fs.writeFileSync(path.join(soulDir, 'soul', 'style.md'), `# Style\nTest style`)
    fs.writeFileSync(path.join(soulDir, 'soul', 'behaviors', 'default.md'), 'Default behavior')

    return soulDir
  }

  function createTestWorld(name: string) {
    const worldDir = path.join(tmpHome, '.soulkiller', 'worlds', name)
    fs.mkdirSync(path.join(worldDir, 'entries'), { recursive: true })

    fs.writeFileSync(path.join(worldDir, 'world.json'), JSON.stringify({
      name,
      display_name: name.replace(/-/g, ' '),
      version: '0.1.0',
      created_at: new Date().toISOString(),
      description: `Test world ${name}`,
      entry_count: 1,
      defaults: { context_budget: 2000, injection_position: 'after_soul' },
      worldType: 'fictional-existing',
      tags: { theme: [], setting: [], tone: [], mechanic: [], domain: [] },
    }))

    fs.writeFileSync(path.join(worldDir, 'entries', 'main.md'), `---\nname: main\nkeywords: [test]\npriority: 1\nmode: always\nscope: background\n---\nTest entry content`)

    return worldDir
  }

  function bindSoulToWorld(soulName: string, worldName: string) {
    const bindingsDir = path.join(tmpHome, '.soulkiller', 'souls', soulName, 'bindings')
    fs.mkdirSync(bindingsDir, { recursive: true })
    fs.writeFileSync(path.join(bindingsDir, `${worldName}.json`), JSON.stringify({
      world: worldName,
      enabled: true,
      order: 0,
    }))
  }

  describe('suggestRename', () => {
    it('suggests name-2 when name exists', () => {
      const check = (n: string) => n === 'alice'
      expect(suggestRename('alice', check)).toBe('alice-2')
    })

    it('increments until non-conflicting', () => {
      const existing = new Set(['alice', 'alice-2', 'alice-3'])
      const check = (n: string) => existing.has(n)
      expect(suggestRename('alice', check)).toBe('alice-4')
    })
  })

  describe('pack world', () => {
    it('creates a .world.pack file', async () => {
      createTestWorld('night-city')

      const result = await packWorld('night-city', { output: outputDir })

      expect(result.outputPath).toBe(path.join(outputDir, 'night-city.world.pack'))
      expect(fs.existsSync(result.outputPath)).toBe(true)
      expect(result.size).toBeGreaterThan(0)
    })

    it('throws for nonexistent world', async () => {
      await expect(packWorld('nonexistent', { output: outputDir })).rejects.toThrow('does not exist')
    })
  })

  describe('pack soul', () => {
    it('creates a .soul.pack file with bound worlds', async () => {
      createTestSoul('alice')
      createTestWorld('night-city')
      bindSoulToWorld('alice', 'night-city')

      const result = await packSoul('alice', { output: outputDir })

      expect(result.outputPath).toBe(path.join(outputDir, 'alice.soul.pack'))
      expect(fs.existsSync(result.outputPath)).toBe(true)

      // Verify pack contents by inspecting
      const inspected = await inspectPack(result.outputPath)
      expect(inspected.meta.type).toBe('soul')
      expect(inspected.meta.name).toBe('alice')
      expect(inspected.meta.includes_worlds).toContain('night-city')
      expect(inspected.meta.checksum).toMatch(/^sha256:/)

      // Cleanup staging
      fs.rmSync(inspected.stagingDir, { recursive: true, force: true })
    })

    it('excludes vectors and examples directories', async () => {
      const soulDir = createTestSoul('bob')
      fs.writeFileSync(path.join(soulDir, 'vectors', 'data.bin'), 'vector data')
      fs.writeFileSync(path.join(soulDir, 'examples', 'ex1.md'), 'example')

      const result = await packSoul('bob', { output: outputDir })
      const inspected = await inspectPack(result.outputPath)

      // Check that vectors/ and examples/ are not in the staging dir
      expect(fs.existsSync(path.join(inspected.stagingDir, 'soul', 'vectors'))).toBe(false)
      expect(fs.existsSync(path.join(inspected.stagingDir, 'soul', 'examples'))).toBe(false)

      fs.rmSync(inspected.stagingDir, { recursive: true, force: true })
    })
  })

  describe('unpack world (no conflict)', () => {
    it('restores a world from a pack file', async () => {
      createTestWorld('test-world')
      const packResult = await packWorld('test-world', { output: outputDir })

      // Remove the original world
      fs.rmSync(path.join(tmpHome, '.soulkiller', 'worlds', 'test-world'), { recursive: true })

      // Unpack
      const inspected = await inspectPack(packResult.outputPath)
      expect(inspected.conflicts).toHaveLength(0)

      const unpackResult = applyUnpack(inspected.meta, inspected.stagingDir, new Map())
      expect(unpackResult.installed).toHaveLength(1)
      expect(unpackResult.installed[0]).toEqual({ type: 'world', name: 'test-world' })

      // Verify restored files
      const restoredManifest = path.join(tmpHome, '.soulkiller', 'worlds', 'test-world', 'world.json')
      expect(fs.existsSync(restoredManifest)).toBe(true)
    })
  })

  describe('unpack soul with conflict resolution', () => {
    it('detects soul and world conflicts', async () => {
      createTestSoul('alice')
      createTestWorld('night-city')
      bindSoulToWorld('alice', 'night-city')

      const packResult = await packSoul('alice', { output: outputDir })

      // Inspect (both soul and world exist locally)
      const inspected = await inspectPack(packResult.outputPath)
      expect(inspected.conflicts.length).toBeGreaterThanOrEqual(1)

      const soulConflict = inspected.conflicts.find((c) => c.type === 'soul' && c.name === 'alice')
      expect(soulConflict).toBeTruthy()

      fs.rmSync(inspected.stagingDir, { recursive: true, force: true })
    })

    it('handles skip resolution', async () => {
      createTestSoul('alice')
      const packResult = await packSoul('alice', { output: outputDir })

      const inspected = await inspectPack(packResult.outputPath)
      const resolutions = new Map<string, 'overwrite' | 'skip' | { rename: string }>()
      resolutions.set('soul:alice', 'skip')

      const result = applyUnpack(inspected.meta, inspected.stagingDir, resolutions)
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]).toEqual({ type: 'soul', name: 'alice' })
    })

    it('handles overwrite resolution', async () => {
      createTestSoul('alice')
      const packResult = await packSoul('alice', { output: outputDir })

      // Modify local soul
      const localIdentity = path.join(tmpHome, '.soulkiller', 'souls', 'alice', 'soul', 'identity.md')
      fs.writeFileSync(localIdentity, 'MODIFIED LOCAL CONTENT')

      const inspected = await inspectPack(packResult.outputPath)
      const resolutions = new Map<string, 'overwrite' | 'skip' | { rename: string }>()
      resolutions.set('soul:alice', 'overwrite')

      applyUnpack(inspected.meta, inspected.stagingDir, resolutions)

      // Verify content was restored from pack (not the modified version)
      const content = fs.readFileSync(localIdentity, 'utf-8')
      expect(content).not.toContain('MODIFIED LOCAL CONTENT')
    })

    it('handles rename resolution with binding update', async () => {
      createTestSoul('alice')
      createTestWorld('night-city')
      bindSoulToWorld('alice', 'night-city')

      const packResult = await packSoul('alice', { output: outputDir })

      const inspected = await inspectPack(packResult.outputPath)
      const resolutions = new Map<string, 'overwrite' | 'skip' | { rename: string }>()
      resolutions.set('soul:alice', { rename: 'alice-2' })
      resolutions.set('world:night-city', { rename: 'night-city-2' })

      const result = applyUnpack(inspected.meta, inspected.stagingDir, resolutions)

      expect(result.renamed).toContainEqual({ type: 'soul', from: 'alice', to: 'alice-2' })
      expect(result.renamed).toContainEqual({ type: 'world', from: 'night-city', to: 'night-city-2' })

      // Verify renamed soul exists
      expect(fs.existsSync(path.join(tmpHome, '.soulkiller', 'souls', 'alice-2', 'manifest.json'))).toBe(true)

      // Verify renamed world exists
      expect(fs.existsSync(path.join(tmpHome, '.soulkiller', 'worlds', 'night-city-2', 'world.json'))).toBe(true)

      // Verify binding reference was updated
      const bindingPath = path.join(tmpHome, '.soulkiller', 'souls', 'alice-2', 'bindings', 'night-city-2.json')
      expect(fs.existsSync(bindingPath)).toBe(true)
      const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf-8'))
      expect(binding.world).toBe('night-city-2')

      // Old binding file should be gone
      expect(fs.existsSync(path.join(tmpHome, '.soulkiller', 'souls', 'alice-2', 'bindings', 'night-city.json'))).toBe(false)
    })
  })
})
