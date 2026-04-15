import { fetchCatalog, CatalogError } from '../../catalog/client.js'
import { scanInstalled, type InstalledSkill } from '../scanner.js'
import { diffAgainstCatalog, type SkillDiff } from '../diff.js'
import { installOne, type InstallResultItem, summarize } from '../orchestrator.js'
import type { CatalogV1 } from '../../catalog/types.js'
import type { TargetId, Scope } from '../targets.js'

interface UpdateArgs {
  slugs: string[]
  all: boolean
  check: boolean
  exitCodeIfUpdates: boolean
  force: boolean
  json: boolean
  catalogUrl?: string
}

function parseArgs(args: string[]): UpdateArgs {
  const out: UpdateArgs = {
    slugs: [],
    all: false,
    check: false,
    exitCodeIfUpdates: false,
    force: false,
    json: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--all') out.all = true
    else if (a === '--check') out.check = true
    else if (a === '--exit-code-if-updates') out.exitCodeIfUpdates = true
    else if (a === '--force') out.force = true
    else if (a === '--json') out.json = true
    else if (a === '--catalog') out.catalogUrl = args[++i]
    else if (a.startsWith('--')) throw new Error(`unknown flag for 'skill update': ${a}`)
    else out.slugs.push(a)
  }
  if (!out.all && out.slugs.length === 0) {
    throw new Error("specify a slug or --all (e.g. 'skill update fate-zero' / 'skill update --all')")
  }
  return out
}

export async function runUpdate(args: string[]): Promise<number> {
  let parsed: UpdateArgs
  try {
    parsed = parseArgs(args)
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  // Catalog is mandatory — update is a catalog-driven operation.
  let catalog: CatalogV1
  let catalogUrl: string
  try {
    const result = await fetchCatalog(parsed.catalogUrl)
    catalog = result.catalog
    catalogUrl = parsed.catalogUrl ?? ''
  } catch (err) {
    console.error(`  ✗ ${err instanceof CatalogError ? err.message : String(err)}`)
    return 1
  }

  const installed = scanInstalled()
  const diffs = diffAgainstCatalog(installed, catalog)

  // Pick targets (slugs)
  let candidates: SkillDiff[]
  if (parsed.all) {
    candidates = diffs.filter((d) => shouldUpdate(d, parsed.force))
  } else {
    candidates = []
    for (const slug of parsed.slugs) {
      const d = diffs.find((x) => x.slug === slug)
      if (!d) {
        const hint = `${slug} is not installed; use 'soulkiller skill install' first`
        console.error(`  ✗ ${hint}`)
        return 2
      }
      if (shouldUpdate(d, parsed.force)) candidates.push(d)
      else if (!parsed.check) {
        if (d.status.kind === 'up-to-date') {
          console.log(`  • ${slug} already up to date (v${d.status.version})`)
        } else if (d.status.kind === 'unknown-version') {
          console.log(`  • ${slug} has unknown local version; use --force to reinstall`)
        } else if (d.status.kind === 'not-in-catalog') {
          console.log(`  • ${slug} is not in the catalog — cannot update`)
        }
      }
    }
  }

  if (parsed.check) {
    if (parsed.json) {
      console.log(JSON.stringify({ candidates }, null, 2))
    } else if (candidates.length === 0) {
      console.log('  All selected skills up to date.')
    } else {
      console.log('  Planned updates:')
      for (const d of candidates) {
        if (d.status.kind === 'updatable') {
          console.log(`    • ${d.slug}  ${d.status.from} → ${d.status.to}  (${d.perInstall.length} install${d.perInstall.length === 1 ? '' : 's'})`)
        } else if (d.status.kind === 'unknown-version') {
          console.log(`    • ${d.slug}  unknown → ${d.catalog?.version ?? '?'}  (--force)`)
        }
      }
    }
    return parsed.exitCodeIfUpdates && candidates.length > 0 ? 1 : 0
  }

  if (candidates.length === 0) {
    console.log('  Nothing to update.')
    return 0
  }

  const allResults: InstallResultItem[] = []
  for (const d of candidates) {
    const installedSkill = installed.find((s) => s.slug === d.slug)!
    // Group existing installs by (target, scope) so we reinstall to exactly
    // where the user already has it (not more, not less).
    for (const rec of installedSkill.installs) {
      if (rec.target === 'example') continue
      const results = await installOne({
        source: d.slug,
        targets: [rec.target as TargetId],
        scope: rec.scope as Scope,
        overwrite: true,
        catalog,
        catalogUrl,
      })
      allResults.push(...results)
    }
  }

  const summary = summarize(allResults)
  if (parsed.json) {
    console.log(JSON.stringify({ results: allResults, counts: summary.counts }, null, 2))
  } else {
    for (const r of allResults) {
      const icon = r.status === 'installed' ? '✓' : r.status === 'skipped' ? '•' : '✗'
      const trailer = r.reason ? `  ${r.reason}` : ''
      console.log(`  ${icon} ${r.slug}  ${r.target}  ${r.status}${trailer}`)
    }
    console.log('')
    console.log(`  ${summary.counts.installed} updated · ${summary.counts.skipped} skipped · ${summary.counts.failed} failed`)
  }
  return summary.counts.failed > 0 ? 1 : 0
}

function shouldUpdate(d: SkillDiff, force: boolean): boolean {
  if (d.status.kind === 'updatable') return true
  if (d.status.kind === 'unknown-version' && force) return true
  return false
}
