import { describe, it, expect } from 'vitest'
import {
  loadStateSchema,
  buildInitialState,
  applyDelta,
  validateFieldType,
  parseStateFile,
  StateSchemaError,
  type StateSchema,
  type StateRecord,
} from '../../../../src/export/state/schema.js'

function sampleSchema(): StateSchema {
  return loadStateSchema({
    'affinity.judy.bond': {
      type: 'int',
      desc: 'bond with judy',
      default: 0,
      range: [0, 10],
    },
    'affinity.judy.trust': {
      type: 'int',
      desc: 'trust with judy',
      default: 3,
      range: [0, 10],
    },
    'flags.met_johnny': {
      type: 'bool',
      desc: 'has met johnny',
      default: false,
    },
    'custom.location': {
      type: 'enum',
      desc: 'current location',
      default: 'bar',
      values: ['bar', 'clinic', 'afterlife'],
    },
    'custom.note': {
      type: 'string',
      desc: 'free-form note',
      default: '',
    },
  })
}

describe('loadStateSchema', () => {
  it('parses a valid schema', () => {
    const s = sampleSchema()
    expect(s['affinity.judy.bond']).toMatchObject({
      type: 'int',
      default: 0,
      range: [0, 10],
    })
    expect(s['flags.met_johnny']).toMatchObject({ type: 'bool', default: false })
    expect(s['custom.location']).toMatchObject({
      type: 'enum',
      default: 'bar',
      values: ['bar', 'clinic', 'afterlife'],
    })
    expect(s['custom.note']).toMatchObject({ type: 'string', default: '' })
  })

  it('rejects non-object input', () => {
    expect(() => loadStateSchema(null)).toThrow(StateSchemaError)
    expect(() => loadStateSchema([])).toThrow(StateSchemaError)
    expect(() => loadStateSchema('foo')).toThrow(StateSchemaError)
  })

  it('rejects unknown field type', () => {
    expect(() =>
      loadStateSchema({
        x: { type: 'float', default: 1.5 },
      })
    ).toThrow(/unknown type/)
  })

  it('rejects int without range', () => {
    expect(() =>
      loadStateSchema({
        x: { type: 'int', default: 0 },
      })
    ).toThrow(/range/)
  })

  it('rejects int default out of range', () => {
    expect(() =>
      loadStateSchema({
        x: { type: 'int', default: 100, range: [0, 10] },
      })
    ).toThrow(/out of range/)
  })

  it('rejects int range min > max', () => {
    expect(() =>
      loadStateSchema({
        x: { type: 'int', default: 5, range: [10, 0] },
      })
    ).toThrow(/invalid int range/)
  })

  it('rejects non-integer int default', () => {
    expect(() =>
      loadStateSchema({
        x: { type: 'int', default: 1.5, range: [0, 10] },
      })
    ).toThrow(/integer/)
  })

  it('rejects enum default not in values', () => {
    expect(() =>
      loadStateSchema({
        loc: { type: 'enum', default: 'mars', values: ['earth', 'moon'] },
      })
    ).toThrow(/not in values/)
  })

  it('rejects enum with empty values', () => {
    expect(() =>
      loadStateSchema({
        loc: { type: 'enum', default: 'x', values: [] },
      })
    ).toThrow(/non-empty/)
  })

  it('rejects bool with non-boolean default', () => {
    expect(() =>
      loadStateSchema({
        flag: { type: 'bool', default: 'yes' },
      })
    ).toThrow(/boolean/)
  })
})

describe('buildInitialState', () => {
  it('materializes every field from its default', () => {
    const s = sampleSchema()
    expect(buildInitialState(s)).toEqual({
      'affinity.judy.bond': 0,
      'affinity.judy.trust': 3,
      'flags.met_johnny': false,
      'custom.location': 'bar',
      'custom.note': '',
    })
  })

  it('field set equals schema key set', () => {
    const s = sampleSchema()
    expect(Object.keys(buildInitialState(s)).sort()).toEqual(Object.keys(s).sort())
  })
})

