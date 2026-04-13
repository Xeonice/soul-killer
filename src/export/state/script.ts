/**
 * Script file loader.
 *
 * script-<id>.json is authored by the Phase 1 LLM. Structure (selected parts):
 *
 * {
 *   "id": "script-001",
 *   "state_schema": { "<key>": { type, desc, default, range?, values? }, ... },
 *   "initial_state": { "<key>": <value>, ... },
 *   "scenes": {
 *     "<scene-id>": {
 *       "text": "...",
 *       "choices": [
 *         { "id": "<choice-id>", "text": "...", "consequences": { ... }, "next": "<scene-id>" }
 *       ]
 *     }
 *   },
 *   "endings": [...]
 * }
 *
 * This module is the single reader of script files. All state command modules
 * go through it so parsing/validation lives in one place.
 */

import { readFileSync } from 'node:fs'
import { loadStateSchema, type StateSchema, type StateRecord } from './schema.js'
import type { MiniPrimitive } from './mini-yaml.js'

export interface ScriptChoice {
  id: string
  text: string
  consequences: Record<string, MiniPrimitive>
  next?: string
}

export interface ScriptRouting {
  route_id: string
  condition: unknown
  next: string
}

export interface ScriptScene {
  id: string
  text: string
  choices: ScriptChoice[]
  type?: string
  routing?: ScriptRouting[]
  route?: string
}

export interface ParsedScript {
  id: string
  schema: StateSchema
  initialState: StateRecord
  scenes: Map<string, ScriptScene>
  firstSceneId: string
  raw: Record<string, unknown>
}

export class ScriptLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScriptLoadError'
  }
}

export function parseScript(text: string): ParsedScript {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (err) {
    throw new ScriptLoadError(
      `script is not valid JSON: ${(err as Error).message}`
    )
  }
  if (!isPlainObject(json)) {
    throw new ScriptLoadError('script root must be a JSON object')
  }

  const rawId = json.id
  if (typeof rawId !== 'string' || rawId === '') {
    throw new ScriptLoadError('script.id must be a non-empty string')
  }

  if (!('state_schema' in json)) {
    throw new ScriptLoadError('script.state_schema is required')
  }
  const schema = loadStateSchema(json.state_schema)

  const initialRaw = json.initial_state
  if (!isPlainObject(initialRaw)) {
    throw new ScriptLoadError('script.initial_state must be an object')
  }
  const initialState: StateRecord = {}
  for (const [k, v] of Object.entries(initialRaw)) {
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      initialState[k] = v
    } else {
      throw new ScriptLoadError(
        `initial_state["${k}"] must be int/bool/string, got ${typeof v}`
      )
    }
  }

  const scenesRaw = json.scenes
  if (!isPlainObject(scenesRaw)) {
    throw new ScriptLoadError('script.scenes must be an object')
  }
  const scenes = new Map<string, ScriptScene>()
  const sceneIds = Object.keys(scenesRaw)
  if (sceneIds.length === 0) {
    throw new ScriptLoadError('script.scenes must not be empty')
  }
  for (const [sceneId, sceneRaw] of Object.entries(scenesRaw)) {
    scenes.set(sceneId, parseScene(sceneId, sceneRaw))
  }

  return {
    id: rawId,
    schema,
    initialState,
    scenes,
    firstSceneId: sceneIds[0]!,
    raw: json,
  }
}

function parseScene(sceneId: string, raw: unknown): ScriptScene {
  if (!isPlainObject(raw)) {
    throw new ScriptLoadError(`scene "${sceneId}" must be an object`)
  }
  const text = typeof raw.text === 'string' ? raw.text : ''
  const sceneType = typeof raw.type === 'string' ? raw.type : undefined
  const route = typeof raw.route === 'string' ? raw.route : undefined

  // Gate scenes: choices defaults to [], parse routing
  if (sceneType === 'affinity_gate') {
    const choicesRaw = raw.choices
    const choices: ScriptChoice[] = Array.isArray(choicesRaw)
      ? choicesRaw.map((c, idx) => parseChoice(sceneId, idx, c))
      : []
    const routing = Array.isArray(raw.routing)
      ? (raw.routing as ScriptRouting[])
      : undefined
    return { id: sceneId, text, choices, type: sceneType, routing, route }
  }

  // Normal scenes: choices required
  const choicesRaw = raw.choices
  if (!Array.isArray(choicesRaw)) {
    throw new ScriptLoadError(`scene "${sceneId}".choices must be an array`)
  }
  const choices: ScriptChoice[] = choicesRaw.map((c, idx) => parseChoice(sceneId, idx, c))
  return { id: sceneId, text, choices, ...(sceneType ? { type: sceneType } : {}), ...(route ? { route } : {}) }
}

function parseChoice(sceneId: string, idx: number, raw: unknown): ScriptChoice {
  if (!isPlainObject(raw)) {
    throw new ScriptLoadError(
      `scene "${sceneId}".choices[${idx}] must be an object`
    )
  }
  const id = typeof raw.id === 'string' ? raw.id : `choice-${idx}`
  const text = typeof raw.text === 'string' ? raw.text : ''
  const consequencesRaw = raw.consequences ?? {}
  if (!isPlainObject(consequencesRaw)) {
    throw new ScriptLoadError(
      `scene "${sceneId}".choices[${idx}].consequences must be an object`
    )
  }
  const consequences: Record<string, MiniPrimitive> = {}
  for (const [k, v] of Object.entries(consequencesRaw)) {
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      consequences[k] = v
    } else {
      throw new ScriptLoadError(
        `scene "${sceneId}".choices[${idx}].consequences["${k}"] must be int/bool/string`
      )
    }
  }
  const next = typeof raw.next === 'string' ? raw.next : undefined
  return { id, text, consequences, next }
}

export function loadScriptFile(path: string): ParsedScript {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    throw new ScriptLoadError(`cannot read script file: ${path}`)
  }
  return parseScript(text)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
