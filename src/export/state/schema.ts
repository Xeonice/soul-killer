/**
 * StateSchema: typed representation of the `state_schema` block embedded at
 * the top of every runtime/scripts/script-<id>.yaml. Drives all state writes
 * at skill runtime.
 *
 * This module is the single source of truth for:
 *   - what fields exist in a script
 *   - how to apply a consequences delta to a state field (clamp / overwrite)
 *   - how to materialize initial state from the schema
 *
 * It is intentionally free of filesystem access — the init/apply/validate/
 * rebuild/reset command modules compose it with mini-yaml IO.
 */

import { parseMiniYaml, type MiniBlock, type MiniPrimitive } from './mini-yaml.js'

export type StateFieldType = 'int' | 'bool' | 'enum' | 'string'

export interface IntField {
  type: 'int'
  desc: string
  default: number
  range: [number, number]
}

export interface BoolField {
  type: 'bool'
  desc: string
  default: boolean
}

export interface EnumField {
  type: 'enum'
  desc: string
  default: string
  values: string[]
}

export interface StringField {
  type: 'string'
  desc: string
  default: string
}

export type StateField = IntField | BoolField | EnumField | StringField

export type StateSchema = Record<string, StateField>

export type StateRecord = Record<string, MiniPrimitive>

export class StateSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StateSchemaError'
  }
}

/**
 * Load the state_schema block from a parsed script.yaml document.
 *
 * Expects the script document to have a top-level `state_schema:` mapping
 * where each entry is itself a mapping with `type/desc/default/...` keys.
 * Since mini-yaml only supports one nesting level, the script.yaml is
 * parsed with a more permissive parser upstream (yaml lib). This function
 * accepts an already-parsed plain object.
 */
export function loadStateSchema(raw: unknown): StateSchema {
  if (!isPlainObject(raw)) {
    throw new StateSchemaError('state_schema must be a mapping')
  }
  const schema: StateSchema = {}
  for (const [key, fieldRaw] of Object.entries(raw)) {
    schema[key] = parseField(key, fieldRaw)
  }
  return schema
}

function parseField(key: string, raw: unknown): StateField {
  if (!isPlainObject(raw)) {
    throw new StateSchemaError(`field "${key}" must be a mapping`)
  }
  const type = raw.type
  const desc = typeof raw.desc === 'string' ? raw.desc : ''
  if (type === 'int') {
    const def = raw.default
    const range = raw.range
    if (typeof def !== 'number' || !Number.isInteger(def)) {
      throw new StateSchemaError(`field "${key}": int default must be integer`)
    }
    if (!Array.isArray(range) || range.length !== 2) {
      throw new StateSchemaError(`field "${key}": int range must be [min, max]`)
    }
    const [min, max] = range
    if (
      typeof min !== 'number' ||
      typeof max !== 'number' ||
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min > max
    ) {
      throw new StateSchemaError(`field "${key}": invalid int range`)
    }
    if (def < min || def > max) {
      throw new StateSchemaError(`field "${key}": default ${def} out of range [${min}, ${max}]`)
    }
    return { type: 'int', desc, default: def, range: [min, max] }
  }
  if (type === 'bool') {
    if (typeof raw.default !== 'boolean') {
      throw new StateSchemaError(`field "${key}": bool default must be boolean`)
    }
    return { type: 'bool', desc, default: raw.default }
  }
  if (type === 'enum') {
    const values = raw.values
    if (!Array.isArray(values) || values.some((v) => typeof v !== 'string') || values.length === 0) {
      throw new StateSchemaError(`field "${key}": enum values must be non-empty string array`)
    }
    const def = raw.default
    if (typeof def !== 'string' || !values.includes(def)) {
      throw new StateSchemaError(`field "${key}": enum default "${String(def)}" not in values`)
    }
    return { type: 'enum', desc, default: def, values: values.slice() as string[] }
  }
  if (type === 'string') {
    if (typeof raw.default !== 'string') {
      throw new StateSchemaError(`field "${key}": string default must be string`)
    }
    return { type: 'string', desc, default: raw.default }
  }
  throw new StateSchemaError(`field "${key}": unknown type "${String(type)}"`)
}

/**
 * Build an initial state record from schema defaults. Output is a flat
 * key→primitive map, ready to be placed into state.yaml's `state:` block.
 */
