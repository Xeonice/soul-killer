import { fetchCatalog, CatalogError } from '../../catalog/client.js'
import { scanInstalled } from '../scanner.js'
import { diffAgainstCatalog } from '../diff.js'
import type { CatalogV1 } from '../../catalog/types.js'

interface InfoArgs {
  slug: string
  json: boolean
  catalogUrl?: string
}

function parseArgs(args: string[]): InfoArgs {
  const out: Partial<InfoArgs> = { json: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--json') out.json = true
    else if (a === '--catalog') out.catalogUrl = args[++i]
    else if (a.startsWith('--')) throw new Error(`unknown flag for 'skill info': ${a}`)
    else if (!out.slug) out.slug = a
    else throw new Error(`unexpected positional: ${a}`)
  }
  if (!out.slug) throw new Error("missing <slug> (e.g. 'skill info fate-zero')")
  return out as InfoArgs
}

export async function runInfo(args: string[]): Promise<number> {
  let parsed: InfoArgs
  try {
    parsed = parseArgs(args)
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  const installed = scanInstalled()
  const skill = installed.find((s) => s.slug === parsed.slug)

  let catalog: CatalogV1 | null = null
  try {
    const result = await fetchCatalog(parsed.catalogUrl)
    catalog = result.catalog
  } catch (err) {
    if (!parsed.json) {
      console.error(`  ⚠ catalog unavailable: ${err instanceof CatalogError ? err.message : String(err)}`)
    }
  }

  const catalogEntry = catalog?.skills.find((e) => e.slug === parsed.slug) ?? null
  const [diff] = skill ? diffAgainstCatalog([skill], catalog) : [null]

  if (parsed.json) {
    console.log(JSON.stringify({
      slug: parsed.slug,
      installed: skill?.installs ?? [],
      catalog: catalogEntry,
      diff,
    }, null, 2))
    return skill ? 0 : 1
  }

  if (!skill && !catalogEntry) {
    console.error(`  ✗ ${parsed.slug}: not installed and not in catalog`)
    return 1
  }

  console.log(`  ${parsed.slug}`)
  if (catalogEntry) {
    console.log(`    Catalog version: ${catalogEntry.version}`)
    console.log(`    Engine version:  ${catalogEntry.engine_version}`)
    console.log(`    Display name:    ${catalogEntry.display_name}`)
    if (catalogEntry.description) console.log(`    Description:     ${catalogEntry.description}`)
  } else {
    console.log('    Catalog:         (not in catalog)')
  }

  if (!skill) {
    console.log('    Installed:       no')
    return 0
  }

  console.log(`    Installed:       yes (${skill.installs.length} location${skill.installs.length === 1 ? '' : 's'})`)
  for (const rec of skill.installs) {
    const status = diff
      ? diff.perInstall.find((p) => p.path === rec.path)?.status
      : undefined
    const statusLabel = status ? ` [${status.kind}]` : ''
    const legacy = rec.hasLegacyRuntimeBin ? ' ⚠ legacy runtime/bin' : ''
    console.log(`      - ${rec.target}:${rec.scope}${statusLabel}${legacy}`)
    console.log(`        path:    ${rec.path}`)
    console.log(`        version: ${rec.version ?? '(unknown)'}`)
    if (rec.engineVersion !== null) console.log(`        engine:  ${rec.engineVersion}`)
  }
  return 0
}
