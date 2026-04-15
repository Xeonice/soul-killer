import fs from 'node:fs'
import path from 'node:path'

/**
 * Derive the next-version suggestion from an existing version string.
 *
 * Rules:
 *   - `/^(\d+\.\d+\.)(\d+)$/` — bump the last segment by 1 (semver patch)
 *   - `/^(\d+\.\d+)$/`        — append `.1` (two-part → three-part)
 *   - otherwise               — append `-1` (preserves author formatting intent)
 */
export function bumpPatch(existing: string): string {
  const semver3 = /^(\d+\.\d+\.)(\d+)$/.exec(existing)
  if (semver3) {
    const prefix = semver3[1]!
    const last = Number(semver3[2])
    return `${prefix}${last + 1}`
  }
  const semver2 = /^(\d+\.\d+)$/.exec(existing)
  if (semver2) return `${existing}.1`
  return `${existing}-1`
}

/**
 * Read `version` from an existing soulkiller.json if present.
 * Returns null if the file doesn't exist, can't be parsed, or lacks `version`.
 */
export function readExistingAuthorVersion(soulkillerJsonPath: string): string | null {
  if (!fs.existsSync(soulkillerJsonPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(soulkillerJsonPath, 'utf8')) as Record<string, unknown>
    if (typeof raw.version === 'string' && raw.version.length > 0) return raw.version
  } catch { /* malformed — treated as absent */ }
  return null
}

/**
 * Compute the suggested default version string for the export wizard.
 *
 *   - If `existingSkillDir` contains a `soulkiller.json` with a version → bump patch
 *   - Otherwise → `"0.1.0"` (convention for a first author-released version)
 *
 * `"0.0.0"` is deliberately **not** the first-export default: it's reserved
 * for archives whose `version` field was back-filled by the upgrade script
 * because the author never set one. New exports should start at 0.1.0+.
 */
export function deriveDefaultVersion(existingSkillDir: string | null): string {
  if (!existingSkillDir) return '0.1.0'
  const metaPath = path.join(existingSkillDir, 'soulkiller.json')
  const existing = readExistingAuthorVersion(metaPath)
  if (existing === null) return '0.1.0'
  return bumpPatch(existing)
}
