import fs from 'node:fs'
import path from 'node:path'
import { scanInstalled, type InstallRecord } from '../scanner.js'
import { atomicUninstall, NotInstalledError } from '../uninstaller.js'
import { resolveTargetDir, parseTargetId, parseScope, type TargetId, type Scope } from '../targets.js'

interface UninstallArgs {
  slug: string
  targets: TargetId[]
  scope: Scope
  allTargets: boolean
  backup: boolean
  json: boolean
}

function parseArgs(args: string[]): UninstallArgs {
  const out: Partial<UninstallArgs> = { targets: [], backup: true, allTargets: false, json: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--to') {
      const v = args[++i]
      if (!v) throw new Error('--to requires a value')
      out.targets!.push(parseTargetId(v))
    } else if (a === '--scope') {
      out.scope = parseScope(args[++i])
    } else if (a === '--all-targets') {
      out.allTargets = true
    } else if (a === '--no-backup') {
      out.backup = false
    } else if (a === '--json') {
      out.json = true
    } else if (a.startsWith('--')) {
      throw new Error(`unknown flag for 'skill uninstall': ${a}`)
    } else if (!out.slug) {
      out.slug = a
    } else {
      throw new Error(`unexpected positional: ${a}`)
    }
  }
  if (!out.slug) throw new Error("missing <slug> (e.g. 'skill uninstall fate-zero')")
  if (out.targets!.length === 0) out.targets = ['claude-code']
  if (!out.scope) out.scope = 'global'
  return out as UninstallArgs
}

interface UninstallItem {
  slug: string
  target: string
  scope: Scope
  path: string
  status: 'uninstalled' | 'not-installed' | 'failed'
  backupPath?: string | null
  reason?: string
}

export async function runUninstall(args: string[]): Promise<number> {
  let parsed: UninstallArgs
  try {
    parsed = parseArgs(args)
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  // Resolve which (target, scope) pairs to act on
  const pairs: Array<{ target: TargetId | 'example'; scope: Scope; path: string }> = []
  if (parsed.allTargets) {
    const installed = scanInstalled()
    const skill = installed.find((s) => s.slug === parsed.slug)
    if (!skill) {
      console.error(`  ✗ ${parsed.slug} is not installed anywhere`)
      return 1
    }
    for (const rec of skill.installs) {
      if (rec.target === 'example') continue
      pairs.push({ target: rec.target, scope: rec.scope, path: rec.path })
    }
  } else {
    for (const target of parsed.targets) {
      const dir = path.join(resolveTargetDir(target, parsed.scope), parsed.slug)
      pairs.push({ target, scope: parsed.scope, path: dir })
    }
  }

  const items: UninstallItem[] = []
  for (const pair of pairs) {
    if (!fs.existsSync(pair.path)) {
      items.push({
        slug: parsed.slug,
        target: pair.target,
        scope: pair.scope,
        path: pair.path,
        status: 'not-installed',
        reason: 'path does not exist',
      })
      continue
    }
    try {
      const result = atomicUninstall({ path: pair.path, backup: parsed.backup })
      items.push({
        slug: parsed.slug,
        target: pair.target,
        scope: pair.scope,
        path: pair.path,
        status: 'uninstalled',
        backupPath: result.backupPath,
      })
    } catch (err) {
      items.push({
        slug: parsed.slug,
        target: pair.target,
        scope: pair.scope,
        path: pair.path,
        status: err instanceof NotInstalledError ? 'not-installed' : 'failed',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const hasFailure = items.some((i) => i.status === 'failed')
  const nothingDone = items.every((i) => i.status === 'not-installed')

  if (parsed.json) {
    console.log(JSON.stringify({ items }, null, 2))
  } else {
    for (const r of items) {
      const icon = r.status === 'uninstalled' ? '✓' : r.status === 'not-installed' ? '•' : '✗'
      const trailer = r.status === 'uninstalled' && r.backupPath
        ? `  (backup: ${r.backupPath})`
        : r.reason ? `  ${r.reason}` : ''
      console.log(`  ${icon} ${r.slug}  ${r.target}:${r.scope}  ${r.status}${trailer}`)
    }
  }
  if (hasFailure) return 1
  if (nothingDone) return 1
  return 0
}

// Helpers kept for callers that want to inspect records during uninstall
export type { InstallRecord }
