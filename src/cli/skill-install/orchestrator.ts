import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { CatalogV1, SkillEntry } from '../catalog/types.js'
import { classifySource, fetchArchive, DownloadError, type Source, type FetchedArchive } from './downloader.js'
import { extractSkillArchive, checkEngineCompat, EngineIncompatibleError } from './extractor.js'
import { atomicInstall, ConflictError } from './installer.js'
import { resolveTargetDir, type TargetId, type Scope } from './targets.js'

export type InstallStatus = 'installed' | 'skipped' | 'failed'

export interface InstallPlanItem {
  slug: string
  target: TargetId
  scope: Scope
  destDir: string
  /** If archive was from catalog, the matched entry */
  catalogEntry?: SkillEntry
}

export interface InstallResultItem extends InstallPlanItem {
  status: InstallStatus
  engineVersion?: number
  reason?: string
}

export interface InstallInput {
  source: string
  targets: TargetId[]
  scope: Scope
  overwrite: boolean
  catalog: CatalogV1 | null
  catalogUrl: string
}

/**
 * Run the full install pipeline for one source across multiple targets.
 * Downloads once, extracts once, then copies into each target's destination.
 */
export async function installOne(input: InstallInput): Promise<InstallResultItem[]> {
  const { source, targets, scope, overwrite, catalog, catalogUrl } = input
  const src: Source = classifySource(source)

  // ── Download + verify ─────────────────────────────────────────
  let archive: FetchedArchive
  try {
    archive = await fetchArchive(src, catalog, catalogUrl)
  } catch (err) {
    const reason = err instanceof DownloadError ? err.message : String(err)
    return targets.map<InstallResultItem>((t) => ({
      slug: displaySlug(src, undefined),
      target: t,
      scope,
      destDir: '',
      status: 'failed',
      reason,
    }))
  }

  // ── Extract to staging ────────────────────────────────────────
  const baseStaging = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-install-'))
  const extracted = extractSkillArchive(archive.bytes, baseStaging)

  // ── Engine compat ─────────────────────────────────────────────
  try {
    checkEngineCompat(extracted.engineVersion, displaySlug(src, archive.entry))
  } catch (err) {
    fs.rmSync(baseStaging, { recursive: true, force: true })
    const reason = err instanceof EngineIncompatibleError ? err.message : String(err)
    return targets.map<InstallResultItem>((t) => ({
      slug: displaySlug(src, archive.entry),
      target: t,
      scope,
      destDir: resolveTargetDir(t, scope) + '/' + displaySlug(src, archive.entry),
      status: 'failed',
      reason,
    }))
  }

  // Determine the final directory name inside target dirs
  const slug = pickSlugName(src, archive.entry, extracted.soulkillerJson)

  const results: InstallResultItem[] = []

  // ── Install to each target ────────────────────────────────────
  for (const target of targets) {
    let targetDir: string
    try {
      targetDir = resolveTargetDir(target, scope)
    } catch (err) {
      results.push({
        slug, target, scope, destDir: '',
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    const destDir = path.join(targetDir, slug)

    // Per-target staging (copy of base extraction so we can `rename` once per target)
    const perTargetStage = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-install-stage-'))
    try {
      copyDirSync(extracted.stagingDir, perTargetStage)
      atomicInstall({ sourceDir: perTargetStage, destDir, overwrite })
      results.push({
        slug, target, scope, destDir,
        status: 'installed',
        engineVersion: extracted.engineVersion ?? undefined,
        catalogEntry: archive.entry,
      })
    } catch (err) {
      // Cleanup per-target stage
      fs.rmSync(perTargetStage, { recursive: true, force: true })
      const reason = err instanceof ConflictError
        ? 'already installed (use --overwrite)'
        : err instanceof Error ? err.message : String(err)
      const status: InstallStatus = err instanceof ConflictError ? 'skipped' : 'failed'
      results.push({ slug, target, scope, destDir, status, reason })
    }
  }

  fs.rmSync(baseStaging, { recursive: true, force: true })
  return results
}

function displaySlug(src: Source, entry?: SkillEntry): string {
  if (entry) return entry.slug
  if (src.kind === 'slug') return src.slug
  if (src.kind === 'url') return path.basename(new URL(src.url).pathname).replace(/\.skill$/, '') || 'skill'
  return path.basename(src.path).replace(/\.skill$/, '') || 'skill'
}

function pickSlugName(
  src: Source,
  entry: SkillEntry | undefined,
  soulkillerJson: Record<string, unknown> | null,
): string {
  if (entry) return entry.slug
  const id = soulkillerJson?.skill_id
  if (typeof id === 'string' && id.length > 0) return id
  if (src.kind === 'slug') return src.slug
  const base = src.kind === 'url'
    ? path.basename(new URL(src.url).pathname)
    : path.basename(src.path)
  return base.replace(/\.skill$/, '') || 'skill'
}

function copyDirSync(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name)
    const d = path.join(destDir, entry.name)
    if (entry.isDirectory()) copyDirSync(s, d)
    else if (entry.isFile()) fs.copyFileSync(s, d)
  }
}

// ── Summary rendering ──────────────────────────────────────────

export interface InstallSummary {
  items: InstallResultItem[]
  counts: { installed: number; skipped: number; failed: number }
}

export function summarize(items: InstallResultItem[]): InstallSummary {
  const counts = { installed: 0, skipped: 0, failed: 0 }
  for (const item of items) counts[item.status]++
  return { items, counts }
}

export function formatSummaryText(summary: InstallSummary): string {
  const lines: string[] = []
  for (const r of summary.items) {
    const icon = r.status === 'installed' ? '✓' : r.status === 'skipped' ? '•' : '✗'
    const tag = r.status === 'installed' && r.engineVersion !== undefined
      ? ` (engine v${r.engineVersion})`
      : ''
    const trailer = r.reason ? `  ${r.reason}` : tag
    lines.push(`  ${icon} ${r.slug}  ${r.target}  ${r.status}${trailer}`)
  }
  const { installed, skipped, failed } = summary.counts
  lines.push('')
  lines.push(`  ${installed} installed · ${skipped} skipped · ${failed} failed`)

  if (failed > 0) {
    lines.push('')
    for (const r of summary.items.filter((x) => x.status === 'failed')) {
      lines.push(`  Retry: soulkiller skill install ${r.slug} --to ${r.target}`)
    }
  }
  return lines.join('\n')
}