export function buildInitialState(schema: StateSchema): StateRecord {
  const out: StateRecord = {}
  for (const [key, field] of Object.entries(schema)) {
    out[key] = field.default
  }
  return out
}

/**
 * Apply a single consequences delta to a state record. Mutates `state` in
 * place. Returns a ChangeEntry describing the effect for stdout reporting.
 *
 * Semantics:
 *   - int:    new = clamp(old + delta, range)
 *   - bool:   new = delta (overwrite, delta must be boolean)
 *   - enum:   new = delta (overwrite, delta must be in values)
 *   - string: new = delta (overwrite)
 */
export interface ChangeEntry {
  key: string
  type: StateFieldType
  oldValue: MiniPrimitive
  newValue: MiniPrimitive
  clamped?: boolean
}

export function applyDelta(
  schema: StateSchema,
  state: StateRecord,
  key: string,
  rawDelta: unknown
): ChangeEntry {
  const field = schema[key]
  if (field === undefined) {
    throw new StateSchemaError(`unknown state key: "${key}"`)
  }
  const oldValue = state[key]
  if (oldValue === undefined) {
    throw new StateSchemaError(`state missing field "${key}" (not initialized)`)
  }

  if (field.type === 'int') {
    if (typeof rawDelta !== 'number' || !Number.isInteger(rawDelta)) {
      throw new StateSchemaError(
        `field "${key}" expects int delta, got ${JSON.stringify(rawDelta)}`
      )
    }
    if (typeof oldValue !== 'number') {
      throw new StateSchemaError(`state[${key}] has wrong type (expected int)`)
    }
    const [min, max] = field.range
    const raw = oldValue + rawDelta
    const clampedValue = Math.max(min, Math.min(max, raw))
    state[key] = clampedValue
    return {
      key,
      type: 'int',
      oldValue,
      newValue: clampedValue,
      clamped: raw !== clampedValue,
    }
  }

  if (field.type === 'bool') {
    if (typeof rawDelta !== 'boolean') {
      throw new StateSchemaError(
        `field "${key}" expects bool, got ${JSON.stringify(rawDelta)}`
      )
    }
    state[key] = rawDelta
    return { key, type: 'bool', oldValue, newValue: rawDelta }
  }

  if (field.type === 'enum') {
    if (typeof rawDelta !== 'string') {
      throw new StateSchemaError(
        `field "${key}" expects enum string, got ${JSON.stringify(rawDelta)}`
      )
    }
    if (!field.values.includes(rawDelta)) {
      throw new StateSchemaError(
        `field "${key}": value "${rawDelta}" not in [${field.values.join(', ')}]`
      )
    }
    state[key] = rawDelta
    return { key, type: 'enum', oldValue, newValue: rawDelta }
  }

  // string
  if (typeof rawDelta !== 'string') {
    throw new StateSchemaError(
      `field "${key}" expects string, got ${JSON.stringify(rawDelta)}`
    )
  }
  state[key] = rawDelta
  return { key, type: 'string', oldValue, newValue: rawDelta }
}

/**
 * Check if the value in a state record matches the schema type. Used by
 * validate.ts to flag type drift.
 */
export function validateFieldType(
  field: StateField,
  value: MiniPrimitive
): boolean {
  if (field.type === 'int') {
    return typeof value === 'number' && Number.isInteger(value)
  }
  if (field.type === 'bool') {
    return typeof value === 'boolean'
  }
  if (field.type === 'enum') {
    return typeof value === 'string' && field.values.includes(value)
  }
  return typeof value === 'string'
}

/**
 * Parse a state.yaml file content into { current_scene, state } using
 * mini-yaml. Throws if the shape is unexpected.
 */
export interface ParsedStateFile {
  currentScene: string
  state: StateRecord
}

export function parseStateFile(text: string): ParsedStateFile {
  const doc = parseMiniYaml(text)
  const currentScene = doc.current_scene
  const stateBlock = doc.state
  if (typeof currentScene !== 'string') {
    throw new StateSchemaError('state.yaml missing top-level current_scene')
  }
  if (!isMiniBlock(stateBlock)) {
    throw new StateSchemaError('state.yaml missing top-level state: block')
  }
  return { currentScene, state: { ...stateBlock } }
}

function isMiniBlock(v: unknown): v is MiniBlock {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
