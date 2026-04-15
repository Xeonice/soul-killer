import React, { useState, useCallback } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../../animation/colors.js'
import { installOne, type InstallResultItem } from '../../../skill-install/orchestrator.js'
import { atomicUninstall } from '../../../skill-install/uninstaller.js'
import { resolveTargetDir, ALL_TARGET_IDS, type TargetId } from '../../../skill-install/targets.js'
import type { InstalledSkill, InstallRecord } from '../../../skill-install/scanner.js'
import type { SkillDiff } from '../../../skill-install/diff.js'
import type { CatalogV1 } from '../../../catalog/types.js'
import { t } from '../../../../infra/i18n/index.js'

export interface InstalledFlowProps {
  installed: InstalledSkill[]
  diffs: SkillDiff[]
  catalog: CatalogV1 | null
  catalogUrl: string
  onExit: () => void
  onSwitchToAvailable: () => void
  /** Re-scan after any mutation so the list stays in sync. */
  onRefresh: () => void
}

type Phase =
  | { kind: 'list'; cursor: number }
  | { kind: 'menu'; slug: string; cursor: number }
  | { kind: 'details'; slug: string }
  | { kind: 'add-targets'; slug: string; cursor: number; selected: Set<TargetId> }
  | { kind: 'confirm-uninstall'; slug: string; rec: InstallRecord }
  | { kind: 'executing'; progress: string[] }
  | { kind: 'result'; message: string }

function statusBadge(d: SkillDiff | undefined): string {
  if (!d) return ''
  switch (d.status.kind) {
    case 'up-to-date':      return `[v${d.status.version}]`
    case 'updatable':       return `[update → ${d.status.to}]`
    case 'unknown-version': return '[unknown]'
    case 'not-in-catalog':  return '[not-in-catalog]'
  }
}

function targetsSummary(skill: InstalledSkill): string {
  return skill.installs.map((r) => `${r.target}:${r.scope}`).join(', ')
}

