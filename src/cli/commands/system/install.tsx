import React, { useState, useEffect, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { fetchCatalog, isCacheStale, CatalogError } from '../../catalog/client.js'
import { resolveCatalogUrl } from '../../catalog/url.js'
import type { CatalogV1 } from '../../catalog/types.js'
import { scanInstalled, type InstalledSkill } from '../../skill-install/scanner.js'
import { diffAgainstCatalog, type SkillDiff } from '../../skill-install/diff.js'
import { AvailableFlow } from './install-views/available-flow.js'
import { InstalledFlow } from './install-views/installed-flow.js'
import { t } from '../../../infra/i18n/index.js'

type Tab = 'available' | 'installed'

type TopPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'browsing'; tab: Tab }

interface Props {
  onClose: () => void
  /** Optional preselect from `/install <slug>` — forwards to Available tab. */
  preselectSlug?: string
}

export function InstallCommand({ onClose, preselectSlug }: Props) {
  const [phase, setPhase] = useState<TopPhase>({ kind: 'loading' })
  const [catalog, setCatalog] = useState<CatalogV1 | null>(null)
  const [catalogUrl] = useState<string>(() => resolveCatalogUrl())
  const [cacheAgeHours, setCacheAgeHours] = useState<number | null>(null)
  const [installed, setInstalled] = useState<InstalledSkill[]>([])
  const [diffs, setDiffs] = useState<SkillDiff[]>([])

  const refreshInstalled = useCallback(() => {
    const list = scanInstalled()
    setInstalled(list)
    setDiffs(diffAgainstCatalog(list, catalog))
  }, [catalog])

  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((result) => {
        if (cancelled) return
        setCatalog(result.catalog)
        if (result.source === 'cache' && result.ageMs !== undefined) {
          setCacheAgeHours(Math.round(result.ageMs / 3_600_000))
        }
        const list = scanInstalled()
        setInstalled(list)
        setDiffs(diffAgainstCatalog(list, result.catalog))
        setPhase({ kind: 'browsing', tab: 'available' })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof CatalogError ? err.message : err instanceof Error ? err.message : String(err)
        setPhase({ kind: 'error', message: msg })
      })
    return () => { cancelled = true }
  }, [])

  // Top-level: Tab / Shift-Tab swaps tabs. Flows handle everything else.
  useInput((input, key) => {
    if (phase.kind !== 'browsing') return
    if (key.tab) {
      setPhase({ ...phase, tab: phase.tab === 'available' ? 'installed' : 'available' })
    }
  })

  if (phase.kind === 'loading') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.title')}</Text>
        <Text color={DIM}>{t('install.loading_catalog')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.title')}</Text>
        <Text color={WARNING}>✗ {phase.message}</Text>
        <Text color={DIM}>{t('install.enter_esc_close')}</Text>
      </Box>
    )
  }

  const tabHeader = (
    <Box flexDirection="row" paddingLeft={2}>
      <Text color={phase.tab === 'available' ? PRIMARY : DIM} bold={phase.tab === 'available'}>
        {phase.tab === 'available' ? '▸ ' : '  '}{t('install.tab.available')} ({catalog?.skills.length ?? 0})
      </Text>
      <Text color={DIM}>    </Text>
      <Text color={phase.tab === 'installed' ? PRIMARY : DIM} bold={phase.tab === 'installed'}>
        {phase.tab === 'installed' ? '▸ ' : '  '}{t('install.tab.installed')} ({installed.length})
      </Text>
    </Box>
  )
  const cacheStale = cacheAgeHours !== null && isCacheStale(cacheAgeHours * 3_600_000)

  return (
    <Box flexDirection="column">
      {tabHeader}
      {cacheStale && (
        <Text color={WARNING}>  {t('install.cached_stale_tag')}</Text>
      )}
      <Text> </Text>
      {phase.tab === 'available' && catalog && (
        <AvailableFlow
          catalog={catalog}
          catalogUrl={catalogUrl}
          installed={installed}
          cacheAgeHours={cacheAgeHours}
          preselectSlug={preselectSlug}
          onExit={onClose}
          onSwitchToInstalled={() => setPhase({ kind: 'browsing', tab: 'installed' })}
        />
      )}
      {phase.tab === 'installed' && (
        <InstalledFlow
          installed={installed}
          diffs={diffs}
          catalog={catalog}
          catalogUrl={catalogUrl}
          onExit={onClose}
          onSwitchToAvailable={() => setPhase({ kind: 'browsing', tab: 'available' })}
          onRefresh={refreshInstalled}
        />
      )}
    </Box>
  )
}
