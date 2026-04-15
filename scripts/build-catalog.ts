#!/usr/bin/env bun
/**
 * Build catalog.json from examples/skills/*.skill archives.
 *
 * Usage:
 *   bun scripts/build-catalog.ts
 *   bun scripts/build-catalog.ts --examples-dir <path> --out <catalog.json>
 *
 * For each `.skill` archive found:
 *   - Unzip in-memory and read soulkiller.json + SKILL.md frontmatter
 *   - Compute sha256 of the archive bytes
 *   - Emit a CatalogV1 entry
 *
 * Output is stable: skills sorted by slug, fields in declaration order.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { unzipSync } from 'fflate'

const ARG_EXAMPLES = argValue('--examples-dir') ?? 'examples/skills'
const ARG_OUT = argValue('--out') ?? 'dist/catalog.json'
const ARG_URL_PREFIX = argValue('--url-prefix') ?? '/examples/skills/'
const ARG_SOULKILLER_MIN = argValue('--soulkiller-min') ?? readPackageVersion() ?? '0.0.0'

function argValue(key: string): string | undefined {
  const idx = process.argv.indexOf(key)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

function readPackageVersion(): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch { return null }
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function parseFrontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2]!.trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[kv[1]!] = v
  }
  return out
}

interface CatalogEntry {
  slug: string
  display_name: string
  description: string
  version: string
  engine_version: number
  size_bytes: number
  sha256: string
  url: string
  soulkiller_version_min: string
  characters?: string[]
  tags?: string[]
}

function buildEntry(skillPath: string): CatalogEntry {
  const bytes = new Uint8Array(fs.readFileSync(skillPath))
  const entries = unzipSync(bytes)
  const slug = path.basename(skillPath).replace(/\.skill$/, '')

  // Find SKILL.md and soulkiller.json (with or without wrapper dir)
  function pick(name: string): Uint8Array | null {
    for (const key of Object.keys(entries)) {
      if (key === name || key.endsWith('/' + name)) return entries[key]!
    }
    return null
  }

  const skillMdBytes = pick('SKILL.md')
  if (!skillMdBytes) throw new Error(`${skillPath}: SKILL.md not found`)
  const skillMd = new TextDecoder().decode(skillMdBytes)
  const fm = parseFrontmatter(skillMd)

  let engineVersion = 0
  let authorVersion: string | null = null
  const jsonBytes = pick('soulkiller.json')
  if (jsonBytes) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(jsonBytes))
      if (typeof parsed.engine_version === 'number') engineVersion = parsed.engine_version
      // Catalog `version` represents the **author-declared skill version**
      // (skill-author-version change). Previously this read from
      // `soulkiller_version`, which is build metadata — that was a bug.
      if (typeof parsed.version === 'string' && parsed.version.length > 0) {
        authorVersion = parsed.version
      }
    } catch { /* ignore */ }
  }
  if (authorVersion === null) {
    console.error(
      `  ⚠ ${path.basename(skillPath)}: soulkiller.json lacks 'version' field; defaulting to 0.0.0`,
    )
    authorVersion = '0.0.0'
  }

  // Characters: scan souls/*/ directory entries
  const characterSet = new Set<string>()
  for (const key of Object.keys(entries)) {
    const m = key.match(/^(?:[^/]+\/)?souls\/([^/]+)\//)
    if (m) characterSet.add(m[1]!)
  }

  return {
    slug,
    display_name: fm.name || slug,
    description: fm.description || '',
    version: authorVersion,
    engine_version: engineVersion,
    size_bytes: bytes.byteLength,
    sha256: sha256Hex(bytes),
    url: ARG_URL_PREFIX + path.basename(skillPath),
    soulkiller_version_min: ARG_SOULKILLER_MIN,
    ...(characterSet.size > 0 ? { characters: [...characterSet].sort() } : {}),
  }
}

function main(): void {
  const dir = path.resolve(ARG_EXAMPLES)
  if (!fs.existsSync(dir)) {
    console.error(`examples dir not found: ${dir}`)
    process.exit(1)
  }

  const skills: CatalogEntry[] = []
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.skill')) continue
    const p = path.join(dir, file)
    try {
      skills.push(buildEntry(p))
      console.log(`  ✓ ${file}`)
    } catch (err) {
      console.error(`  ✗ ${file}: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    }
  }

  skills.sort((a, b) => a.slug.localeCompare(b.slug))

  const catalog = {
    version: 1 as const,
    updated_at: new Date().toISOString(),
    soulkiller_version_min: ARG_SOULKILLER_MIN,
    skills,
  }

  const outPath = path.resolve(ARG_OUT)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
  console.log(`\n  catalog written to ${outPath} (${skills.length} skills)`)
}

// Only auto-run when invoked as the CLI entry point (so unit tests can
// import buildEntry without side effects).
if (import.meta.main) main()

// Named exports for testability.
export { buildEntry }
