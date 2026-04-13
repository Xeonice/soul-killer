/**
 * `state init <script-id>`
 *
 * Reads the script, materializes initial_state into state.yaml, sets
 * meta.yaml.script_ref + current_scene = first scene. Always writes to
 * the script's auto/ save directory.
 */

import { buildInitialState } from './schema.js'
import { loadScriptFile } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  writeSaveTransaction,
  type MetaFile,
} from './io.js'
import { initHistory, historyPath } from './history.js'

export interface InitResult {
  scriptId: string
  firstScene: string
  fieldCount: number
}

export function runInit(skillRoot: string, scriptId: string): InitResult {
  const scriptPath = resolveScriptPath(skillRoot, scriptId)
  const script = loadScriptFile(scriptPath)
  const paths = resolveSavePaths(skillRoot, script.id)

  const initialState = script.initialState
  // Defensive check: initial_state must equal schema.keys (strict).
  const schemaKeys = new Set(Object.keys(script.schema))
  const initKeys = new Set(Object.keys(initialState))
  for (const k of schemaKeys) {
    if (!initKeys.has(k)) {
      throw new Error(
        `script.initial_state missing field "${k}" (must equal state_schema key set)`
      )
    }
  }
  for (const k of initKeys) {
    if (!schemaKeys.has(k)) {
      throw new Error(
        `script.initial_state has extra field "${k}" not in state_schema`
      )
    }
  }

  const meta: MetaFile = {
    scriptRef: script.id,
    currentScene: script.firstSceneId,
    lastPlayedAt: new Date().toISOString(),
  }

  writeSaveTransaction(
    paths,
    {
      currentScene: script.firstSceneId,
      state: { ...initialState },
    },
    meta
  )

  // Create empty history.log for this save
  initHistory(historyPath(paths.stateYamlPath))

  return {
    scriptId: script.id,
    firstScene: script.firstSceneId,
    fieldCount: Object.keys(initialState).length,
  }
}

// Kept exported for tests that want to use initial_state without hitting disk.
export { buildInitialState }
