/**
 * `state load <script-id> <save-type>`
 *
 * Copies a manual save's state / meta / history over the auto save so that
 * subsequent `apply` calls (which always read/write `auto/`) continue the
 * timeline the user loaded. Closes the Phase -1 Load-a-Save data-consistency
 * hole: before this command, loading a manual save left auto/ untouched,
 * causing apply to operate on a stale timeline.
 *
 * Contract:
 *   - save-type is `manual:<timestamp>` (auto is rejected — nonsensical)
 *   - manual/<ts>/state.yaml + meta.yaml + history.log → auto/
 *   - meta.yaml.lastPlayedAt is refreshed to now
 *   - overwriting a non-matching auto emits a stderr warning but proceeds
 */

import { existsSync, readFileSync } from 'node:fs'
import {
  resolveSavePaths,
  readStateFile,
  readMetaFile,
  writeSaveTransaction,
  type SaveType,
} from './io.js'
import { copyHistory, historyPath } from './history.js'

export interface LoadResult {
  scriptId: string
  source: string           // e.g. "manual:1728123456"
  target: string           // always "auto"
  fieldCount: number       // number of state fields in the loaded save
  autoOverwritten: boolean // true if auto existed and differed from source
}

export class LoadError extends Error {
  constructor(
    public readonly code: 'MANUAL_NOT_FOUND' | 'MANUAL_MALFORMED' | 'INVALID_SAVE_TYPE',
    message: string,
  ) {
    super(message)
    this.name = 'LoadError'
  }
}

export function runLoad(skillRoot: string, scriptId: string, saveType: SaveType): LoadResult {
  if (saveType === 'auto') {
    throw new LoadError(
      'INVALID_SAVE_TYPE',
      'load only applies to manual saves; use "init" to start fresh or "reset" to reload initial_state',
    )
  }

  const sourcePaths = resolveSavePaths(skillRoot, scriptId, saveType)
  if (!existsSync(sourcePaths.stateYamlPath) || !existsSync(sourcePaths.metaYamlPath)) {
    throw new LoadError(
      'MANUAL_NOT_FOUND',
      `manual save "${saveType.manual}" not found for script "${scriptId}"`,
    )
  }

  let sourceState: ReturnType<typeof readStateFile>
  let sourceMeta: ReturnType<typeof readMetaFile>
  try {
    sourceState = readStateFile(sourcePaths.stateYamlPath)
    sourceMeta = readMetaFile(sourcePaths.metaYamlPath)
  } catch (err) {
    throw new LoadError(
      'MANUAL_MALFORMED',
      `manual save "${saveType.manual}" is malformed: ${(err as Error).message}`,
    )
  }

  const autoPaths = resolveSavePaths(skillRoot, scriptId, 'auto')

  // Detect overwrite-of-different-auto for warning emission.
  let autoOverwritten = false
  if (existsSync(autoPaths.stateYamlPath) && existsSync(autoPaths.metaYamlPath)) {
    try {
      const autoRaw = readFileSync(autoPaths.stateYamlPath, 'utf8')
      const sourceRaw = readFileSync(sourcePaths.stateYamlPath, 'utf8')
      autoOverwritten = autoRaw !== sourceRaw
    } catch {
      autoOverwritten = true
    }
  }

  writeSaveTransaction(
    autoPaths,
    { currentScene: sourceState.currentScene, state: { ...sourceState.state } },
    {
      scriptRef: sourceMeta.scriptRef,
      currentScene: sourceMeta.currentScene,
      lastPlayedAt: new Date().toISOString(),
      currentRoute: sourceMeta.currentRoute,
    },
  )

  // Copy history.log (transcripts of prior choice path) so the tree viewer
  // and continuation logic see the correct lineage.
  copyHistory(
    historyPath(sourcePaths.stateYamlPath),
    historyPath(autoPaths.stateYamlPath),
  )

  return {
    scriptId,
    source: `manual:${saveType.manual}`,
    target: 'auto',
    fieldCount: Object.keys(sourceState.state).length,
    autoOverwritten,
  }
}
