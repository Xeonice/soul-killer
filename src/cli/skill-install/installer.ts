import fs from 'node:fs'
import path from 'node:path'

export class ConflictError extends Error {
  constructor(public readonly target: string) {
    super(`skill already installed at ${target}`)
    this.name = 'ConflictError'
  }
}

export interface InstallOptions {
  /** Source directory with the fully-prepared skill contents. */
  sourceDir: string
  /** Final destination (e.g., ~/.claude/skills/fate-zero). */
  destDir: string
  /** Overwrite existing directory at destDir. */
  overwrite: boolean
}

/**
 * Atomically move sourceDir into destDir.
 *
 * Strategy:
 *   1. If destDir exists and !overwrite → throw ConflictError
 *   2. If destDir exists and overwrite → rename to destDir.old-<ts>, then try move
 *   3. On move success → remove the .old backup
 *   4. On move failure → restore from .old and rethrow
 */
export function atomicInstall(opts: InstallOptions): void {
  const { sourceDir, destDir, overwrite } = opts

  if (fs.existsSync(destDir)) {
    if (!overwrite) throw new ConflictError(destDir)
  }

  fs.mkdirSync(path.dirname(destDir), { recursive: true })

  const backup = fs.existsSync(destDir)
    ? `${destDir}.old-${Date.now()}`
    : null

  try {
    if (backup) fs.renameSync(destDir, backup)
    try {
      fs.renameSync(sourceDir, destDir)
    } catch (err) {
      // Cross-device? Fall back to copy + remove.
      copyDirSync(sourceDir, destDir)
      fs.rmSync(sourceDir, { recursive: true, force: true })
    }
    if (backup) fs.rmSync(backup, { recursive: true, force: true })
  } catch (err) {
    // Restore backup if we moved it
    if (backup && fs.existsSync(backup) && !fs.existsSync(destDir)) {
      try { fs.renameSync(backup, destDir) } catch { /* give up */ }
    }
    throw err
  }
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
