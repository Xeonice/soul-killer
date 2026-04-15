import fs from 'node:fs'
import path from 'node:path'

export class NotInstalledError extends Error {
  constructor(public readonly target: string) {
    super(`skill not installed at ${target}`)
    this.name = 'NotInstalledError'
  }
}

export interface UninstallOptions {
  /** Absolute path of the installed skill directory. */
  path: string
  /** If true, rename to <path>.old-<ts> instead of recursive delete. Default true. */
  backup?: boolean
  /** Override the timestamp suffix for deterministic testing. */
  timestampOverride?: number
}

export interface UninstallResult {
  /** Backup path when backup=true; null when deleted directly. */
  backupPath: string | null
}

/**
 * Remove an installed skill directory. Mirrors installer.atomicInstall by
 * using rename→<path>.old-<ts> as the primary strategy so recovery is a
 * single `mv` away. Cross-device rename (EXDEV) falls back to copy+remove.
 */
export function atomicUninstall(opts: UninstallOptions): UninstallResult {
  const { path: destPath } = opts
  const backup = opts.backup !== false
  const ts = opts.timestampOverride ?? Date.now()

  if (!fs.existsSync(destPath)) {
    throw new NotInstalledError(destPath)
  }

  if (!backup) {
    fs.rmSync(destPath, { recursive: true, force: true })
    return { backupPath: null }
  }

  const backupPath = `${destPath}.old-${ts}`
  try {
    fs.renameSync(destPath, backupPath)
  } catch {
    // Cross-device? Copy then remove.
    copyDirSync(destPath, backupPath)
    try {
      fs.rmSync(destPath, { recursive: true, force: true })
    } catch (err) {
      // Clean up half-copied backup before rethrowing
      fs.rmSync(backupPath, { recursive: true, force: true })
      throw err
    }
  }
  return { backupPath }
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirSync(s, d)
    else if (entry.isFile()) fs.copyFileSync(s, d)
  }
}
