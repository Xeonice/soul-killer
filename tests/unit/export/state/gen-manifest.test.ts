import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { buildManifest, shouldInclude, toCamelCase } from '../../../../scripts/gen-state-manifest.js'

describe('gen-state-manifest', () => {
  describe('shouldInclude', () => {
    it('accepts plain state/*.ts files', () => {
      expect(shouldInclude('apply.ts')).toBe(true)
      expect(shouldInclude('mini-yaml.ts')).toBe(true)
    })

    it('excludes manifest itself to prevent circular import', () => {
      expect(shouldInclude('manifest.ts')).toBe(false)
    })

    it('excludes test / spec files', () => {
      expect(shouldInclude('apply.test.ts')).toBe(false)
      expect(shouldInclude('apply.spec.ts')).toBe(false)
    })

    it('excludes hidden files', () => {
      expect(shouldInclude('.DS_Store')).toBe(false)
      expect(shouldInclude('.hidden.ts')).toBe(false)
    })

    it('excludes non-ts', () => {
      expect(shouldInclude('README.md')).toBe(false)
      expect(shouldInclude('foo.js')).toBe(false)
    })
  })

  describe('toCamelCase', () => {
    it('single-segment stays', () => {
      expect(toCamelCase('apply.ts')).toBe('apply')
    })

    it('kebab-case → camelCase', () => {
      expect(toCamelCase('mini-yaml.ts')).toBe('miniYaml')
      expect(toCamelCase('script-builder.ts')).toBe('scriptBuilder')
      expect(toCamelCase('viewer-server.ts')).toBe('viewerServer')
    })

    it('multi-hyphen', () => {
      expect(toCamelCase('foo-bar-baz.ts')).toBe('fooBarBaz')
    })
  })

  describe('buildManifest', () => {
    let tmp: string
    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-manifest-'))
    })
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

    function seed(files: Record<string, string>): void {
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(tmp, name), content)
      }
    }

    it('produces stable alphabetical ordering regardless of input order', () => {
      seed({ 'a.ts': 'export const a = 1', 'b.ts': 'export const b = 2', 'c.ts': 'export const c = 3' })
      const m1 = buildManifest(['b.ts', 'a.ts', 'c.ts'], tmp)
      const m2 = buildManifest(['c.ts', 'b.ts', 'a.ts'], tmp)
      expect(m1).toBe(m2)
    })

    it('inlines file content as JSON-stringified string literal', () => {
      const content = 'export const x = 42\n// a comment with "quotes" and `backticks`'
      seed({ 'apply.ts': content })
      const manifest = buildManifest(['apply.ts'], tmp)
      // JSON.stringify escapes quotes and preserves newlines as \n
      expect(manifest).toContain(JSON.stringify(content))
    })

    it('exports RUNTIME_FILES keyed by original filename', () => {
      seed({ 'mini-yaml.ts': 'hi' })
      const manifest = buildManifest(['mini-yaml.ts'], tmp)
      expect(manifest).toContain(`"mini-yaml.ts": "hi"`)
    })

    it('starts with generator header', () => {
      seed({ 'apply.ts': 'x' })
      const manifest = buildManifest(['apply.ts'], tmp)
      expect(manifest.startsWith('/**\n * GENERATED FILE — DO NOT EDIT.')).toBe(true)
    })
  })
})
