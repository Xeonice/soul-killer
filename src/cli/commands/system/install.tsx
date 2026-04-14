import React, { useState, useEffect, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { fetchCatalog, isCacheStale, CatalogError } from '../../catalog/client.js'
import { resolveCatalogUrl } from '../../catalog/url.js'
import type { CatalogV1 } from '../../catalog/types.js'
import { ALL_TARGET_IDS, TARGETS, resolveTargetDir, isCwdHomeCollision, type TargetId, type Scope } from '../../skill-install/targets.js'
import { installOne, summarize, type InstallResultItem } from '../../skill-install/orchestrator.js'
import { t } from '../../../infra/i18n/index.js'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'pick-skills'; cursor: number; selected: Set<string> }
  | { kind: 'pick-targets'; cursor: number; selected: Set<TargetId> }
  | { kind: 'pick-scope'; cursor: number }
  | { kind: 'preview' }
  | { kind: 'installing'; progress: string[]; results: InstallResultItem[] }
  | { kind: 'done'; results: InstallResultItem[] }

interface Props {
  onClose: () => void
  /** Optional preselect from `/install <slug>` */
  preselectSlug?: string
}

export function InstallCommand({ onClose, preselectSlug }: Props) {
  const [catalog, setCatalog] = useState<CatalogV1 | null>(null)
  const [catalogUrl] = useState<string>(() => resolveCatalogUrl())
  const [cacheAgeHours, setCacheAgeHours] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [overwrite] = useState(false)

  const [pickedSkills, setPickedSkills] = useState<string[]>([])
  const [pickedTargets, setPickedTargets] = useState<TargetId[]>([])
  const [scope, setScope] = useState<Scope>('global')

  // ── Load catalog ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((result) => {
        if (cancelled) return
        setCatalog(result.catalog)
        if (result.source === 'cache' && result.ageMs !== undefined) {
          setCacheAgeHours(Math.round(result.ageMs / 3_600_000))
        }
        // Kick off first step
        if (preselectSlug) {
          setPickedSkills([preselectSlug])
          setPhase({ kind: 'pick-targets', cursor: 0, selected: new Set() })
        } else {
          setPhase({ kind: 'pick-skills', cursor: 0, selected: new Set() })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof CatalogError ? err.message : err instanceof Error ? err.message : String(err)
        setPhase({ kind: 'error', message: msg })
      })
    return () => { cancelled = true }
  }, [preselectSlug])

  // ── Input handling ──────────────────────────────────────────
  useInput((input, key) => {
    if (phase.kind === 'loading') return
    if (phase.kind === 'error') { if (key.escape || key.return) onClose(); return }
    if (phase.kind === 'installing') return
    if (phase.kind === 'done') { if (key.escape || key.return) onClose(); return }

    if (key.escape) { onClose(); return }

    if (phase.kind === 'pick-skills' && catalog) {
      const max = catalog.skills.length
      if (max === 0) { if (key.return || key.escape) onClose(); return }
      if (key.upArrow) setPhase({ ...phase, cursor: (phase.cursor - 1 + max) % max })
      else if (key.downArrow) setPhase({ ...phase, cursor: (phase.cursor + 1) % max })
      else if (input === ' ') {
        const next = new Set(phase.selected)
        const slug = catalog.skills[phase.cursor]!.slug
        if (next.has(slug)) next.delete(slug); else next.add(slug)
        setPhase({ ...phase, selected: next })
      } else if (input === 'a') {
        const next = new Set(catalog.skills.map((s) => s.slug))
        setPhase({ ...phase, selected: next })
      } else if (key.return) {
        if (phase.selected.size === 0) return
        setPickedSkills([...phase.selected])
        setPhase({ kind: 'pick-targets', cursor: 0, selected: new Set() })
      }
    } else if (phase.kind === 'pick-targets') {
      const max = ALL_TARGET_IDS.length
      if (key.upArrow) setPhase({ ...phase, cursor: (phase.cursor - 1 + max) % max })
      else if (key.downArrow) setPhase({ ...phase, cursor: (phase.cursor + 1) % max })
      else if (input === ' ') {
        const next = new Set(phase.selected)
        const id = ALL_TARGET_IDS[phase.cursor]!
        if (next.has(id)) next.delete(id); else next.add(id)
        setPhase({ ...phase, selected: next })
      } else if (key.return) {
        if (phase.selected.size === 0) return
        const chosen = [...phase.selected]
        setPickedTargets(chosen)
        // Need scope step only if any non-openclaw target is selected
        const needsScope = chosen.some((t) => TARGETS[t].supportsProject)
        if (needsScope) setPhase({ kind: 'pick-scope', cursor: 0 })
        else { setScope('global'); setPhase({ kind: 'preview' }) }
      }
    } else if (phase.kind === 'pick-scope') {
      if (key.upArrow || key.downArrow) setPhase({ ...phase, cursor: phase.cursor === 0 ? 1 : 0 })
      else if (key.return) {
        const s: Scope = phase.cursor === 0 ? 'global' : 'project'
        setScope(s)
        setPhase({ kind: 'preview' })
      }
    } else if (phase.kind === 'preview') {
      if (key.return) runInstall()
    }
  })

  const runInstall = useCallback(async () => {
    setPhase({ kind: 'installing', progress: [], results: [] })
    const all: InstallResultItem[] = []
    for (const slug of pickedSkills) {
      setPhase((p) => p.kind === 'installing' ? { ...p, progress: [...p.progress, t('install.downloading', { slug })] } : p)
      const results = await installOne({
        source: slug,
        targets: pickedTargets,
        scope,
        overwrite,
        catalog,
        catalogUrl,
      })
      all.push(...results)
      setPhase((p) => p.kind === 'installing' ? { ...p, results: [...all], progress: [...p.progress, t('install.done_line', { slug })] } : p)
    }
    setPhase({ kind: 'done', results: all })
  }, [pickedSkills, pickedTargets, scope, overwrite, catalog, catalogUrl])

  // ── Render ──────────────────────────────────────────────────
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

  const catalogHeader = cacheAgeHours !== null ? (
    <Text color={DIM}>{t('install.cached_catalog', {
      hours: String(cacheAgeHours),
      stale_tag: isCacheStale(cacheAgeHours * 3_600_000) ? t('install.cached_stale_tag') : '',
    })}</Text>
  ) : null

  if (phase.kind === 'pick-skills' && catalog) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step1')}</Text>
        {catalogHeader}
        <Text> </Text>
        {catalog.skills.map((s, i) => {
          const checked = phase.selected.has(s.slug)
          const current = i === phase.cursor
          return (
            <Text key={s.slug} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {checked ? '◉' : '◯'} {s.slug.padEnd(20)} {s.display_name}  ({(s.size_bytes / 1024 / 1024).toFixed(1)} MB)
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_skills')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'pick-targets') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step2')}</Text>
        <Text color={DIM}>{t('install.selected_skills', { slugs: pickedSkills.join(', ') })}</Text>
        <Text> </Text>
        {ALL_TARGET_IDS.map((id, i) => {
          const checked = phase.selected.has(id)
          const current = i === phase.cursor
          return (
            <Text key={id} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {checked ? '◉' : '◯'} {id.padEnd(14)} {TARGETS[id].display}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.cursor_not_supported')}</Text>
        <Text color={DIM}>{t('install.hint_targets')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'pick-scope') {
    const warn = isCwdHomeCollision('project')
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step3')}</Text>
        <Text> </Text>
        <Text color={phase.cursor === 0 ? PRIMARY : DIM}>
          {phase.cursor === 0 ? '❯ ● ' : '  ○ '}{t('install.scope_global')}
        </Text>
        <Text color={phase.cursor === 1 ? PRIMARY : DIM}>
          {phase.cursor === 1 ? '❯ ● ' : '  ○ '}{t('install.scope_project')}
        </Text>
        <Text> </Text>
        {warn && phase.cursor === 1 && (
          <Text color={WARNING}>{t('install.warn_cwd_home')}</Text>
        )}
        <Text color={DIM}>{t('install.hint_scope')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'preview') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step4')}</Text>
        <Text> </Text>
        {pickedSkills.map((slug) => (
          <Box key={slug} flexDirection="column">
            <Text color={PRIMARY}>  {slug}</Text>
            {pickedTargets.map((tgt) => {
              let dir = ''
              try { dir = resolveTargetDir(tgt, scope) + '/' + slug }
              catch (err) { dir = '(' + (err instanceof Error ? err.message : String(err)) + ')' }
              return <Text key={tgt} color={DIM}>    → [{tgt}] {dir}</Text>
            })}
          </Box>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('install.total', { skills: String(pickedSkills.length), targets: String(pickedTargets.length) })}</Text>
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_preview')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'installing') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.installing')}</Text>
        <Text> </Text>
        {phase.progress.map((line, i) => <Text key={i} color={DIM}>  {line}</Text>)}
      </Box>
    )
  }

  if (phase.kind === 'done') {
    const summary = summarize(phase.results)
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.done')}</Text>
        <Text> </Text>
        {phase.results.map((r, i) => {
          const icon = r.status === 'installed' ? '✓' : r.status === 'skipped' ? '•' : '✗'
          const color = r.status === 'failed' ? WARNING : r.status === 'installed' ? PRIMARY : DIM
          return (
            <Text key={i} color={color}>
              {`  ${icon} ${r.slug}  ${r.target}  ${r.status}`}{r.reason ? `  ${r.reason}` : ''}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.counts', {
          installed: String(summary.counts.installed),
          skipped: String(summary.counts.skipped),
          failed: String(summary.counts.failed),
        })}</Text>
        <Text> </Text>
        <Text color={DIM}>{t('install.enter_esc_close')}</Text>
      </Box>
    )
  }

  return null
}
