/**
 * `state rebuild <script-id> [<save-type>]`
 *
 * Repair-menu command: reconstructs state.yaml from the script's initial_state
 * while preserving any existing values that are still valid under the current
 * schema. Used when state.yaml has drifted (missing fields, extra fields,
 * wrong types).
 *
 * Semantics:
 *   - For each schema field:
 *     - If the old state has a correctly-typed value, keep it
 *     - Otherwise, fall back to schema.default
 *   - Discard any old state fields not in schema
 *   - meta.yaml is updated only with a fresh lastPlayedAt; current_scene and
 *     script_ref are preserved (rebuild is a repair, not a reset)
 */

import { validateFieldType, type StateRecord } from './schema.js'
import { loadScriptFile } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  readStateFile,
  readMetaFile,
  writeSaveTransaction,
  type MetaFile,
  type SaveType,
} from './io.js'
import { existsSync } from 'node:fs'

export interface RebuildResult {
  scriptId: string
  keptFields: string[]
  defaultedFields: string[]
  droppedFields: string[]
}

export function runRebuild(skillRoot: string, scriptId: string, saveType: SaveType = 'auto'): RebuildResult {
  const paths = resolveSavePaths(skillRoot, scriptId, saveType)

  const meta = readMetaFile(paths.metaYamlPath)
  const scriptPath = resolveScriptPath(skillRoot, meta.scriptRef)
  const script = loadScriptFile(scriptPath)

  let prevState: StateRecord = {}
  let currentScene = meta.currentScene
  if (existsSync(paths.stateYamlPath)) {
    try {
      const parsed = readStateFile(paths.stateYamlPath)
      prevState = parsed.state
      currentScene = parsed.currentScene
    } catch {
      // Unparseable state.yaml — fall back to pure initial_state
      prevState = {}
    }
  }

  const repaired: StateRecord = {}
  const kept: string[] = []
  const defaulted: string[] = []
  const dropped: string[] = []

  for (const [key, field] of Object.entries(script.schema)) {
    const oldValue = prevState[key]
    if (oldValue !== undefined && validateFieldType(field, oldValue)) {
      repaired[key] = oldValue
      kept.push(key)
    } else {
      repaired[key] = field.default
      defaulted.push(key)
    }
  }

  for (const key of Object.keys(prevState)) {
    if (!(key in script.schema)) {
      dropped.push(key)
    }
  }

  const newMeta: MetaFile = {
    scriptRef: meta.scriptRef,
    currentScene,
    lastPlayedAt: new Date().toISOString(),
  }

  writeSaveTransaction(
    paths,
    { currentScene, state: repaired },
    newMeta
  )

  return {
    scriptId: script.id,
    keptFields: kept,
    defaultedFields: defaulted,
    droppedFields: dropped,
  }
}
