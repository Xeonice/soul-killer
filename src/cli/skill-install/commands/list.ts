import path from 'node:path'
import { fetchCatalog, CatalogError } from '../../catalog/client.js'
import { scanInstalled, scanExamples, type InstalledSkill } from '../scanner.js'
import { diffAgainstCatalog, type SkillDiff, type UpdateStatus } from '../diff.js'
import type { CatalogV1, SkillEntry } from '../../catalog/types.js'

interface ListArgs {
  showCatalog: boolean
  onlyUpdates: boolean
  json: boolean
  scanDirs: string[]
  examples: boolean
  examplesDir?: string
  catalogUrl?: string
}

function parseArgs(args: string[]): ListArgs {
  const out: ListArgs = { showCatalog: false, onlyUpdates: false, json: false, scanDirs: [], examples: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--all' || a === '--include-catalog') out.showCatalog = true
    else if (a === '--updates') out.onlyUpdates = true
    else if (a === '--json') out.json = true
    else if (a === '--scan-dir') {
      const v = args[++i]
      if (!v) throw new Error('--scan-dir requires a path')
      out.scanDirs.push(v)
    } else if (a === '--examples') out.examples = true
    else if (a === '--examples-dir') out.examplesDir = args[++i]
    else if (a === '--catalog') out.catalogUrl = args[++i]
    else throw new Error(`unknown flag for 'skill list': ${a}`)
  }
  return out
}

function statusLabel(s: UpdateStatus): string {
  switch (s.kind) {
    case 'up-to-date':      return 'up-to-date'
    case 'updatable':       return `update → ${s.to}`
    case 'unknown-version': return 'unknown'
    case 'not-in-catalog':  return 'not-in-catalog'
  }
}

function targetsLabel(skill: InstalledSkill): string {
  return skill.installs
    .map((rec) => `${rec.target}:${rec.scope}`)
    .join(',')
}

export async function runList(args: string[]): Promise<number> {
  let parsed: ListArgs
  try {
    parsed = parseArgs(args)
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  // Scan every extra --scan-dir as an additional project-scope cwd, plus the
  // default cwd. We merge the resulting InstalledSkill lists by slug.
  const cwdList = parsed.scanDirs.length > 0 ? parsed.scanDirs : [process.cwd()]
  const merged = new Map<string, InstalledSkill>()
  for (const cwd of cwdList) {
    for (const s of scanInstalled({ cwd })) {
      const existing = merged.get(s.slug)
      if (!existing) merged.set(s.slug, s)
      else existing.installs.push(...s.installs)
    }
  }

  // Optionally include archive-based entries from examples/skills/
  if (parsed.examples) {
    const examplesDir = parsed.examplesDir ?? path.resolve(process.cwd(), 'examples', 'skills')
    for (const ex of scanExamples(examplesDir)) {
      const existing = merged.get(ex.slug)
      if (!existing) merged.set(ex.slug, ex)
      else existing.installs.push(...ex.installs)
    }
  }

  const installed = Array.from(merged.values()).sort((a, b) => a.slug.localeCompare(b.slug))

  let catalog: CatalogV1 | null = null
  let catalogSource: 'network' | 'cache' | 'skipped' = 'skipped'
  try {
    const result = await fetchCatalog(parsed.catalogUrl)
    catalog = result.catalog
    catalogSource = result.source
  } catch (err) {
    if (!parsed.json) {
      console.error(`  ⚠ catalog unavailable: ${err instanceof CatalogError ? err.message : String(err)}`)
    }
  }

  const diffs = diffAgainstCatalog(installed, catalog)

  // Optional filter: only show updatable
  let visible = diffs
  if (parsed.onlyUpdates) visible = visible.filter((d) => d.status.kind === 'updatable')

  // Optional: augment with catalog entries not installed
  let catalogExtras: SkillEntry[] = []
  if (parsed.showCatalog && catalog) {
    const installedSlugs = new Set(installed.map((s) => s.slug))
    catalogExtras = catalog.skills.filter((e) => !installedSlugs.has(e.slug))
  }

  if (parsed.json) {
    const payload = {
      installed,
      diff: visible,
      catalog_source: catalogSource,
      catalog_extras: catalogExtras,
    }
    console.log(JSON.stringify(payload, null, 2))
    return 0
  }

  // Human text output
  if (visible.length === 0 && catalogExtras.length === 0) {
    if (parsed.onlyUpdates) console.log('  All skills up to date.')
    else console.log('  No soulkiller skills found.')
    return 0
  }

  const rowsFromDiff = visible.map((d) => {
    const skill = installed.find((s) => s.slug === d.slug)!
    const localVer = skill.installs.find((r) => r.version !== null)?.version ?? '—'
    const latestVer = d.catalog?.version ?? '—'
    return {
      name: d.slug,
      local: localVer,
      latest: latestVer,
      status: statusLabel(d.status),
      targets: targetsLabel(skill),
    }
  })

  const rowsFromCatalog = catalogExtras.map((e) => ({
    name: e.slug,
    local: '—',
    latest: e.version,
    status: 'not-installed',
    targets: '—',
  }))

  const rows = [...rowsFromDiff, ...rowsFromCatalog]
  const nameW = Math.max(4, ...rows.map((r) => r.name.length)) + 2
  const localW = Math.max(5, ...rows.map((r) => r.local.length)) + 2
  const latestW = Math.max(6, ...rows.map((r) => r.latest.length)) + 2
  const statusW = Math.max(6, ...rows.map((r) => r.status.length)) + 2

  console.log(
    `  ${'NAME'.padEnd(nameW)}${'LOCAL'.padEnd(localW)}${'LATEST'.padEnd(latestW)}${'STATUS'.padEnd(statusW)}TARGETS`,
  )
  console.log(`  ${'─'.repeat(nameW + localW + latestW + statusW + 7)}`)
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(nameW)}${r.local.padEnd(localW)}${r.latest.padEnd(latestW)}${r.status.padEnd(statusW)}${r.targets}`,
    )
  }

  const anyLegacy = installed.some((s) => s.installs.some((r) => r.hasLegacyRuntimeBin))
  if (anyLegacy) {
    console.log('')
    console.log('  ⚠ Some installs have legacy runtime/bin residue (pre skill-runtime-binary).')
    console.log("    Run 'soulkiller skill update <slug>' to refresh.")
  }
  return 0
}
