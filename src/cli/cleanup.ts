import { existsSync, realpathSync, unlinkSync, readdirSync, statSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_TARGET_IDS, TARGETS } from './skill-install/targets.js'

/**
 * Remove any stale `<exe>.old` left behind by a previous Windows self-update.
 * On Windows the update path renames the running exe to `<exe>.old` before
 * writing the new binary — cleanup is deferred to the next cold start because
 * the just-updated process may still hold a lock at update completion time.
 * Runs silently; any failure (permission, still-locked, non-existent) is
 * swallowed and retried on the next start.
 */
export function cleanupStaleOld(): void {
  try {
    const target = (() => {
      try { return realpathSync(process.execPath) } catch { return process.execPath }
    })()
    const staleOld = target + '.old'
    if (existsSync(staleOld)) unlinkSync(staleOld)
  } catch { /* silent */ }
}

/**
 * Remove `<slug>.old-<ts>` backups older than `maxAgeMs` from every known
 * skill-target directory. Created by `skill install --overwrite`,
 * `skill update`, and `skill uninstall`. Fails silently — a stale backup is
 * strictly better than an aborted startup.
 */
export function cleanupStaleSkillBackups(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs
  const dirs: string[] = []
  for (const id of ALL_TARGET_IDS) {
    const def = TARGETS[id]
    try {
      dirs.push(def.resolveDir('global'))
    } catch { /* ignore unsupported */ }
  }
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    let entries: string[]
    try { entries = readdirSync(dir) } catch { continue }
    for (const name of entries) {
      const match = /\.old-(\d+)$/.exec(name)
      if (!match) continue
      const ts = Number(match[1])
      if (!Number.isFinite(ts) || ts > cutoff) continue
      const abs = join(dir, name)
      try {
        const st = statSync(abs)
        if (!st.isDirectory()) continue
        rmSync(abs, { recursive: true, force: true })
      } catch { /* ignore */ }
    }
  }
}
