/**
 * `state reset <script-id> [<save-type>]`
 *
 * "从头再来" — wholesale reset of the save to the script's initial_state.
 * current_scene is reset to the first scene in declaration order. script_ref
 * stays the same (reset stays on the current script; use init for a new one).
 */

import { loadScriptFile } from './script.js'
import {
  resolveSavePaths,
  resolveScriptPath,
  readMetaFile,
  writeSaveTransaction,
  type MetaFile,
  type SaveType,
} from './io.js'
import { clearHistory, historyPath } from './history.js'

export interface ResetResult {
  scriptId: string
  firstScene: string
  fieldCount: number
}

export function runReset(skillRoot: string, scriptId: string, saveType: SaveType = 'auto'): ResetResult {
  const paths = resolveSavePaths(skillRoot, scriptId, saveType)
  const meta = readMetaFile(paths.metaYamlPath)
  const scriptPath = resolveScriptPath(skillRoot, meta.scriptRef)
  const script = loadScriptFile(scriptPath)

  const newMeta: MetaFile = {
    scriptRef: script.id,
    currentScene: script.firstSceneId,
    lastPlayedAt: new Date().toISOString(),
  }

  writeSaveTransaction(
    paths,
    {
      currentScene: script.firstSceneId,
      state: { ...script.initialState },
    },
    newMeta
  )

  // Clear choice history
  clearHistory(historyPath(paths.stateYamlPath))

  return {
    scriptId: script.id,
    firstScene: script.firstSceneId,
    fieldCount: Object.keys(script.initialState).length,
  }
}
