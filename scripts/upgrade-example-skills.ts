#!/usr/bin/env bun
/**
 * Maintainer of `examples/skills/*.skill`. Two modes:
 *
 *   Default (no flag): upgrade each archive in place
 *     - Unzip, rewrite runtime/engine.md + soulkiller.json via upgradeEngine()
 *     - Strip DEPRECATED_PATHS (e.g., pre-skill-runtime-binary bash wrappers)
 *     - Repack
 *
 *   --check: dry-run
 *     - Compute what would change without writing
 *     - Exit 1 if any archive is outdated; 0 if all fresh
 *     - Intended for CI gating
 *
 * Deprecated paths are listed below. To retire a path from all exported skills,
 * add it here and run the script.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { zipSync, unzipSync } from 'fflate'
import { upgradeEngine } from '../src/cli/skill-manager.js'
import { CURRENT_ENGINE_VERSION } from '../src/cli/skill-install/extractor.js'

const SKILLS_DIR = resolve(import.meta.dir, '..', 'examples', 'skills')

/**
 * Relative paths (within the archive wrapper dir) that should be removed.
 * Matched as exact paths or as prefixes when the entry ends with '/'.
 *
 * Append to this list whenever a path is retired. Do NOT remove entries;
 * older archives in the wild still carry them.
 */
const DEPRECATED_PATHS: string[] = [
  'runtime/bin/state',
  'runtime/bin/doctor.sh',
  'runtime/bin/', // strip the parent dir + any other contents
]

function isDeprecated(relPath: string): boolean {
  for (const p of DEPRECATED_PATHS) {
    if (p.endsWith('/') ? relPath === p.slice(0, -1) || relPath.startsWith(p) : relPath === p) {
      return true
    }
  }
  return false
}

async function repackDir(dir: string, outFile: string): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  const walk = (absDir: string, relDir: string): void => {
    for (const entry of readdirSync(absDir)) {
      const absPath = join(absDir, entry)
      const relPath = relDir === '' ? entry : `${relDir}/${entry}`
      const st = statSync(absPath)
      if (st.isDirectory()) walk(absPath, relPath)
      else files[relPath] = new Uint8Array(readFileSync(absPath))
    }
  }
  walk(dir, '')
  const buf = zipSync(files, { level: 6 })
  writeFileSync(outFile, buf)
}

function unzipToDir(archive: string, destDir: string): string {
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })

  const data = readFileSync(archive)
  const entries = unzipSync(new Uint8Array(data))
  let wrapperName: string | null = null

  for (const [entryPath, entryData] of Object.entries(entries)) {
    // Detect top-level wrapper name (first segment)
    const topSeg = entryPath.split('/')[0] ?? ''
    if (wrapperName === null) wrapperName = topSeg
    else if (topSeg !== wrapperName) {
      throw new Error(
        `archive has multiple top-level dirs: ${wrapperName} vs ${topSeg}`
      )
    }

    const outPath = join(destDir, entryPath)
    const parent = outPath.slice(0, outPath.lastIndexOf('/'))
    if (parent && !existsSync(parent)) mkdirSync(parent, { recursive: true })
    // Directories in zip often end with '/' with empty data
    if (!entryPath.endsWith('/')) writeFileSync(outPath, entryData)
  }

  if (wrapperName === null) throw new Error('empty archive')
  return wrapperName
}

interface StaleReport {
  archive: string
  engineOutdated: { from: number | null; to: number } | null
  deprecatedPaths: string[]
  missingAuthorVersion: boolean
}

/** Recursively list every file path in `dir`, relative to `dir`. */
function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const relPath = rel === '' ? entry : `${rel}/${entry}`
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...listFiles(abs, relPath))
    else out.push(relPath)
  }
  return out
}

function scanDeprecated(wrapperDir: string): string[] {
  const found: string[] = []
  for (const rel of listFiles(wrapperDir)) {
    if (isDeprecated(rel)) found.push(rel)
  }
  return found
}

