/**
 * history.log — append-only record of player choices.
 *
 * Format: one line per choice, `<scene-id>:<choice-id>\n`.
 * Lives alongside state.yaml and meta.yaml in the save directory.
 */

import { readFileSync, appendFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

export interface HistoryEntry {
  sceneId: string
  choiceId: string
}

/**
 * Resolve the history.log path from a save directory (same dir as state.yaml).
 */
export function historyPath(stateYamlPath: string): string {
  return join(dirname(stateYamlPath), 'history.log')
}

/**
 * Read all history entries. Returns empty array if file doesn't exist.
 */
export function readHistory(path: string): HistoryEntry[] {
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  return text
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const sep = line.indexOf(':')
      return {
        sceneId: line.slice(0, sep),
        choiceId: line.slice(sep + 1),
      }
    })
}

/**
 * Append a single choice to history.log. Creates the file if missing.
 * Failures are silently ignored — history is auxiliary data.
 */
export function appendHistory(path: string, sceneId: string, choiceId: string): void {
  try {
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(path, `${sceneId}:${choiceId}\n`, 'utf8')
  } catch {
    // Silently ignore — history is not critical
  }
}

/**
 * Clear history (write empty file). Used by reset.
 */
export function clearHistory(path: string): void {
  try {
    writeFileSync(path, '', 'utf8')
  } catch {
    // ignore
  }
}

/**
 * Copy history.log from source to destination. Used by save.
 */
export function copyHistory(srcPath: string, destPath: string): void {
  try {
    if (!existsSync(srcPath)) {
      // Source doesn't exist — create empty at dest
      const dir = dirname(destPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(destPath, '', 'utf8')
      return
    }
    const dir = dirname(destPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    copyFileSync(srcPath, destPath)
  } catch {
    // ignore
  }
}

/**
 * Create an empty history.log. Used by init.
 */
export function initHistory(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, '', 'utf8')
}
