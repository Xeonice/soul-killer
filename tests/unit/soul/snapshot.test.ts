import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { createSnapshot, listSnapshots, restoreSnapshot } from '../../../src/soul/snapshot.js'

function setupSoulDir(): string {
  const tmpDir = path.join(os.tmpdir(), `soulkiller-snap-${crypto.randomUUID()}`)
  const soulDir = path.join(tmpDir, 'soul')
  const behaviorsDir = path.join(soulDir, 'behaviors')
  fs.mkdirSync(behaviorsDir, { recursive: true })
  fs.writeFileSync(path.join(soulDir, 'identity.md'), '# Identity\nOriginal identity.')
  fs.writeFileSync(path.join(soulDir, 'style.md'), '# Style\nOriginal style.')
  fs.writeFileSync(path.join(behaviorsDir, 'casual.md'), '# Casual\nOriginal behavior.')
  return tmpDir
}

describe('createSnapshot', () => {
  let soulDir: string

  beforeEach(() => {
    soulDir = setupSoulDir()
  })

  afterEach(() => {
    fs.rmSync(soulDir, { recursive: true, force: true })
  })

  it('creates a snapshot directory with soul files copy', () => {
    const id = createSnapshot(soulDir, 'test evolve', 100)

    const snapshotSoulDir = path.join(soulDir, 'snapshots', id, 'soul')
    expect(fs.existsSync(snapshotSoulDir)).toBe(true)
    expect(fs.readFileSync(path.join(snapshotSoulDir, 'identity.md'), 'utf-8')).toContain('Original identity.')
    expect(fs.existsSync(path.join(snapshotSoulDir, 'behaviors', 'casual.md'))).toBe(true)
  })

  it('writes snapshot-meta.json', () => {
    const id = createSnapshot(soulDir, 'pre-evolve', 42)

    const metaPath = path.join(soulDir, 'snapshots', id, 'snapshot-meta.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    expect(meta.reason).toBe('pre-evolve')
    expect(meta.chunk_count_at_time).toBe(42)
    expect(meta.timestamp).toBeTruthy()
  })

  it('throws when no soul directory exists', () => {
    const emptyDir = path.join(os.tmpdir(), `soulkiller-empty-${crypto.randomUUID()}`)
    fs.mkdirSync(emptyDir, { recursive: true })

    expect(() => createSnapshot(emptyDir, 'test', 0)).toThrow('No soul files to snapshot')

    fs.rmSync(emptyDir, { recursive: true, force: true })
  })
})

describe('listSnapshots', () => {
  let soulDir: string

  beforeEach(() => {
    soulDir = setupSoulDir()
  })

  afterEach(() => {
    fs.rmSync(soulDir, { recursive: true, force: true })
  })

  it('returns empty for soul with no snapshots', () => {
    expect(listSnapshots(soulDir)).toEqual([])
  })

  it('lists snapshots newest first', async () => {
    createSnapshot(soulDir, 'first', 10)
    // Ensure different timestamp
    await new Promise((r) => setTimeout(r, 10))
    createSnapshot(soulDir, 'second', 20)

    const snapshots = listSnapshots(soulDir)
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]!.meta.reason).toBe('second')
    expect(snapshots[1]!.meta.reason).toBe('first')
  })
})

describe('snapshot retention', () => {
  let soulDir: string

  beforeEach(() => {
    soulDir = setupSoulDir()
  })

  afterEach(() => {
    fs.rmSync(soulDir, { recursive: true, force: true })
  })

  it('keeps at most 10 snapshots', async () => {
    for (let i = 0; i < 12; i++) {
      createSnapshot(soulDir, `snapshot-${i}`, i)
      await new Promise((r) => setTimeout(r, 5))
    }

    const snapshots = listSnapshots(soulDir)
    expect(snapshots.length).toBeLessThanOrEqual(10)
  })
})

describe('restoreSnapshot', () => {
  let soulDir: string

  beforeEach(() => {
    soulDir = setupSoulDir()
  })

  afterEach(() => {
    fs.rmSync(soulDir, { recursive: true, force: true })
  })

  it('restores soul files from snapshot', async () => {
    // Create snapshot of original
    const snapId = createSnapshot(soulDir, 'original', 10)

    // Modify live soul files
    fs.writeFileSync(path.join(soulDir, 'soul', 'identity.md'), '# Identity\nModified identity.')

    // Restore
    restoreSnapshot(soulDir, snapId, 10)

    // Verify restored content
    const content = fs.readFileSync(path.join(soulDir, 'soul', 'identity.md'), 'utf-8')
    expect(content).toContain('Original identity.')
  })

  it('creates pre-rollback snapshot before restoring', async () => {
    const snapId = createSnapshot(soulDir, 'original', 10)
    await new Promise((r) => setTimeout(r, 10))

    // Modify and restore
    fs.writeFileSync(path.join(soulDir, 'soul', 'identity.md'), 'Modified')
    restoreSnapshot(soulDir, snapId, 10)

    // Should now have 3 snapshots: original + pre-rollback + (original again preserved)
    const snapshots = listSnapshots(soulDir)
    expect(snapshots.length).toBeGreaterThanOrEqual(2)
    expect(snapshots.some((s) => s.meta.reason === 'pre-rollback')).toBe(true)
  })
})
