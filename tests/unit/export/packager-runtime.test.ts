import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  injectRuntimeFiles,
  countMdFilesInMap,
  estimateMdTextSizeKb,
} from '../../../src/export/packager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_SRC = path.resolve(__dirname, '../../../src/export/state')

describe('injectRuntimeFiles', () => {
  it('adds all .ts files to the archive map under runtime/lib/', () => {
    const files: Record<string, Uint8Array> = {}
    injectRuntimeFiles(files)

    // Shell wrappers are no longer shipped
    expect(files['runtime/bin/doctor.sh']).toBeUndefined()
    expect(files['runtime/bin/state']).toBeUndefined()
    expect(files['runtime/bin/state.sh']).toBeUndefined()

    // lib/*.ts — must include every .ts present in src/export/state/
    // (excluding manifest.ts, which is the generated list itself)
    const sourceTs = fs
      .readdirSync(STATE_SRC)
      .filter((f) => f.endsWith('.ts') && f !== 'manifest.ts')
      .sort()
    expect(sourceTs.length).toBeGreaterThan(5)
    for (const ts of sourceTs) {
      const key = `runtime/lib/${ts}`
      expect(files[key]).toBeInstanceOf(Uint8Array)
    }
  })

  it('copies file content byte-for-byte from source', () => {
    const files: Record<string, Uint8Array> = {}
    injectRuntimeFiles(files)

    const sourceText = fs.readFileSync(path.join(STATE_SRC, 'mini-yaml.ts'), 'utf8')
    const injected = new TextDecoder().decode(files['runtime/lib/mini-yaml.ts']!)
    expect(injected).toBe(sourceText)
  })

  it('returns void (no executable paths needed)', () => {
    const files: Record<string, Uint8Array> = {}
    const result = injectRuntimeFiles(files)
    expect(result).toBeUndefined()
  })

  it('does not overwrite unrelated archive entries', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array([1, 2, 3]),
      'souls/judy/identity.md': new Uint8Array([4, 5, 6]),
    }
    injectRuntimeFiles(files)
    expect(files['SKILL.md']).toEqual(new Uint8Array([1, 2, 3]))
    expect(files['souls/judy/identity.md']).toEqual(new Uint8Array([4, 5, 6]))
  })
})

describe('countMdFilesInMap — runtime exclusion', () => {
  it('excludes every runtime/ entry regardless of extension', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(100),
      'souls/judy/identity.md': new Uint8Array(200),
      'souls/judy/style.md': new Uint8Array(300),
      'story-spec.md': new Uint8Array(400),
      // Runtime code — must NOT be counted
      'runtime/lib/main.ts': new Uint8Array(700),
      'runtime/lib/apply.ts': new Uint8Array(800),
      // Hypothetical .md accidentally placed under runtime/ — still excluded
      'runtime/lib/README.md': new Uint8Array(900),
    }
    expect(countMdFilesInMap(files)).toBe(4)
  })

  it('excludes runtime/ from size estimate', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(1024),
      'souls/judy/identity.md': new Uint8Array(2048),
      // 10 KB of runtime code — should not contribute to budget
      'runtime/lib/big-file.ts': new Uint8Array(10240),
      'runtime/lib/README.md': new Uint8Array(5120),
    }
    // (1024 + 2048) / 1024 = 3 KB
    expect(estimateMdTextSizeKb(files)).toBe(3)
  })
})

describe('injectRuntimeFiles + countMdFilesInMap integration', () => {
  it('injecting runtime does not change creative md count or size', () => {
    const files: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(5000),
      'souls/judy/identity.md': new Uint8Array(3000),
      'souls/judy/style.md': new Uint8Array(2000),
      'story-spec.md': new Uint8Array(1500),
    }
    const countBefore = countMdFilesInMap(files)
    const sizeBefore = estimateMdTextSizeKb(files)

    injectRuntimeFiles(files)

    expect(countMdFilesInMap(files)).toBe(countBefore)
    expect(estimateMdTextSizeKb(files)).toBe(sizeBefore)
  })
})
