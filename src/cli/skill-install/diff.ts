import type { CatalogV1, SkillEntry } from '../catalog/types.js'
import type { InstalledSkill, InstallRecord } from './scanner.js'

export type UpdateStatus =
  | { kind: 'up-to-date'; version: string }
  | { kind: 'updatable'; from: string; to: string }
  | { kind: 'unknown-version'; reason: 'no-soulkiller-json' | 'no-version-field' }
  | { kind: 'not-in-catalog' }

export interface PerInstallDiff extends InstallRecord {
  status: UpdateStatus
}

export interface SkillDiff {
  slug: string
  /** Aggregated status across all installs of the slug. */
  status: UpdateStatus
  catalog: SkillEntry | null
  perInstall: PerInstallDiff[]
}

/**
 * Per-install and aggregate diff of each installed skill vs a catalog.
 *
 * Aggregate rules:
 *   - If catalog has no entry for the slug → not-in-catalog
 *   - Else if any install has an unknown version → unknown-version
 *     (explicitly surfaced so UIs can nudge users to --force or reinstall)
 *   - Else if any install's version ≠ catalog.version → updatable
 *   - Else → up-to-date
 */
export function diffAgainstCatalog(
  installed: InstalledSkill[],
  catalog: CatalogV1 | null,
): SkillDiff[] {
  const bySlug = new Map<string, SkillEntry>()
  if (catalog) {
    for (const entry of catalog.skills) bySlug.set(entry.slug, entry)
  }

  return installed.map((skill) => {
    const catalogEntry = bySlug.get(skill.slug) ?? null
    const perInstall = skill.installs.map((rec) => ({
      ...rec,
      status: statusFor(rec, catalogEntry),
    }))
    return {
      slug: skill.slug,
      status: aggregateStatus(perInstall.map((p) => p.status)),
      catalog: catalogEntry,
      perInstall,
    }
  })
}

function statusFor(rec: InstallRecord, catalog: SkillEntry | null): UpdateStatus {
  if (!catalog) return { kind: 'not-in-catalog' }
  if (rec.version === null) {
    return { kind: 'unknown-version', reason: 'no-version-field' }
  }
  if (rec.version === catalog.version) {
    return { kind: 'up-to-date', version: rec.version }
  }
  return { kind: 'updatable', from: rec.version, to: catalog.version }
}

function aggregateStatus(statuses: UpdateStatus[]): UpdateStatus {
  if (statuses.length === 0) return { kind: 'not-in-catalog' }
  // Priority: not-in-catalog > unknown > updatable > up-to-date
  for (const s of statuses) if (s.kind === 'not-in-catalog') return s
  for (const s of statuses) if (s.kind === 'unknown-version') return s
  for (const s of statuses) if (s.kind === 'updatable') return s
  // All up-to-date: pick the first (all same version)
  const first = statuses[0]
  if (first && first.kind === 'up-to-date') return first
  return { kind: 'not-in-catalog' }
}
