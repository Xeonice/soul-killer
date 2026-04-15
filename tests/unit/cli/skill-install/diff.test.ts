import { describe, it, expect } from 'vitest'
import { diffAgainstCatalog } from '../../../../src/cli/skill-install/diff.js'
import type { InstalledSkill } from '../../../../src/cli/skill-install/scanner.js'
import type { CatalogV1, SkillEntry } from '../../../../src/cli/catalog/types.js'

function mkCatalog(skills: Partial<SkillEntry>[]): CatalogV1 {
  return {
    version: 1,
    updated_at: '2026-04-15',
    soulkiller_version_min: '0.4.0',
    skills: skills.map((s) => ({
      slug: s.slug!,
      display_name: s.display_name ?? s.slug!,
      description: s.description ?? '',
      version: s.version ?? '1.0.0',
      engine_version: s.engine_version ?? 2,
      size_bytes: s.size_bytes ?? 0,
      sha256: s.sha256 ?? '',
      url: s.url ?? 'https://example.invalid',
      soulkiller_version_min: s.soulkiller_version_min ?? '0.4.0',
    })),
  }
}

function mkInstalled(slug: string, version: string | null): InstalledSkill {
  return {
    slug,
    installs: [
      {
        target: 'claude-code',
        scope: 'global',
        path: `/tmp/${slug}`,
        version,
        engineVersion: 2,
        soulkillerVersion: null,
        hasLegacyRuntimeBin: false,
      },
    ],
  }
}

describe('diffAgainstCatalog', () => {
  it('reports up-to-date when versions match', () => {
    const catalog = mkCatalog([{ slug: 'fate-zero', version: '0.4.0' }])
    const diffs = diffAgainstCatalog([mkInstalled('fate-zero', '0.4.0')], catalog)
    expect(diffs[0]!.status).toEqual({ kind: 'up-to-date', version: '0.4.0' })
  })

  it('reports updatable with from/to when versions differ', () => {
    const catalog = mkCatalog([{ slug: 'fate-zero', version: '0.4.0' }])
    const diffs = diffAgainstCatalog([mkInstalled('fate-zero', '0.3.1')], catalog)
    expect(diffs[0]!.status).toEqual({ kind: 'updatable', from: '0.3.1', to: '0.4.0' })
  })

  it('reports unknown-version when local version is null', () => {
    const catalog = mkCatalog([{ slug: 'fate-zero', version: '0.4.0' }])
    const diffs = diffAgainstCatalog([mkInstalled('fate-zero', null)], catalog)
    expect(diffs[0]!.status).toEqual({ kind: 'unknown-version', reason: 'no-version-field' })
  })

  it('reports not-in-catalog when slug missing', () => {
    const catalog = mkCatalog([])
    const diffs = diffAgainstCatalog([mkInstalled('fate-zero', '0.3.1')], catalog)
    expect(diffs[0]!.status).toEqual({ kind: 'not-in-catalog' })
    expect(diffs[0]!.catalog).toBeNull()
  })

  it('null catalog produces not-in-catalog for all entries', () => {
    const diffs = diffAgainstCatalog([mkInstalled('fate-zero', '0.3.1')], null)
    expect(diffs[0]!.status).toEqual({ kind: 'not-in-catalog' })
  })

  it('aggregates per-install: updatable beats up-to-date', () => {
    const catalog = mkCatalog([{ slug: 'fate-zero', version: '0.4.0' }])
    const skill: InstalledSkill = {
      slug: 'fate-zero',
      installs: [
        { target: 'claude-code', scope: 'global', path: '/a', version: '0.4.0', engineVersion: 2, soulkillerVersion: null, hasLegacyRuntimeBin: false },
        { target: 'codex', scope: 'global', path: '/b', version: '0.3.1', engineVersion: 2, soulkillerVersion: null, hasLegacyRuntimeBin: false },
      ],
    }
    const [diff] = diffAgainstCatalog([skill], catalog)
    expect(diff!.status.kind).toBe('updatable')
    expect(diff!.perInstall).toHaveLength(2)
    expect(diff!.perInstall[0]!.status.kind).toBe('up-to-date')
    expect(diff!.perInstall[1]!.status.kind).toBe('updatable')
  })

  it('aggregates per-install: unknown beats updatable', () => {
    const catalog = mkCatalog([{ slug: 'fate-zero', version: '0.4.0' }])
    const skill: InstalledSkill = {
      slug: 'fate-zero',
      installs: [
        { target: 'claude-code', scope: 'global', path: '/a', version: null, engineVersion: 2, soulkillerVersion: null, hasLegacyRuntimeBin: false },
        { target: 'codex', scope: 'global', path: '/b', version: '0.3.1', engineVersion: 2, soulkillerVersion: null, hasLegacyRuntimeBin: false },
      ],
    }
    const [diff] = diffAgainstCatalog([skill], catalog)
    expect(diff!.status.kind).toBe('unknown-version')
  })
})
