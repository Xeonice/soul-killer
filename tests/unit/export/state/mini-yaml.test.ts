import { describe, it, expect } from 'vitest'
import {
  parseMiniYaml,
  serializeMiniYaml,
  MiniYamlError,
  type MiniDocument,
} from '../../../../src/export/state/mini-yaml.js'

describe('parseMiniYaml — flat top-level', () => {
  it('parses bare string values', () => {
    const doc = parseMiniYaml('script_ref: script-001\ncurrent_scene: scene-005\n')
    expect(doc).toEqual({
      script_ref: 'script-001',
      current_scene: 'scene-005',
    })
  })

  it('parses quoted string values', () => {
    const doc = parseMiniYaml('current_scene: "scene-005"\n')
    expect(doc).toEqual({ current_scene: 'scene-005' })
  })

  it('parses integer values', () => {
    const doc = parseMiniYaml('count: 42\nneg: -7\nzero: 0\n')
    expect(doc).toEqual({ count: 42, neg: -7, zero: 0 })
  })

  it('parses boolean values', () => {
    const doc = parseMiniYaml('ok: true\nfail: false\n')
    expect(doc).toEqual({ ok: true, fail: false })
  })

  it('rejects float values', () => {
    expect(() => parseMiniYaml('pi: 3.14\n')).toThrow(MiniYamlError)
  })

  it('rejects tabs', () => {
    expect(() => parseMiniYaml('\tkey: value\n')).toThrow(/tabs/)
  })

  it('skips blank lines', () => {
    const doc = parseMiniYaml('a: 1\n\nb: 2\n')
    expect(doc).toEqual({ a: 1, b: 2 })
  })

  it('skips comment lines', () => {
    const doc = parseMiniYaml('# comment\na: 1\n# another\nb: 2\n')
    expect(doc).toEqual({ a: 1, b: 2 })
  })

  it('rejects duplicate top-level keys', () => {
    expect(() => parseMiniYaml('a: 1\na: 2\n')).toThrow(/duplicate/)
  })

  it('rejects empty key', () => {
    expect(() => parseMiniYaml(': value\n')).toThrow(MiniYamlError)
  })
})

describe('parseMiniYaml — one-level block', () => {
  it('parses a state.yaml-shaped document', () => {
    const text =
      'current_scene: "scene-005"\n' +
      'state:\n' +
      '  "affinity.judy.trust": 5\n' +
      '  "flags.met_johnny": true\n' +
      '  "custom.location": bar\n'
    const doc = parseMiniYaml(text)
    expect(doc).toEqual({
      current_scene: 'scene-005',
      state: {
        'affinity.judy.trust': 5,
        'flags.met_johnny': true,
        'custom.location': 'bar',
      },
    })
  })

  it('handles empty block', () => {
    const doc = parseMiniYaml('state:\n')
    expect(doc).toEqual({ state: {} })
  })

  it('closes block on next top-level key', () => {
    const text =
      'state:\n' +
      '  "a": 1\n' +
      '  "b": 2\n' +
      'top: done\n'
    const doc = parseMiniYaml(text)
    expect(doc).toEqual({
      state: { a: 1, b: 2 },
      top: 'done',
    })
  })

  it('rejects nested block inside a block', () => {
    const text =
      'state:\n' +
      '  "a":\n'
    expect(() => parseMiniYaml(text)).toThrow(/nested block/)
  })

  it('rejects indented entry without parent block', () => {
    expect(() => parseMiniYaml('  "a": 1\n')).toThrow(/without parent block/)
  })

  it('rejects indentation other than 0 or 2', () => {
    const text =
      'state:\n' +
      '    "a": 1\n'
    expect(() => parseMiniYaml(text)).toThrow(/unexpected indentation/)
  })

  it('rejects duplicate keys inside a block', () => {
    const text =
      'state:\n' +
      '  "a": 1\n' +
      '  "a": 2\n'
    expect(() => parseMiniYaml(text)).toThrow(/duplicate/)
  })
})

describe('serializeMiniYaml', () => {
  it('serializes flat top-level document', () => {
    const doc: MiniDocument = {
      script_ref: 'script-001',
      current_scene: 'scene-005',
    }
    expect(serializeMiniYaml(doc)).toBe(
      'script_ref: script-001\ncurrent_scene: scene-005\n'
    )
  })

  it('serializes a state.yaml-shaped document with quoted block keys', () => {
    const doc: MiniDocument = {
      current_scene: 'scene-005',
      state: {
        'affinity.judy.trust': 5,
        'flags.met_johnny': true,
        'custom.location': 'bar',
      },
    }
    const out = serializeMiniYaml(doc)
    expect(out).toBe(
      'current_scene: scene-005\n' +
        'state:\n' +
        '  "affinity.judy.trust": 5\n' +
        '  "flags.met_johnny": true\n' +
        '  "custom.location": bar\n'
    )
  })

  it('quotes strings that collide with reserved tokens', () => {
    const doc: MiniDocument = {
      a: 'true',
      b: 'false',
      c: '42',
    }
    expect(serializeMiniYaml(doc)).toBe('a: "true"\nb: "false"\nc: "42"\n')
  })

  it('quotes empty strings', () => {
    const doc: MiniDocument = { empty: '' }
    expect(serializeMiniYaml(doc)).toBe('empty: ""\n')
  })

  it('quotes strings with whitespace or special chars', () => {
    const doc: MiniDocument = {
      a: 'hello world',
      b: 'key: value',
    }
    const out = serializeMiniYaml(doc)
    expect(out).toBe('a: "hello world"\nb: "key: value"\n')
  })

  it('rejects non-integer numbers', () => {
    const doc = { x: 3.14 } as unknown as MiniDocument
    expect(() => serializeMiniYaml(doc)).toThrow(/non-integer/)
  })
})

describe('parseMiniYaml ↔ serializeMiniYaml round-trip', () => {
  it('state.yaml shape round-trips byte-identically', () => {
    const text =
      'current_scene: scene-005\n' +
      'state:\n' +
      '  "affinity.judy.trust": 5\n' +
      '  "flags.met_johnny": true\n' +
      '  "custom.location": bar\n'
    expect(serializeMiniYaml(parseMiniYaml(text))).toBe(text)
  })

  it('meta.yaml shape round-trips byte-identically', () => {
    const text =
      'script_ref: script-001\n' +
      'current_scene: scene-005\n' +
      'last_played_at: "2026-04-08T14:23:00Z"\n'
    expect(serializeMiniYaml(parseMiniYaml(text))).toBe(text)
  })

  it('preserves integer values with clamp-sensitive edge values', () => {
    const text =
      'state:\n' +
      '  "affinity.judy.bond": 0\n' +
      '  "affinity.judy.trust": 10\n' +
      '  "counters.attempts": -3\n'
    const doc = parseMiniYaml(text)
    expect(doc).toEqual({
      state: {
        'affinity.judy.bond': 0,
        'affinity.judy.trust': 10,
        'counters.attempts': -3,
      },
    })
    expect(serializeMiniYaml(doc)).toBe(text)
  })
})
