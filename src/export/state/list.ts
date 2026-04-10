/**
 * `state list <script-id>`
 *
 * Scans the per-script save directory and returns a JSON summary of all
 * saves (one auto + up to 3 manual snapshots).
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSavePaths, readMetaFile } from './io.js'

export interface SaveSummary {
  currentScene: string
  lastPlayedAt: string | null
}

export interface ManualSaveSummary extends SaveSummary {
  timestamp: string
}

export interface ListResult {
  scriptId: string
  auto: SaveSummary | null
  manual: ManualSaveSummary[]
}

export function runList(skillRoot: string, scriptId: string): ListResult {
  const result: ListResult = {
    scriptId,
    auto: null,
    manual: [],
  }

  // Check auto save
  const autoPaths = resolveSavePaths(skillRoot, scriptId, 'auto')
  if (existsSync(autoPaths.metaYamlPath)) {
    try {
      const meta = readMetaFile(autoPaths.metaYamlPath)
      result.auto = {
        currentScene: meta.currentScene,
        lastPlayedAt: meta.lastPlayedAt ?? null,
      }
    } catch {
      // Corrupted auto save — report as null
    }
  }

  // Scan manual saves
  const manualDir = join(skillRoot, 'runtime', 'saves', scriptId, 'manual')
  if (existsSync(manualDir)) {
    const entries = readdirSync(manualDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort() // lexicographic = chronological for timestamps

    for (const timestamp of entries) {
      const manualPaths = resolveSavePaths(skillRoot, scriptId, { manual: timestamp })
      if (existsSync(manualPaths.metaYamlPath)) {
        try {
          const meta = readMetaFile(manualPaths.metaYamlPath)
          result.manual.push({
            timestamp,
            currentScene: meta.currentScene,
            lastPlayedAt: meta.lastPlayedAt ?? null,
          })
        } catch {
          // Skip corrupted manual saves
        }
      }
    }
  }

  return result
}
