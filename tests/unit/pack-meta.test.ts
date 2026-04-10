import { describe, it, expect } from 'vitest'
import { createMeta, parseMeta, validateVersion, FORMAT_VERSION, SUPPORTED_MAJOR } from '../../src/export/pack/meta.js'

describe('pack meta', () => {
  describe('createMeta', () => {
    it('creates a soul pack meta with correct fields', () => {
      const meta = createMeta('soul', 'alice', 'Alice', ['night-city'])
      expect(meta.format_version).toBe(FORMAT_VERSION)
      expect(meta.type).toBe('soul')
      expect(meta.name).toBe('alice')
      expect(meta.display_name).toBe('Alice')
      expect(meta.includes_worlds).toEqual(['night-city'])
      expect(meta.checksum).toBe('')
      expect(meta.packed_at).toBeTruthy()
      expect(meta.soulkiller_version).toBeTruthy()
    })

    it('creates a world pack meta with empty includes_worlds', () => {
      const meta = createMeta('world', 'night-city', 'Night City')
      expect(meta.type).toBe('world')
      expect(meta.includes_worlds).toEqual([])
    })
  })

  describe('parseMeta', () => {
    it('parses a valid meta JSON string', () => {
      const original = createMeta('soul', 'alice', 'Alice', ['nc'])
      original.checksum = 'sha256:abc123'
      const json = JSON.stringify(original)

      const parsed = parseMeta(json)
      expect(parsed.type).toBe('soul')
      expect(parsed.name).toBe('alice')
      expect(parsed.display_name).toBe('Alice')
      expect(parsed.includes_worlds).toEqual(['nc'])
      expect(parsed.checksum).toBe('sha256:abc123')
    })

    it('throws on missing required fields', () => {
      expect(() => parseMeta('{}')).toThrow('missing required fields')
    })

    it('fills defaults for optional fields', () => {
      const json = JSON.stringify({ format_version: '1.0', type: 'world', name: 'test' })
      const parsed = parseMeta(json)
      expect(parsed.display_name).toBe('test')
      expect(parsed.includes_worlds).toEqual([])
      expect(parsed.soulkiller_version).toBe('unknown')
    })
  })

  describe('validateVersion', () => {
    it('accepts compatible version 1.0', () => {
      const meta = createMeta('soul', 'test', 'Test')
      meta.format_version = '1.0'
      expect(validateVersion(meta)).toEqual({ ok: true })
    })

    it('accepts compatible version 1.5', () => {
      const meta = createMeta('soul', 'test', 'Test')
      meta.format_version = '1.5'
      expect(validateVersion(meta)).toEqual({ ok: true })
    })

    it('rejects incompatible major version 2.0', () => {
      const meta = createMeta('soul', 'test', 'Test')
      meta.format_version = '2.0'
      const result = validateVersion(meta)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Unsupported')
    })

    it('rejects garbage version', () => {
      const meta = createMeta('soul', 'test', 'Test')
      meta.format_version = 'garbage'
      const result = validateVersion(meta)
      expect(result.ok).toBe(false)
    })
  })
})
