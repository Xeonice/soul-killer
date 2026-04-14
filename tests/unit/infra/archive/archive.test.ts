import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { createTarGzip } from 'nanotar'
import { extractZip, extractTarGz, detectCommonRoot } from '../../../../src/infra/archive/index.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('extractZip', () => {
  it('extracts flat entries', () => {
    const zip = zipSync({
      'SKILL.md': strToU8('# skill'),
      'souls/alpha/identity.md': strToU8('alpha'),
    })
    extractZip(zip, tmpDir)

    expect(fs.readFileSync(path.join(tmpDir, 'SKILL.md'), 'utf8')).toBe('# skill')
    expect(fs.readFileSync(path.join(tmpDir, 'souls/alpha/identity.md'), 'utf8')).toBe('alpha')
  })

  it('preserves non-ASCII file names', () => {
    const zip = zipSync({
      '角色.md': strToU8('中文内容'),
      'carpeta con espacios/file.txt': strToU8('ok'),
    })
    extractZip(zip, tmpDir)

    expect(fs.readFileSync(path.join(tmpDir, '角色.md'), 'utf8')).toBe('中文内容')
    expect(fs.readFileSync(path.join(tmpDir, 'carpeta con espacios/file.txt'), 'utf8')).toBe('ok')
  })

  it('strips single root directory when opts.stripSingleRootDir', () => {
    const zip = zipSync({
      'fate-zero/SKILL.md': strToU8('# fate'),
      'fate-zero/souls/saber/identity.md': strToU8('saber'),
    })
    extractZip(zip, tmpDir, { stripSingleRootDir: true })

    expect(fs.existsSync(path.join(tmpDir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'fate-zero'))).toBe(false)
    expect(fs.readFileSync(path.join(tmpDir, 'souls/saber/identity.md'), 'utf8')).toBe('saber')
  })

  it('does not strip when root has multiple top-level entries', () => {
    const zip = zipSync({
      'SKILL.md': strToU8('# root'),
      'souls/a/x.md': strToU8('a'),
    })
    extractZip(zip, tmpDir, { stripSingleRootDir: true })

    expect(fs.existsSync(path.join(tmpDir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'souls/a/x.md'))).toBe(true)
  })

  it('rejects path traversal attempts', () => {
    const zip = zipSync({ '../escape.txt': strToU8('bad') })
    expect(() => extractZip(zip, tmpDir)).toThrow(/escapes output directory/)
  })
})

describe('extractTarGz', () => {
  it('round-trips tar.gz', async () => {
    const tarGz = await createTarGzip([
      { name: 'pack-meta.json', data: strToU8('{"kind":"soul"}') },
      { name: 'souls/beta/identity.md', data: strToU8('beta') },
    ])
    extractTarGz(tarGz, tmpDir)

    expect(fs.readFileSync(path.join(tmpDir, 'pack-meta.json'), 'utf8')).toBe('{"kind":"soul"}')
    expect(fs.readFileSync(path.join(tmpDir, 'souls/beta/identity.md'), 'utf8')).toBe('beta')
  })

  it('handles non-ASCII names', async () => {
    const tarGz = await createTarGzip([
      { name: 'ファイル.txt', data: strToU8('日本語') },
    ])
    extractTarGz(tarGz, tmpDir)

    expect(fs.readFileSync(path.join(tmpDir, 'ファイル.txt'), 'utf8')).toBe('日本語')
  })
})

describe('detectCommonRoot', () => {
  it('returns prefix when all entries share top-level dir', () => {
    expect(detectCommonRoot([
      { path: 'fate-zero/SKILL.md', isDirectory: false },
      { path: 'fate-zero/souls/saber/x.md', isDirectory: false },
    ])).toBe('fate-zero/')
  })

  it('returns null when there are top-level files', () => {
    expect(detectCommonRoot([
      { path: 'SKILL.md', isDirectory: false },
      { path: 'souls/a.md', isDirectory: false },
    ])).toBe(null)
  })

  it('returns null for mixed top-level dirs', () => {
    expect(detectCommonRoot([
      { path: 'a/x.md', isDirectory: false },
      { path: 'b/y.md', isDirectory: false },
    ])).toBe(null)
  })
})
