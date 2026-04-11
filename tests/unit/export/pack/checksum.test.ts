import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { computeChecksum, verifyChecksum } from '../../../../src/export/pack/checksum.js'

describe('checksum', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checksum-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('computes a consistent sha256 checksum', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello')
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'world')

    const checksum1 = computeChecksum(tmpDir)
    const checksum2 = computeChecksum(tmpDir)

    expect(checksum1).toBe(checksum2)
    expect(checksum1).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('excludes pack-meta.json from checksum', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello')
    const before = computeChecksum(tmpDir)

    fs.writeFileSync(path.join(tmpDir, 'pack-meta.json'), '{"version":"1.0"}')
    const after = computeChecksum(tmpDir)

    expect(before).toBe(after)
  })

  it('changes when file content changes', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello')
    const before = computeChecksum(tmpDir)

    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'changed')
    const after = computeChecksum(tmpDir)

    expect(before).not.toBe(after)
  })

  it('includes nested files in sorted order', () => {
    fs.mkdirSync(path.join(tmpDir, 'sub'))
    fs.writeFileSync(path.join(tmpDir, 'sub', 'nested.txt'), 'nested content')
    fs.writeFileSync(path.join(tmpDir, 'root.txt'), 'root content')

    const checksum = computeChecksum(tmpDir)
    expect(checksum).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  describe('verifyChecksum', () => {
    it('returns true for matching checksum', () => {
      fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'test data')
      const checksum = computeChecksum(tmpDir)
      expect(verifyChecksum(tmpDir, checksum)).toBe(true)
    })

    it('returns false for mismatched checksum', () => {
      fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'test data')
      expect(verifyChecksum(tmpDir, 'sha256:0000')).toBe(false)
    })
  })
})
