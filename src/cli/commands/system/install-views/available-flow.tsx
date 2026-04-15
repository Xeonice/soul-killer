import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../../animation/colors.js'
import { ALL_TARGET_IDS, TARGETS, resolveTargetDir, isCwdHomeCollision, type TargetId, type Scope } from '../../../skill-install/targets.js'
import { installOne, summarize, type InstallResultItem } from '../../../skill-install/orchestrator.js'
import type { CatalogV1 } from '../../../catalog/types.js'
import type { InstalledSkill } from '../../../skill-install/scanner.js'
import { t } from '../../../../infra/i18n/index.js'

type Phase =
  | { kind: 'pick-skills'; cursor: number; selected: Set<string> }
  | { kind: 'pick-targets'; cursor: number; selected: Set<TargetId> }
  | { kind: 'pick-scope'; cursor: number }
  | { kind: 'preview' }
  | { kind: 'installing'; progress: string[]; results: InstallResultItem[] }
  | { kind: 'done'; results: InstallResultItem[] }
  | { kind: 'conflict-toast'; message: string; returnTo: Phase }

export interface AvailableFlowProps {
  catalog: CatalogV1
  catalogUrl: string
  installed: InstalledSkill[]
  cacheAgeHours: number | null
  preselectSlug?: string
  onExit: () => void
  onSwitchToInstalled: () => void
}

/** Compute which targets a slug is already installed to (global scope only for wizard). */
function installedTargets(installed: InstalledSkill[], slug: string): Set<TargetId> {
  const out = new Set<TargetId>()
  const entry = installed.find((s) => s.slug === slug)
  if (!entry) return out
  for (const rec of entry.installs) {
    if (rec.target === 'example') continue
    out.add(rec.target as TargetId)
  }
  return out
}

function coverageBadge(installed: InstalledSkill[], slug: string, totalTargets: number): string | null {
  const covered = installedTargets(installed, slug).size
  if (covered === 0) return null
  if (covered >= totalTargets) return '[✓ all]'
  return '[追装]'
}

export function AvailableFlow(props: AvailableFlowProps) {
  const { catalog, catalogUrl, installed, cacheAgeHours, preselectSlug, onExit, onSwitchToInstalled } = props

  const initialPhase: Phase = preselectSlug
    ? { kind: 'pick-targets', cursor: 0, selected: new Set() }
    : { kind: 'pick-skills', cursor: 0, selected: new Set() }

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [pickedSkills, setPickedSkills] = useState<string[]>(preselectSlug ? [preselectSlug] : [])
  const [pickedTargets, setPickedTargets] = useState<TargetId[]>([])
  const [scope, setScope] = useState<Scope>('global')

  const runInstall = useCallback(async () => {
    setPhase({ kind: 'installing', progress: [], results: [] })
    const all: InstallResultItem[] = []
    for (const slug of pickedSkills) {
      setPhase((p) => p.kind === 'installing' ? { ...p, progress: [...p.progress, t('install.downloading', { slug })] } : p)
      const results = await installOne({
        source: slug,
        targets: pickedTargets,
        scope,
        overwrite: false, // Available flow never overwrites; Update action handles upgrades
        catalog,
        catalogUrl,
      })
      all.push(...results)
      setPhase((p) => p.kind === 'installing' ? { ...p, results: [...all], progress: [...p.progress, t('install.done_line', { slug })] } : p)
    }
    setPhase({ kind: 'done', results: all })
  }, [pickedSkills, pickedTargets, scope, catalog, catalogUrl])

  useInput((input, key) => {
    if (phase.kind === 'installing') return
    if (phase.kind === 'done') { if (key.escape || key.return) onExit(); return }
    if (phase.kind === 'conflict-toast') {
      if (key.return) setPhase(phase.returnTo)
      else if (key.escape) onExit()
      return
    }

    if (key.escape) { onExit(); return }

    if (phase.kind === 'pick-skills') {
      const max = catalog.skills.length
      if (max === 0) { if (key.return || key.escape) onExit(); return }
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
      } else if (input === 'i') {
        onSwitchToInstalled()
      } else if (key.return) {
        if (phase.selected.size === 0) return
        // Check if all selected are fully covered; if so, hint to use Installed tab
        const fullCoverCount = [...phase.selected].filter((s) => {
          return installedTargets(installed, s).size >= ALL_TARGET_IDS.length
        }).length
        if (fullCoverCount > 0 && fullCoverCount === phase.selected.size) {
          setPhase({
            kind: 'conflict-toast',
            message: t('install.hint_all_installed'),
            returnTo: phase,
          })
          return
        }
        setPickedSkills([...phase.selected])
        // Precompute a default target set: union of "not yet covered" targets
        const precovered = new Set<TargetId>()
        for (const slug of phase.selected) {
          for (const tgt of installedTargets(installed, slug)) precovered.add(tgt)
        }
        const suggested = new Set(ALL_TARGET_IDS.filter((t) => !precovered.has(t)))
        setPhase({
          kind: 'pick-targets',
          cursor: 0,
          selected: suggested.size > 0 ? suggested : new Set(),
        })
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

  const catalogHeader = cacheAgeHours !== null ? (
    <Text color={DIM}>{t('install.cached_catalog', {
      hours: String(cacheAgeHours),
      stale_tag: '',
    })}</Text>
  ) : null

  if (phase.kind === 'pick-skills') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step1')}</Text>
        {catalogHeader}
        <Text> </Text>
        {catalog.skills.map((s, i) => {
          const checked = phase.selected.has(s.slug)
          const current = i === phase.cursor
          const badge = coverageBadge(installed, s.slug, ALL_TARGET_IDS.length) ?? ''
          return (
            <Text key={s.slug} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {checked ? '◉' : '◯'} {s.slug.padEnd(20)} {s.display_name}  ({(s.size_bytes / 1024 / 1024).toFixed(1)} MB)  {badge}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_skills')}</Text>
        <Text color={DIM}>{t('install.hint_tab_switch')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'pick-targets') {
    const alreadyCovered = new Set<TargetId>()
    for (const slug of pickedSkills) {
      for (const tgt of installedTargets(installed, slug)) alreadyCovered.add(tgt)
    }
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.step2')}</Text>
        <Text color={DIM}>{t('install.selected_skills', { slugs: pickedSkills.join(', ') })}</Text>
        <Text> </Text>
        {ALL_TARGET_IDS.map((id, i) => {
          const checked = phase.selected.has(id)
          const current = i === phase.cursor
          const covered = alreadyCovered.has(id)
          const suffix = covered ? ` ${t('install.target_already_covered')}` : ''
          return (
            <Text key={id} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {checked ? '◉' : '◯'} {id.padEnd(14)} {TARGETS[id].display}{suffix}
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
          const hint = r.status === 'skipped' ? `  ${t('install.hint_use_update')}` : (r.reason ? `  ${r.reason}` : '')
          return (
            <Text key={i} color={color}>
              {`  ${icon} ${r.slug}  ${r.target}  ${r.status}`}{hint}
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

  if (phase.kind === 'conflict-toast') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={WARNING}>{phase.message}</Text>
        <Text color={DIM}>{t('install.enter_to_continue_esc_to_exit')}</Text>
      </Box>
    )
  }

  return null
}
