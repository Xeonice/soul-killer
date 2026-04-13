/**
 * `state scripts` — list all generated scripts in this skill archive.
 *
 * Scans runtime/scripts/ for script-*.json files and extracts top-level
 * metadata fields (id, title, generated_at) without loading full scene data.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ScriptEntry {
  id: string
  title: string
  generated_at: string
  file: string
  error?: string
}

export interface ScriptsResult {
  scripts: ScriptEntry[]
  count: number
}

export function runScripts(skillRoot: string): ScriptsResult {
  const scriptsDir = join(skillRoot, 'runtime', 'scripts')

  let files: string[]
  try {
    files = readdirSync(scriptsDir)
  } catch {
    // Directory doesn't exist — no scripts
    return { scripts: [], count: 0 }
  }

  const scriptFiles = files.filter(
    (f) => f.startsWith('script-') && f.endsWith('.json')
  )

  const scripts: ScriptEntry[] = []

  for (const file of scriptFiles) {
    const filePath = join(scriptsDir, file)
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8'))
      scripts.push({
        id: raw.id ?? file.replace(/^script-|\.json$/g, ''),
        title: raw.title ?? '',
        generated_at: raw.generated_at ?? '',
        file,
      })
    } catch (err) {
      scripts.push({
        id: file.replace(/^script-|\.json$/g, ''),
        title: '',
        generated_at: '',
        file,
        error: (err as Error).message,
      })
    }
  }

  return { scripts, count: scripts.length }
}