describe('applyDelta — int', () => {
  it('adds positive delta within range', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    const entry = applyDelta(s, state, 'affinity.judy.trust', 2)
    expect(state['affinity.judy.trust']).toBe(5)
    expect(entry).toMatchObject({
      key: 'affinity.judy.trust',
      type: 'int',
      oldValue: 3,
      newValue: 5,
      clamped: false,
    })
  })

  it('subtracts negative delta', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    applyDelta(s, state, 'affinity.judy.trust', -2)
    expect(state['affinity.judy.trust']).toBe(1)
  })

  it('clamps to upper bound', () => {
    const s = sampleSchema()
    const state: StateRecord = { ...buildInitialState(s), 'affinity.judy.trust': 9 }
    const entry = applyDelta(s, state, 'affinity.judy.trust', 5)
    expect(state['affinity.judy.trust']).toBe(10)
    expect(entry.clamped).toBe(true)
  })

  it('clamps to lower bound', () => {
    const s = sampleSchema()
    const state: StateRecord = { ...buildInitialState(s), 'affinity.judy.trust': 1 }
    const entry = applyDelta(s, state, 'affinity.judy.trust', -10)
    expect(state['affinity.judy.trust']).toBe(0)
    expect(entry.clamped).toBe(true)
  })

  it('rejects non-integer delta', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'affinity.judy.trust', 1.5)).toThrow(/int delta/)
  })

  it('rejects string delta for int field', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'affinity.judy.trust', '+2')).toThrow(/int delta/)
  })
})

describe('applyDelta — bool', () => {
  it('overwrites to true', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    applyDelta(s, state, 'flags.met_johnny', true)
    expect(state['flags.met_johnny']).toBe(true)
  })

  it('overwrites to false', () => {
    const s = sampleSchema()
    const state: StateRecord = { ...buildInitialState(s), 'flags.met_johnny': true }
    applyDelta(s, state, 'flags.met_johnny', false)
    expect(state['flags.met_johnny']).toBe(false)
  })

  it('rejects non-boolean delta', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'flags.met_johnny', 1)).toThrow(/bool/)
  })
})

describe('applyDelta — enum', () => {
  it('overwrites to a valid value', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    applyDelta(s, state, 'custom.location', 'clinic')
    expect(state['custom.location']).toBe('clinic')
  })

  it('rejects value not in enum', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'custom.location', 'mars')).toThrow(/not in/)
  })

  it('rejects non-string delta', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'custom.location', 2)).toThrow(/enum/)
  })
})

describe('applyDelta — string', () => {
  it('overwrites to any string', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    applyDelta(s, state, 'custom.note', 'johnny visited')
    expect(state['custom.note']).toBe('johnny visited')
  })

  it('rejects non-string delta', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'custom.note', 42)).toThrow(/string/)
  })
})

describe('applyDelta — unknown key', () => {
  it('throws on unknown key', () => {
    const s = sampleSchema()
    const state: StateRecord = buildInitialState(s)
    expect(() => applyDelta(s, state, 'affinity.ghost.bond', 1)).toThrow(/unknown state key/)
  })

  it('throws when state is missing a schema field', () => {
    const s = sampleSchema()
    const state: StateRecord = { 'affinity.judy.bond': 0 }
    expect(() => applyDelta(s, state, 'affinity.judy.trust', 1)).toThrow(/not initialized/)
  })
})

describe('validateFieldType', () => {
  it('accepts matching types', () => {
    const s = sampleSchema()
    expect(validateFieldType(s['affinity.judy.bond']!, 5)).toBe(true)
    expect(validateFieldType(s['flags.met_johnny']!, true)).toBe(true)
    expect(validateFieldType(s['custom.location']!, 'bar')).toBe(true)
    expect(validateFieldType(s['custom.note']!, 'anything')).toBe(true)
  })

  it('rejects type mismatches', () => {
    const s = sampleSchema()
    expect(validateFieldType(s['affinity.judy.bond']!, 'five')).toBe(false)
    expect(validateFieldType(s['flags.met_johnny']!, 1)).toBe(false)
    expect(validateFieldType(s['custom.location']!, 'mars')).toBe(false)
  })
})

describe('parseStateFile', () => {
  it('parses a standard state.yaml', () => {
    const text =
      'current_scene: scene-005\n' +
      'state:\n' +
      '  "affinity.judy.trust": 5\n' +
      '  "flags.met_johnny": true\n'
    const parsed = parseStateFile(text)
    expect(parsed.currentScene).toBe('scene-005')
    expect(parsed.state).toEqual({
      'affinity.judy.trust': 5,
      'flags.met_johnny': true,
    })
  })

  it('rejects missing current_scene', () => {
    expect(() => parseStateFile('state:\n  "a": 1\n')).toThrow(/current_scene/)
  })

  it('rejects missing state block', () => {
    expect(() => parseStateFile('current_scene: scene-001\n')).toThrow(/state:/)
  })
})