function stripDeprecated(wrapperDir: string): string[] {
  const found = scanDeprecated(wrapperDir)
  for (const rel of found) {
    const abs = join(wrapperDir, rel)
    try { rmSync(abs, { force: true }) } catch { /* ignore */ }
  }
  // Clean up empty runtime/bin/ parent if it became empty
  const binDir = join(wrapperDir, 'runtime', 'bin')
  if (existsSync(binDir)) {
    try {
      if (readdirSync(binDir).length === 0) rmSync(binDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
  return found
}

async function inspectOne(archivePath: string): Promise<StaleReport> {
  const tmpBase = join(tmpdir(), `soulkiller-inspect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  try {
    const wrapperName = unzipToDir(archivePath, tmpBase)
    const wrapperDir = join(tmpBase, wrapperName)
    const metaPath = join(wrapperDir, 'soulkiller.json')
    let currentEngine: number | null = null
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        if (typeof meta.engine_version === 'number') currentEngine = meta.engine_version
      } catch { /* ignore */ }
    }
    const engineOutdated = currentEngine === CURRENT_ENGINE_VERSION
      ? null
      : { from: currentEngine, to: CURRENT_ENGINE_VERSION }
    const deprecatedPaths = scanDeprecated(wrapperDir)
    // Author version (skill-author-version change) — treat missing as stale.
    let missingAuthorVersion = true
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        if (typeof meta.version === 'string' && meta.version.length > 0) {
          missingAuthorVersion = false
        }
      } catch { /* treat as missing */ }
    }
    return { archive: archivePath, engineOutdated, deprecatedPaths, missingAuthorVersion }
  } finally {
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

async function upgradeOne(archivePath: string): Promise<void> {
  const name = archivePath.split('/').pop() ?? ''
  console.log(`\n⟳ ${name}`)

  const tmpBase = join(tmpdir(), `soulkiller-upgrade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  try {
    const wrapperName = unzipToDir(archivePath, tmpBase)
    const wrapperDir = join(tmpBase, wrapperName)
    console.log(`  wrapper: ${wrapperName}`)

    // Read existing soulkiller.json for engine_version reporting
    const metaPath = join(wrapperDir, 'soulkiller.json')
    let oldVersion: number | null = null
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        oldVersion = meta.engine_version ?? null
      } catch { /* ignore */ }
    }

    // Actual upgrade: rewrites runtime/engine.md + soulkiller.json
    upgradeEngine(wrapperDir)

    const newMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
    console.log(`  engine_version: ${oldVersion ?? '(legacy)'} → ${newMeta.engine_version}`)

    const removed = stripDeprecated(wrapperDir)
    if (removed.length > 0) {
      console.log(`  stripped: ${removed.join(', ')}`)
    }

    // Back-fill author version (skill-author-version change) for archives
    // exported before the `version` field existed. Deliberately writes "0.0.0"
    // rather than 0.1.0 — it's an unambiguous marker for "no authorial intent
    // recorded" that the REPL / catalog can surface.
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    if (typeof meta.version !== 'string' || meta.version.length === 0) {
      meta.version = '0.0.0'
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
      console.log(`  filled missing version: 0.0.0`)
    }

    // Repack
    await repackDir(tmpBase, archivePath)
    console.log(`  ✓ repacked → ${archivePath}`)
  } finally {
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

async function runCheck(): Promise<number> {
  if (!existsSync(SKILLS_DIR)) {
    console.error(`examples/skills/ not found at ${SKILLS_DIR}`)
    return 1
  }
  const skills = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill'))
  if (skills.length === 0) {
    console.log('No .skill files in examples/skills/')
    return 0
  }

  const stale: StaleReport[] = []
  for (const name of skills) {
    const report = await inspectOne(join(SKILLS_DIR, name))
    if (report.engineOutdated !== null || report.deprecatedPaths.length > 0 || report.missingAuthorVersion) {
      stale.push(report)
    }
  }

  if (stale.length === 0) {
    console.log(`✓ All ${skills.length} example skill archives up to date.`)
    return 0
  }

  console.error(`✗ ${stale.length}/${skills.length} example skill archive(s) outdated:`)
  for (const r of stale) {
    const basename = r.archive.split('/').pop() ?? r.archive
    console.error(`  • ${basename}`)
    if (r.engineOutdated) {
      const { from, to } = r.engineOutdated
      console.error(`      engine_version: ${from ?? '(legacy)'} → ${to}`)
    }
    if (r.deprecatedPaths.length > 0) {
      console.error(`      deprecated paths: ${r.deprecatedPaths.join(', ')}`)
    }
    if (r.missingAuthorVersion) {
      console.error(`      missing author version field (will back-fill 0.0.0)`)
    }
  }
  console.error('')
  console.error('  Run: bun scripts/upgrade-example-skills.ts')
  return 1
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const isCheck = args.includes('--check')

  if (isCheck) {
    const code = await runCheck()
    process.exit(code)
  }

  if (!existsSync(SKILLS_DIR)) {
    console.error(`examples/skills/ not found at ${SKILLS_DIR}`)
    process.exit(1)
  }

  const skills = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill'))
  if (skills.length === 0) {
    console.log('No .skill files in examples/skills/')
    return
  }

  console.log(`Found ${skills.length} skill archive(s) to upgrade`)
  for (const name of skills) {
    await upgradeOne(join(SKILLS_DIR, name))
  }
  console.log('\nAll done.')
}

await main()
