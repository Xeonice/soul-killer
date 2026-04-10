/**
 * `state validate <script-id> [<save-type>] [--continue]`
 *
 * Six-fold load-time validation (plus a 7th check for continue-game). Writes
 * nothing. Returns a structured JSON diagnostic to be consumed by the LLM
 * via stdout.
 *
 * Error codes:
 *   DANGLING_SCRIPT_REF        — meta.script_ref points to a missing file
 *   STATE_SCHEMA_MISSING       — script has no state_schema block
 *   INITIAL_STATE_MISMATCH     — initial_state field set != schema field set
 *   CONSEQUENCES_UNKNOWN_KEY   — a choice references a key not in schema
 *   SHARED_AXES_INCOMPLETE     — a character lacks the 3 required shared axes
 *   FLAGS_SET_MISMATCH         — script's flags.* keys don't match story flags
 *   FIELD_MISSING              — state.yaml is missing a schema field (continue-only)
 *   FIELD_EXTRA                — state.yaml has a field not in schema
 *   FIELD_TYPE_MISMATCH        — a state value's type differs from schema
 *   MALFORMED                  — any other parse/read error
 */

import { existsSync, readFileSync } from 'node:fs'
import { validateFieldType, type StateSchema } from './schema.js'
import { parseScript, type ParsedScript } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  readMetaFile,
  readStateFile,
  type SaveType,
} from './io.js'

export interface ValidateError {
  code: string
  message: string
  field?: string
  expected?: unknown
  actual?: unknown
}

export interface ValidateResult {
  ok: boolean
  errors: ValidateError[]
}

export interface ValidateOptions {
  /** If provided, runs the 7th check that state.yaml matches schema. */
  continueGame?: boolean
  /** Story-level shared axes (bond is implicit). */
  sharedAxes?: string[]
  /** Story-level flag name whitelist. */
  storyFlags?: string[]
}

