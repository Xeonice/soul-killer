import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { unzipSync } from 'fflate'
import { ALL_TARGET_IDS, TARGETS, type Scope, type TargetId } from './targets.js'

export interface InstallRecord {
  target: TargetId | 'example'
  scope: Scope
  /** Absolute path of the installed skill directory (or archive for 'example'). */
  path: string
  version: string | null
  engineVersion: number | null
  soulkillerVersion: string | null
  /** True if runtime/bin/state or runtime/bin/doctor.sh exists — legacy pre skill-runtime-binary shape. */
  hasLegacyRuntimeBin: boolean
}

export interface InstalledSkill {
  slug: string
  installs: InstallRecord[]
}

export interface ScanRoot {
  target: TargetId
  scope: Scope
  /** Absolute path of the skills container directory (e.g., ~/.claude/skills). */
  dir: string
}

export interface ScanOptions {
  cwd?: string
  /** Explicit list of roots to scan. If omitted, all (target, scope) combinations are derived. */
  roots?: ScanRoot[]
  /** Include project-scope roots derived from cwd. Default: true. */
  includeProjectScope?: boolean
}

/**
 * Derive the full set of scan roots: every (target, scope) whose container
 * directory actually exists. Project scope is resolved against opts.cwd.
 */
export function deriveScanRoots(opts: ScanOptions = {}): ScanRoot[] {
  if (opts.roots) return opts.roots
  const cwd = opts.cwd ?? process.cwd()
  const includeProject = opts.includeProjectScope !== false
  const roots: ScanRoot[] = []
  for (const target of ALL_TARGET_IDS) {
    const def = TARGETS[target]
    try {
      const globalDir = def.resolveDir('global', cwd)
      if (fs.existsSync(globalDir)) roots.push({ target, scope: 'global', dir: globalDir })
    } catch {
      /* resolve may throw for unsupported combos — ignore */
    }
    if (!includeProject) continue
    if (!def.supportsProject) continue
    try {
      const projectDir = def.resolveDir('project', cwd)
      if (projectDir === def.resolveDir('global', cwd)) continue // cwd == $HOME collision
      if (fs.existsSync(projectDir)) roots.push({ target, scope: 'project', dir: projectDir })
    } catch {
      /* ignore */
    }
  }
  return roots
}

/**
 * Scan every (target, scope) root for installed skills. Each immediate
 * subdirectory with a SKILL.md (or soulkiller.json) is considered a skill.
 * Records are grouped by slug.
 */
export function scanInstalled(opts: ScanOptions = {}): InstalledSkill[] {
  const roots = deriveScanRoots(opts)
  const bySlug = new Map<string, InstalledSkill>()

  for (const root of roots) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(root.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue
      if (entry.name.includes('.old-')) continue
      const skillDir = path.join(root.dir, entry.name)
      const record = readInstallRecord(skillDir, root.target, root.scope)
      if (!record) continue
      const slug = entry.name
      let bucket = bySlug.get(slug)
      if (!bucket) {
        bucket = { slug, installs: [] }
        bySlug.set(slug, bucket)
      }
      bucket.installs.push(record)
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * Read a single installed-skill directory into an InstallRecord. Returns null
 * if the directory is not a soulkiller-produced skill — presence of
 * `soulkiller.json` is the unambiguous marker. Generic Claude Code skills
 * (ai-sdk, create-colleague, …) that live in the same parent dir are ignored.
 */
export function readInstallRecord(
  skillDir: string,
  target: InstallRecord['target'],
  scope: Scope,
): InstallRecord | null {
  const soulkillerJsonPath = path.join(skillDir, 'soulkiller.json')
  if (!fs.existsSync(soulkillerJsonPath)) return null

  let version: string | null = null
  let engineVersion: number | null = null
  let soulkillerVersion: string | null = null
  try {
    const raw = JSON.parse(fs.readFileSync(soulkillerJsonPath, 'utf8')) as Record<string, unknown>
    if (typeof raw.version === 'string') version = raw.version
    if (typeof raw.engine_version === 'number') engineVersion = raw.engine_version
    if (typeof raw.soulkiller_version === 'string') soulkillerVersion = raw.soulkiller_version
  } catch {
    // Malformed soulkiller.json — still counts as a soulkiller skill, just with unknown metadata.
  }

  const legacyState = path.join(skillDir, 'runtime', 'bin', 'state')
  const legacyDoctor = path.join(skillDir, 'runtime', 'bin', 'doctor.sh')
  const hasLegacyRuntimeBin = fs.existsSync(legacyState) || fs.existsSync(legacyDoctor)

  return {
    target,
    scope,
    path: skillDir,
    version,
    engineVersion,
    soulkillerVersion,
    hasLegacyRuntimeBin,
  }
}

/**
 * Scan a `.skill` archive (not yet installed) by extracting to a temp dir and
 * reading the same metadata used for installed skills. The returned record has
 * `target: 'example'` and `path` set to the archive file path.
 *
 * Callers can merge the result into a regular `InstalledSkill[]` by slug when
 * presenting a combined view.
 */
export function scanFromArchive(archivePath: string): InstalledSkill | null {
  const bytes = fs.readFileSync(archivePath)
  const entries = unzipSync(new Uint8Array(bytes))
  let wrapperName: string | null = null
  const fileMap: Record<string, Uint8Array> = {}
  for (const [entryPath, data] of Object.entries(entries)) {
    const topSeg = entryPath.split('/')[0] ?? ''
    if (wrapperName === null) wrapperName = topSeg
    fileMap[entryPath] = data
  }
  if (!wrapperName) return null

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-scan-archive-'))
  try {
    for (const [entryPath, data] of Object.entries(fileMap)) {
      if (entryPath.endsWith('/')) continue
      const outPath = path.join(tmp, entryPath)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, data)
    }
    const wrapperDir = path.join(tmp, wrapperName)
    const rec = readInstallRecord(wrapperDir, 'example', 'global')
    if (!rec) return null
    // Rewrite path to point at the archive file itself so callers have a stable reference
    rec.path = archivePath
    return {
      slug: (() => {
        const metaPath = path.join(wrapperDir, 'soulkiller.json')
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { skill_id?: unknown }
            if (typeof meta.skill_id === 'string' && meta.skill_id.length > 0) return meta.skill_id
          } catch { /* ignore */ }
        }
        // Fall back to archive basename (fate-zero.skill → fate-zero)
        return path.basename(archivePath).replace(/\.skill$/, '') || wrapperName!
      })(),
      installs: [rec],
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * Scan a directory containing `.skill` archives (default: repo `examples/skills/`).
 * Returns one InstalledSkill per archive with target='example'. Merge with
 * scanInstalled() output by slug when rendering combined views.
 */
export function scanExamples(dir: string): InstalledSkill[] {
  if (!fs.existsSync(dir)) return []
  const out: InstalledSkill[] = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.skill')) continue
    try {
      const item = scanFromArchive(path.join(dir, name))
      if (item) out.push(item)
    } catch {
      /* skip malformed archives */
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug))
}
