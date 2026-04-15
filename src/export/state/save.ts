/**
 * `state save <script-id> [--overwrite <timestamp>]`
 *
 * Creates a manual save by copying the auto/ save to manual/<timestamp>/.
 * Returns MANUAL_SAVE_LIMIT_REACHED if already at 3 manual saves (unless
 * --overwrite is used to replace one).
 */

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveSavePaths,
  readStateFile,
  readMetaFile,
  writeSaveTransaction,
} from './io.js'
import { copyHistory, historyPath } from './history.js'

export const MANUAL_SAVE_LIMIT = 3

export interface SaveResult {
  ok: true
  scriptId: string
  timestamp: string
  currentScene: string
}

export interface SaveLimitError {
  ok: false
  code: 'MANUAL_SAVE_LIMIT_REACHED'
  scriptId: string
  existing: string[]
}

export interface SaveError {
  ok: false
  code: string
  message: string
}

export interface SaveDeleteResult {
  ok: true
  op: 'delete'
  scriptId: string
  timestamp: string
}

export type SaveOutcome = SaveResult | SaveLimitError | SaveError

export function runSaveDelete(
  skillRoot: string,
  scriptId: string,
  timestamp: string,
): SaveDeleteResult | SaveError {
  const dir = join(skillRoot, 'runtime', 'saves', scriptId, 'manual', timestamp)
  if (!existsSync(dir)) {
    return {
      ok: false,
      code: 'MANUAL_NOT_FOUND',
      message: `manual save "${timestamp}" not found for script "${scriptId}"`,
    }
  }
  rmSync(dir, { recursive: true, force: true })
  return { ok: true, op: 'delete', scriptId, timestamp }
}

export function runSave(
  skillRoot: string,
  scriptId: string,
  overwrite?: string
): SaveOutcome {
  // Read auto save
  const autoPaths = resolveSavePaths(skillRoot, scriptId, 'auto')
  if (!existsSync(autoPaths.metaYamlPath) || !existsSync(autoPaths.stateYamlPath)) {
    return {
      ok: false,
      code: 'NO_AUTO_SAVE',
      message: `no auto save found for script "${scriptId}"`,
    }
  }

  const autoMeta = readMetaFile(autoPaths.metaYamlPath)
  const autoState = readStateFile(autoPaths.stateYamlPath)

  // If overwriting, delete the old manual save first
  if (overwrite !== undefined) {
    const oldDir = join(skillRoot, 'runtime', 'saves', scriptId, 'manual', overwrite)
    if (existsSync(oldDir)) {
      rmSync(oldDir, { recursive: true, force: true })
    }
  }

  // Check manual save count
  const manualDir = join(skillRoot, 'runtime', 'saves', scriptId, 'manual')
  if (existsSync(manualDir)) {
    const existing = readdirSync(manualDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()

    if (existing.length >= MANUAL_SAVE_LIMIT) {
      return {
        ok: false,
        code: 'MANUAL_SAVE_LIMIT_REACHED',
        scriptId,
        existing,
      }
    }
  }

  // Create new manual save
  const timestamp = String(Math.floor(Date.now() / 1000))
  const manualPaths = resolveSavePaths(skillRoot, scriptId, { manual: timestamp })

  writeSaveTransaction(
    manualPaths,
    { currentScene: autoState.currentScene, state: { ...autoState.state } },
    {
      scriptRef: autoMeta.scriptRef,
      currentScene: autoMeta.currentScene,
      lastPlayedAt: new Date().toISOString(),
    }
  )

  // Copy history.log to manual save
  copyHistory(
    historyPath(autoPaths.stateYamlPath),
    historyPath(manualPaths.stateYamlPath)
  )

  return {
    ok: true,
    scriptId,
    timestamp,
    currentScene: autoMeta.currentScene,
  }
}
