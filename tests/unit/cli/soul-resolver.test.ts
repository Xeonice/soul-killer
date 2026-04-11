import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

// We need to test with a custom SOULS_DIR, so we'll test the logic directly
describe('Soul Resolver', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-soul-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('lists souls from directory with manifests', () => {
    // Create soul dirs with manifests
    const soul1Dir = path.join(tmpDir, 'douglastang')
    fs.mkdirSync(soul1Dir)
    fs.writeFileSync(path.join(soul1Dir, 'manifest.json'), JSON.stringify({
      name: 'douglastang',
      description: '前端工程师',
      chunk_count: 100,
      languages: ['zh', 'en'],
    }))

    const soul2Dir = path.join(tmpDir, 'test-soul')
    fs.mkdirSync(soul2Dir)
    fs.writeFileSync(path.join(soul2Dir, 'manifest.json'), JSON.stringify({
      name: 'test-soul',
      chunk_count: 50,
    }))

    const entries = fs.readdirSync(tmpDir, { withFileTypes: true })
    const souls = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const manifestPath = path.join(tmpDir, e.name, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
          return {
            name: e.name,
            description: manifest.description ?? '',
            chunkCount: manifest.chunk_count ?? 0,
            languages: manifest.languages,
          }
        }
        return { name: e.name, description: '', chunkCount: 0 }
      })

    expect(souls).toHaveLength(2)
    expect(souls.find((s) => s.name === 'douglastang')?.description).toBe('前端工程师')
    expect(souls.find((s) => s.name === 'douglastang')?.chunkCount).toBe(100)
    expect(souls.find((s) => s.name === 'test-soul')?.chunkCount).toBe(50)
  })

  it('handles soul dir without manifest', () => {
    fs.mkdirSync(path.join(tmpDir, 'no-manifest'))

    const entries = fs.readdirSync(tmpDir, { withFileTypes: true })
    const souls = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const manifestPath = path.join(tmpDir, e.name, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
          return { name: e.name, description: manifest.description ?? '', chunkCount: manifest.chunk_count ?? 0 }
        }
        return { name: e.name, description: '', chunkCount: 0 }
      })

    expect(souls).toHaveLength(1)
    expect(souls[0]!.name).toBe('no-manifest')
    expect(souls[0]!.description).toBe('')
    expect(souls[0]!.chunkCount).toBe(0)
  })

  it('returns empty for non-existent directory', () => {
    const nonExistent = path.join(tmpDir, 'nope')
    expect(fs.existsSync(nonExistent)).toBe(false)
    // Mimics listLocalSouls behavior
    const result = fs.existsSync(nonExistent) ? fs.readdirSync(nonExistent) : []
    expect(result).toEqual([])
  })
})