export function InstalledFlow(props: InstalledFlowProps) {
  const { installed, diffs, catalog, catalogUrl, onExit, onSwitchToAvailable, onRefresh } = props

  const [phase, setPhase] = useState<Phase>({ kind: 'list', cursor: 0 })

  const findDiff = useCallback((slug: string) => diffs.find((d) => d.slug === slug), [diffs])
  const findSkill = useCallback((slug: string) => installed.find((s) => s.slug === slug), [installed])

  // Compute menu options for a slug
  function menuOptionsFor(slug: string): Array<{ id: string; label: string }> {
    const d = findDiff(slug)
    const skill = findSkill(slug)
    const opts: Array<{ id: string; label: string }> = []
    const inCatalog = !!(catalog && catalog.skills.some((e) => e.slug === slug))
    if (d && d.status.kind === 'updatable') {
      opts.push({ id: 'update', label: t('install.action.update_to', { version: d.status.to }) })
    } else if (d && d.status.kind === 'unknown-version' && inCatalog) {
      // Author-defined skill version is missing — offer a force reinstall from the catalog.
      opts.push({ id: 'reinstall', label: t('install.action.reinstall') })
    }
    if (skill && inCatalog) {
      const covered = new Set<string>(skill.installs.filter((r) => r.target !== 'example').map((r) => r.target))
      const hasGap = ALL_TARGET_IDS.some((tgt) => !covered.has(tgt))
      if (hasGap) opts.push({ id: 'add-targets', label: t('install.action.add_targets') })
    }
    opts.push({ id: 'details', label: t('install.action.details') })
    opts.push({ id: 'uninstall', label: t('install.action.uninstall') })
    opts.push({ id: 'back', label: t('install.action.back') })
    return opts
  }

  const runUpdate = useCallback(async (slug: string) => {
    const skill = findSkill(slug)
    if (!skill || !catalog) return
    setPhase({ kind: 'executing', progress: [t('install.updating', { slug })] })
    const allResults: InstallResultItem[] = []
    for (const rec of skill.installs) {
      if (rec.target === 'example') continue
      const results = await installOne({
        source: slug,
        targets: [rec.target as TargetId],
        scope: rec.scope,
        overwrite: true,
        catalog,
        catalogUrl,
      })
      allResults.push(...results)
    }
    const failed = allResults.filter((r) => r.status === 'failed').length
    const installedCount = allResults.filter((r) => r.status === 'installed').length
    const message = failed > 0
      ? t('install.update_partial', { installed: String(installedCount), failed: String(failed) })
      : t('install.update_complete', { slug, count: String(installedCount) })
    setPhase({ kind: 'result', message })
    onRefresh()
  }, [findSkill, catalog, catalogUrl, onRefresh])

  const runAddTargets = useCallback(async (slug: string, targets: TargetId[]) => {
    if (!catalog || targets.length === 0) return
    setPhase({ kind: 'executing', progress: [t('install.adding_targets', { slug, targets: targets.join(',') })] })
    const results = await installOne({
      source: slug,
      targets,
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl,
    })
    const failed = results.filter((r) => r.status === 'failed').length
    const message = failed > 0
      ? t('install.add_targets_partial', { failed: String(failed) })
      : t('install.add_targets_complete', { slug })
    setPhase({ kind: 'result', message })
    onRefresh()
  }, [catalog, catalogUrl, onRefresh])

  const runUninstall = useCallback(async (slug: string, rec: InstallRecord) => {
    setPhase({ kind: 'executing', progress: [t('install.uninstalling', { slug })] })
    try {
      if (!fs.existsSync(rec.path)) {
        setPhase({ kind: 'result', message: t('install.uninstall_not_found') })
        onRefresh()
        return
      }
      const result = atomicUninstall({ path: rec.path, backup: true })
      setPhase({ kind: 'result', message: t('install.uninstall_complete', { backup: result.backupPath ?? '(none)' }) })
      onRefresh()
    } catch (err) {
      setPhase({ kind: 'result', message: `✗ ${err instanceof Error ? err.message : String(err)}` })
    }
  }, [onRefresh])

  useInput((input, key) => {
    if (phase.kind === 'executing') return

    if (phase.kind === 'result') {
      if (key.return || key.escape) setPhase({ kind: 'list', cursor: 0 })
      return
    }

    if (phase.kind === 'list') {
      if (key.escape) { onExit(); return }
      if (input === 'a') { onSwitchToAvailable(); return }
      if (installed.length === 0) return
      const max = installed.length
      if (key.upArrow) setPhase({ ...phase, cursor: (phase.cursor - 1 + max) % max })
      else if (key.downArrow) setPhase({ ...phase, cursor: (phase.cursor + 1) % max })
      else if (key.return) {
        const slug = installed[phase.cursor]!.slug
        setPhase({ kind: 'menu', slug, cursor: 0 })
      }
      return
    }

    if (phase.kind === 'menu') {
      const opts = menuOptionsFor(phase.slug)
      if (key.escape) { setPhase({ kind: 'list', cursor: 0 }); return }
      if (key.upArrow) setPhase({ ...phase, cursor: (phase.cursor - 1 + opts.length) % opts.length })
      else if (key.downArrow) setPhase({ ...phase, cursor: (phase.cursor + 1) % opts.length })
      else if (key.return) {
        const choice = opts[phase.cursor]!.id
        if (choice === 'back') setPhase({ kind: 'list', cursor: 0 })
        else if (choice === 'update' || choice === 'reinstall') void runUpdate(phase.slug)
        else if (choice === 'details') setPhase({ kind: 'details', slug: phase.slug })
        else if (choice === 'uninstall') {
          const skill = findSkill(phase.slug)!
          const rec = skill.installs[0]!
          setPhase({ kind: 'confirm-uninstall', slug: phase.slug, rec })
        } else if (choice === 'add-targets') {
          const skill = findSkill(phase.slug)!
          const covered = new Set(skill.installs.filter((r) => r.target !== 'example').map((r) => r.target))
          const availableTargets = ALL_TARGET_IDS.filter((t) => !covered.has(t))
          setPhase({
            kind: 'add-targets',
            slug: phase.slug,
            cursor: 0,
            selected: new Set(availableTargets),
          })
        }
      }
      return
    }

    if (phase.kind === 'details') {
      if (key.return || key.escape) setPhase({ kind: 'menu', slug: phase.slug, cursor: 0 })
      return
    }

    if (phase.kind === 'add-targets') {
      const skill = findSkill(phase.slug)
      if (!skill) { setPhase({ kind: 'list', cursor: 0 }); return }
      const covered = new Set(skill.installs.filter((r) => r.target !== 'example').map((r) => r.target))
      const options = ALL_TARGET_IDS.filter((t) => !covered.has(t))
      if (key.escape) { setPhase({ kind: 'menu', slug: phase.slug, cursor: 0 }); return }
      if (options.length === 0) { setPhase({ kind: 'menu', slug: phase.slug, cursor: 0 }); return }
      if (key.upArrow) setPhase({ ...phase, cursor: (phase.cursor - 1 + options.length) % options.length })
      else if (key.downArrow) setPhase({ ...phase, cursor: (phase.cursor + 1) % options.length })
      else if (input === ' ') {
        const id = options[phase.cursor]!
        const next = new Set(phase.selected)
        if (next.has(id)) next.delete(id); else next.add(id)
        setPhase({ ...phase, selected: next })
      } else if (key.return) {
        void runAddTargets(phase.slug, Array.from(phase.selected))
      }
      return
    }

    if (phase.kind === 'confirm-uninstall') {
      if (input === 'y' || input === 'Y' || key.return) {
        void runUninstall(phase.slug, phase.rec)
      } else if (input === 'n' || input === 'N' || key.escape) {
        setPhase({ kind: 'menu', slug: phase.slug, cursor: 0 })
      }
      return
    }
  })

  if (phase.kind === 'list') {
    if (installed.length === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color={ACCENT} bold>{t('install.tab.installed')}</Text>
          <Text color={DIM}>{t('install.no_installed')}</Text>
          <Text color={DIM}>{t('install.hint_tab_switch')}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.tab.installed')}</Text>
        <Text> </Text>
        {installed.map((skill, i) => {
          const current = i === phase.cursor
          const d = findDiff(skill.slug)
          const badge = statusBadge(d)
          return (
            <Text key={skill.slug} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {skill.slug.padEnd(24)} {badge.padEnd(20)} {targetsSummary(skill)}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_installed_list')}</Text>
        <Text color={DIM}>{t('install.hint_tab_switch')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'menu') {
    const opts = menuOptionsFor(phase.slug)
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{phase.slug}</Text>
        <Text> </Text>
        {opts.map((o, i) => {
          const current = i === phase.cursor
          return (
            <Text key={o.id} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}{o.label}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_action_menu')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'details') {
    const skill = findSkill(phase.slug)
    const catalogEntry = catalog?.skills.find((e) => e.slug === phase.slug)
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{phase.slug}</Text>
        <Text> </Text>
        {catalogEntry && (
          <>
            <Text color={DIM}>Catalog version: <Text color={PRIMARY}>{catalogEntry.version}</Text></Text>
            <Text color={DIM}>Description: {catalogEntry.description}</Text>
          </>
        )}
        {skill && (
          <>
            <Text> </Text>
            <Text color={DIM}>Installs:</Text>
            {skill.installs.map((rec, i) => (
              <Box key={i} flexDirection="column">
                <Text color={DIM}>  {rec.target}:{rec.scope}</Text>
                <Text color={DIM}>    path:    {rec.path}</Text>
                <Text color={DIM}>    version: {rec.version ?? '(unknown)'}</Text>
                {rec.hasLegacyRuntimeBin && <Text color={WARNING}>    ⚠ legacy runtime/bin residue</Text>}
              </Box>
            ))}
          </>
        )}
        <Text> </Text>
        <Text color={DIM}>{t('install.enter_esc_close')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'add-targets') {
    const skill = findSkill(phase.slug)
    if (!skill) return null
    const covered = new Set(skill.installs.filter((r) => r.target !== 'example').map((r) => r.target))
    const options = ALL_TARGET_IDS.filter((t) => !covered.has(t))
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.add_targets_title', { slug: phase.slug })}</Text>
        <Text> </Text>
        {options.map((id, i) => {
          const checked = phase.selected.has(id)
          const current = i === phase.cursor
          return (
            <Text key={id} color={current ? PRIMARY : DIM}>
              {current ? '❯ ' : '  '}
              {checked ? '◉' : '◯'} {id}
            </Text>
          )
        })}
        <Text> </Text>
        <Text color={DIM}>{t('install.hint_targets')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'confirm-uninstall') {
    const backup = `${phase.rec.path}.old-<ts>`
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.uninstall_confirm_title', { slug: phase.slug })}</Text>
        <Text color={DIM}>{t('install.uninstall_confirm_path', { path: phase.rec.path })}</Text>
        <Text color={DIM}>{t('install.uninstall_confirm_backup', { backup })}</Text>
        <Text> </Text>
        <Text color={WARNING}>{t('install.uninstall_confirm_prompt')}</Text>
      </Box>
    )
  }

  if (phase.kind === 'executing') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('install.executing')}</Text>
        {phase.progress.map((line, i) => <Text key={i} color={DIM}>  {line}</Text>)}
      </Box>
    )
  }

  if (phase.kind === 'result') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={PRIMARY}>{phase.message}</Text>
        <Text> </Text>
        <Text color={DIM}>{t('install.enter_esc_close')}</Text>
      </Box>
    )
  }

  return null
}
