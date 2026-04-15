import { fetchCatalog, CatalogError } from '../catalog/client.js'
import { resolveCatalogUrl } from '../catalog/url.js'
import { installOne, summarize, formatSummaryText, type InstallResultItem } from './orchestrator.js'
import { parseTargetId, parseScope, isCwdHomeCollision, type TargetId, type Scope } from './targets.js'
import { runList } from './commands/list.js'
import { runUpdate } from './commands/update.js'
import { runUninstall } from './commands/uninstall.js'
import { runInfo } from './commands/info.js'

interface ParsedArgs {
  sources: string[]
  targets: TargetId[]
  scope: Scope
  overwrite: boolean
  all: boolean
  catalogUrl?: string
}

function parseArgs(args: string[]): ParsedArgs {
  const sources: string[] = []
  const targets: TargetId[] = []
  let scope: Scope = 'global'
  let overwrite = false
  let all = false
  let catalogUrl: string | undefined

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--to') {
      const v = args[++i]
      if (!v) throw new Error('--to requires a value')
      targets.push(parseTargetId(v))
    } else if (a === '--scope') {
      scope = parseScope(args[++i])
    } else if (a === '--overwrite') {
      overwrite = true
    } else if (a === '--all') {
      all = true
    } else if (a === '--catalog') {
      catalogUrl = args[++i]
    } else if (a.startsWith('--')) {
      throw new Error(`unknown flag: ${a}`)
    } else {
      sources.push(a)
    }
  }

  if (targets.length === 0) targets.push('claude-code')
  return { sources, targets, scope, overwrite, all, catalogUrl }
}

export async function runInstall(args: string[]): Promise<number> {
  let parsed: ParsedArgs
  try {
    parsed = parseArgs(args)
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    printUsage()
    return 2
  }

  if (!parsed.all && parsed.sources.length === 0) {
    console.error('  ✗ no skill specified. Pass a slug, URL, path, or --all.')
    printUsage()
    return 2
  }

  if (isCwdHomeCollision(parsed.scope)) {
    if (!process.stdin.isTTY) {
      console.error('  ✗ cwd is $HOME — project scope collides with global scope. Re-run with --scope global or cd elsewhere.')
      return 2
    }
    console.log('  ⚠ cwd is $HOME — project scope and global scope resolve to the same directory.')
  }

  // Load catalog (optional for URL/path sources)
  const catalogUrl = resolveCatalogUrl(parsed.catalogUrl)
  let catalog = null
  let catalogSource: 'network' | 'cache' | 'skipped' = 'skipped'
  let catalogAgeHours: number | undefined

  const needsCatalog = parsed.all || parsed.sources.some((s) => !s.startsWith('http') && !s.endsWith('.skill'))
  if (needsCatalog) {
    try {
      const result = await fetchCatalog(parsed.catalogUrl)
      catalog = result.catalog
      catalogSource = result.source
      catalogAgeHours = result.ageMs !== undefined ? Math.round(result.ageMs / 3_600_000) : undefined
    } catch (err) {
      console.error(`  ✗ ${err instanceof CatalogError ? err.message : String(err)}`)
      return 1
    }
  }

  if (catalogSource === 'cache') {
    console.log(`  ℹ using cached catalog (${catalogAgeHours}h old)`)
  }

  // Resolve source list
  let sourceList = parsed.sources
  if (parsed.all) {
    if (!catalog) {
      console.error('  ✗ --all requires catalog, which is unavailable')
      return 1
    }
    sourceList = catalog.skills.map((s) => s.slug)
  }

  console.log(`  Installing ${sourceList.length} skill(s) to ${parsed.targets.join(', ')} (${parsed.scope})…\n`)

  const allResults: InstallResultItem[] = []
  for (const source of sourceList) {
    const results = await installOne({
      source,
      targets: parsed.targets,
      scope: parsed.scope,
      overwrite: parsed.overwrite,
      catalog,
      catalogUrl,
    })
    allResults.push(...results)
  }

  const summary = summarize(allResults)
  console.log(formatSummaryText(summary))
  return summary.counts.failed > 0 ? 1 : 0
}

/**
 * Dispatcher for `soulkiller skill <subcommand>`. Keeps `install` backward
 * compatible; adds `list` / `update` / `uninstall` / `info`.
 *
 * Note: `upgrade` (engine sync) is still routed via src/index.tsx to the
 * existing skillUpgrade in skill-manager.ts; this dispatcher only owns the
 * catalog-driven subset.
 */
export async function runSkillSubcommand(sub: string, args: string[]): Promise<number> {
  switch (sub) {
    case 'install':   return runInstall(args)
    case 'list':      return runList(args)
    case 'update':    return runUpdate(args)
    case 'uninstall': return runUninstall(args)
    case 'info':      return runInfo(args)
    default:
      console.log(`Unknown subcommand: ${sub}`)
      printUsage()
      return 2
  }
}

export function printUsage(): void {
  console.log('Usage:')
  console.log('  soulkiller skill install <slug|url|path>... [--to <target>]... [--scope global|project] [--overwrite] [--catalog <url>]')
  console.log('  soulkiller skill install --all [--to <target>]... [--overwrite]')
  console.log('  soulkiller skill list [--updates] [--catalog] [--json] [--scan-dir <path>]')
  console.log('  soulkiller skill update <slug>... | --all [--check] [--exit-code-if-updates] [--force] [--json]')
  console.log('  soulkiller skill uninstall <slug> [--to <target>] [--scope …] [--all-targets] [--no-backup] [--json]')
  console.log('  soulkiller skill info <slug> [--json]')
  console.log('  soulkiller skill upgrade [--all|name]    # engine sync (local repair, offline)')
  console.log()
  console.log('Targets (multiple --to allowed):')
  console.log('  claude-code   ~/.claude/skills/          (also read by opencode)')
  console.log('  codex         ~/.agents/skills/          (also read by opencode)')
  console.log('  opencode      ~/.config/opencode/skills/ (native)')
  console.log('  openclaw      ~/.openclaw/workspace/skills/')
  console.log()
  console.log('update vs upgrade:')
  console.log('  update   pulls a newer version of the skill itself from the catalog (requires network)')
  console.log('  upgrade  syncs runtime/engine.md with this binary (local repair, no network)')
  console.log()
  console.log('Cursor is not supported (no skills directory concept).')
}