export function runValidate(
  skillRoot: string,
  scriptId: string,
  saveType: SaveType = 'auto',
  options: ValidateOptions = {}
): ValidateResult {
  const errors: ValidateError[] = []
  const paths = resolveSavePaths(skillRoot, scriptId, saveType)

  // Read meta.yaml
  if (!existsSync(paths.metaYamlPath)) {
    return {
      ok: false,
      errors: [
        {
          code: 'MALFORMED',
          message: `meta.yaml not found at ${paths.metaYamlPath}`,
        },
      ],
    }
  }

  let meta
  try {
    meta = readMetaFile(paths.metaYamlPath)
  } catch (err) {
    return {
      ok: false,
      errors: [
        { code: 'MALFORMED', message: (err as Error).message },
      ],
    }
  }

  // 1. Dangling reference
  const scriptPath = resolveScriptPath(skillRoot, meta.scriptRef)
  if (!existsSync(scriptPath)) {
    return {
      ok: false,
      errors: [
        {
          code: 'DANGLING_SCRIPT_REF',
          message: `script file not found: ${scriptPath}`,
          field: 'script_ref',
          actual: meta.scriptRef,
        },
      ],
    }
  }

  // 2. state_schema present + parseable
  let script: ParsedScript
  try {
    const text = readFileSync(scriptPath, 'utf8')
    const rawJson = JSON.parse(text) as Record<string, unknown>
    if (!('state_schema' in rawJson) || rawJson.state_schema === null) {
      return {
        ok: false,
        errors: [
          {
            code: 'STATE_SCHEMA_MISSING',
            message: 'script has no state_schema block',
          },
        ],
      }
    }
    script = parseScript(text)
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          code: 'MALFORMED',
          message: `cannot parse script: ${(err as Error).message}`,
        },
      ],
    }
  }

  // 3. initial_state field set alignment
  const schemaKeys = new Set(Object.keys(script.schema))
  const initKeys = new Set(Object.keys(script.initialState))
  for (const k of schemaKeys) {
    if (!initKeys.has(k)) {
      errors.push({
        code: 'INITIAL_STATE_MISMATCH',
        message: `initial_state missing field "${k}"`,
        field: k,
      })
    }
  }
  for (const k of initKeys) {
    if (!schemaKeys.has(k)) {
      errors.push({
        code: 'INITIAL_STATE_MISMATCH',
        message: `initial_state has extra field "${k}" not in schema`,
        field: k,
      })
    }
  }

  // 4. consequences sample — scan every choice's keys
  for (const [sceneId, scene] of script.scenes) {
    for (const choice of scene.choices) {
      for (const key of Object.keys(choice.consequences)) {
        if (!schemaKeys.has(key)) {
          errors.push({
            code: 'CONSEQUENCES_UNKNOWN_KEY',
            message: `scene "${sceneId}" choice "${choice.id}" references unknown key "${key}"`,
            field: key,
          })
        }
      }
    }
  }

  // 5. shared axes completeness — when sharedAxes option is supplied
  if (options.sharedAxes !== undefined) {
    const chars = extractCharacters(script.schema)
    const required = new Set(['bond', ...options.sharedAxes])
    for (const char of chars) {
      for (const axis of required) {
        const key = `affinity.${char}.${axis}`
        if (!schemaKeys.has(key)) {
          errors.push({
            code: 'SHARED_AXES_INCOMPLETE',
            message: `character "${char}" missing shared axis "${axis}"`,
            field: key,
          })
        }
      }
    }
  }

  // 6. flags set match
  if (options.storyFlags !== undefined) {
    const scriptFlags = new Set<string>()
    for (const key of schemaKeys) {
      if (key.startsWith('flags.')) {
        scriptFlags.add(key.slice('flags.'.length))
      }
    }
    const expected = new Set(options.storyFlags)
    for (const name of expected) {
      if (!scriptFlags.has(name)) {
        errors.push({
          code: 'FLAGS_SET_MISMATCH',
          message: `story flag "${name}" missing from script state_schema`,
          field: `flags.${name}`,
        })
      }
    }
    for (const name of scriptFlags) {
      if (!expected.has(name)) {
        errors.push({
          code: 'FLAGS_SET_MISMATCH',
          message: `script has extra flag "${name}" not in story_spec`,
          field: `flags.${name}`,
        })
      }
    }
  }

  // 7. continue-game state.yaml alignment
  if (options.continueGame) {
    if (!existsSync(paths.stateYamlPath)) {
      errors.push({
        code: 'MALFORMED',
        message: `state.yaml not found at ${paths.stateYamlPath}`,
      })
    } else {
      try {
        const parsedState = readStateFile(paths.stateYamlPath)
        const stateKeys = new Set(Object.keys(parsedState.state))
        for (const k of schemaKeys) {
          if (!stateKeys.has(k)) {
            errors.push({
              code: 'FIELD_MISSING',
              message: `state.yaml missing schema field "${k}"`,
              field: k,
            })
          }
        }
        for (const k of stateKeys) {
          if (!schemaKeys.has(k)) {
            errors.push({
              code: 'FIELD_EXTRA',
              message: `state.yaml has extra field "${k}" not in schema`,
              field: k,
            })
          }
        }
        // type checks
        for (const [key, value] of Object.entries(parsedState.state)) {
          const field = script.schema[key]
          if (field === undefined) continue
          if (!validateFieldType(field, value)) {
            errors.push({
              code: 'FIELD_TYPE_MISMATCH',
              message: `state.yaml field "${key}" has wrong type`,
              field: key,
              expected: field.type,
              actual: typeof value,
            })
          }
        }
      } catch (err) {
        errors.push({
          code: 'MALFORMED',
          message: `cannot parse state.yaml: ${(err as Error).message}`,
        })
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

function extractCharacters(schema: StateSchema): Set<string> {
  const out = new Set<string>()
  for (const key of Object.keys(schema)) {
    if (key.startsWith('affinity.')) {
      const rest = key.slice('affinity.'.length)
      const dot = rest.indexOf('.')
      if (dot > 0) out.add(rest.slice(0, dot))
    }
  }
  return out
}
