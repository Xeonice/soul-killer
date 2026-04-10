import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import { WorldCreateWizard } from './world-create-wizard.js'
import { WorldEntryCommand } from './world-entry.js'
import { WorldBindCommand } from './world-bind.js'
import { WorldShowCommand } from './world-list.js'
import { listWorlds, deleteWorld, type WorldManifest } from '../../../world/manifest.js'
import { PRIMARY, ACCENT, DIM, DARK, WARNING } from '../../animation/colors.js'
import { ScrollableList } from '../../components/scrollable-list.js'
import { t } from '../../../i18n/index.js'

type WorldPhase =
  | 'top-menu'
  | 'create'
  | 'world-list'
  | 'action-menu'
  | 'action-running'
  | 'confirm-delete'

type WorldAction = 'show' | 'entry' | 'distill' | 'bind' | 'unbind' | 'delete'

interface ActionItem {
  action: WorldAction
  labelKey: string
  descKey: string
  needsSoul?: boolean
}

const ACTION_ITEMS: ActionItem[] = [
  { action: 'show', labelKey: 'world.menu.show', descKey: 'world.menu.show_desc' },
  { action: 'entry', labelKey: 'world.menu.entry', descKey: 'world.menu.entry_desc' },
  { action: 'distill', labelKey: 'world.menu.distill', descKey: 'world.menu.distill_merged_desc' },
  { action: 'bind', labelKey: 'world.menu.bind', descKey: 'world.menu.bind_desc' },
  { action: 'delete', labelKey: 'world.menu.delete', descKey: 'world.menu.delete_desc' },
]

interface WorldCommandProps {
  soulDir?: string
  onClose: () => void
}

export function WorldCommand({ soulDir, onClose }: WorldCommandProps) {
  const [phase, setPhase] = useState<WorldPhase>('top-menu')
  const [topCursor, setTopCursor] = useState(0)
  const [worldCursor, setWorldCursor] = useState(0)
  const [actionCursor, setActionCursor] = useState(0)
  const [selectedWorld, setSelectedWorld] = useState<WorldManifest | null>(null)
  const [currentAction, setCurrentAction] = useState<WorldAction | null>(null)
  const [confirmCursor, setConfirmCursor] = useState(0)

  const [worlds, setWorlds] = useState(() => listWorlds())
  const hasWorlds = worlds.length > 0

  // Top menu: 2 items (创建 + 管理)
  const topItems = [
    { label: t('world.menu.create'), desc: t('world.menu.create_desc'), disabled: false },
    { label: t('world.menu.manage'), desc: t('world.menu.manage_desc'), disabled: !hasWorlds },
  ]

  useInput((_input, key) => {
    if (phase === 'top-menu') {
      if (key.upArrow) setTopCursor((c) => (c - 1 + topItems.length) % topItems.length)
      if (key.downArrow) setTopCursor((c) => (c + 1) % topItems.length)
      if (key.escape) { onClose(); return }
      if (key.return) {
        if (topCursor === 0) {
          setPhase('create')
        } else if (topCursor === 1 && hasWorlds) {
          setPhase('world-list')
          setWorldCursor(0)
        }
      }
      return
    }

    if (phase === 'world-list') {
      if (key.upArrow) setWorldCursor((c) => (c - 1 + worlds.length) % worlds.length)
      if (key.downArrow) setWorldCursor((c) => (c + 1) % worlds.length)
      if (key.escape) { setPhase('top-menu'); return }
      if (key.return && worlds.length > 0) {
        setSelectedWorld(worlds[worldCursor]!)
        setActionCursor(0)
        setPhase('action-menu')
      }
      return
    }

    if (phase === 'action-menu') {
      if (key.upArrow) setActionCursor((c) => (c - 1 + ACTION_ITEMS.length) % ACTION_ITEMS.length)
      if (key.downArrow) setActionCursor((c) => (c + 1) % ACTION_ITEMS.length)
      if (key.escape) { setPhase('world-list'); return }
      if (key.return) {
        const item = ACTION_ITEMS[actionCursor]!
        if (item.needsSoul && !soulDir) return
        if (item.action === 'delete') {
          setConfirmCursor(0)
          setPhase('confirm-delete')
        } else {
          setCurrentAction(item.action)
          setPhase('action-running')
        }
      }
      return
    }

    if (phase === 'confirm-delete') {
      if (key.upArrow || key.downArrow) setConfirmCursor((c) => (c + 1) % 2)
      if (key.escape) { setPhase('action-menu'); return }
      if (key.return) {
        if (confirmCursor === 0 && selectedWorld) {
          deleteWorld(selectedWorld.name)
          setSelectedWorld(null)
          setWorlds(listWorlds())
          setWorldCursor(0)
          setPhase(listWorlds().length > 0 ? 'world-list' : 'top-menu')
        } else {
          setPhase('action-menu')
        }
      }
      return
    }

    // action-running: ESC handled by sub-components via onComplete
    if (phase === 'action-running' && key.escape) {
      backToActionMenu()
      return
    }
  })

  function backToTopMenu() {
    setWorlds(listWorlds())
    setPhase('top-menu')
    setSelectedWorld(null)
    setCurrentAction(null)
  }

  function backToActionMenu() {
    setPhase('action-menu')
    setCurrentAction(null)
  }

  // ─── Phase: Create ───
  if (phase === 'create') {
    return <WorldCreateWizard soulDir={soulDir} onComplete={backToTopMenu} onCancel={backToTopMenu} />
  }

  // ─── Phase: Action running ───
  if (phase === 'action-running' && selectedWorld && currentAction) {
    const wn = selectedWorld.name

    if (currentAction === 'show') {
      return (
        <Box flexDirection="column">
          <WorldShowCommand worldName={wn} />
          <Text color={DIM} dimColor>{'\n'}{t('world.nav.back')}</Text>
        </Box>
      )
    }

    if (currentAction === 'entry') {
      return <WorldEntryCommand worldName={wn} onComplete={backToActionMenu} />
    }

    if (currentAction === 'distill') {
      return <WorldCreateWizard supplementWorld={wn} soulDir={soulDir} onComplete={backToActionMenu} onCancel={backToActionMenu} />
    }

    if (currentAction === 'bind') {
      return <WorldBindCommand worldName={wn} onComplete={backToActionMenu} />
    }
  }

  // ─── Phase: Confirm delete ───
  if (phase === 'confirm-delete' && selectedWorld) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={WARNING} bold>⚠ {t('world.delete.confirm_title', { name: selectedWorld.name })}</Text>
        <Text color={DIM}>  {selectedWorld.entry_count} entries</Text>
        <Text> </Text>
        {[t('world.delete.yes'), t('world.delete.no')].map((label, i) => (
          <Text key={i}>
            <Text color={i === confirmCursor ? ACCENT : DIM}>{i === confirmCursor ? '  ❯ ' : '    '}</Text>
            <Text color={i === confirmCursor ? (i === 0 ? WARNING : PRIMARY) : DIM}>{label}</Text>
          </Text>
        ))}
      </Box>
    )
  }

  // ─── Phase: Top menu ───
  if (phase === 'top-menu') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('world.menu.title')}</Text>
        <Text color={DIM}>  {t('world.menu.hint')}</Text>
        <Text> </Text>
        {topItems.map((item, i) => {
          const isSelected = i === topCursor
          return (
            <Text key={i}>
              <Text color={isSelected ? ACCENT : DIM}>{isSelected ? '  ❯ ' : '    '}</Text>
              <Text color={item.disabled ? DARK : isSelected ? PRIMARY : DIM} bold={isSelected} dimColor={item.disabled}>
                {item.label.padEnd(12)}
              </Text>
              <Text color={DIM}>{item.desc}</Text>
              {item.disabled && <Text color={DARK}> ({t('world.menu.no_worlds')})</Text>}
            </Text>
          )
        })}
      </Box>
    )
  }

  // ─── Phase: World list ───
  if (phase === 'world-list') {
    return (
      <ScrollableList
        items={worlds}
        cursor={worldCursor}
        title={t('world.collect.select_world')}
        hint={t('world.collect.select_hint')}
        renderItem={(w, i, focused) => (
          <Text key={w.name}>
            <Text color={focused ? ACCENT : DIM}>
              {focused ? '  ❯ ' : '    '}
            </Text>
            <Text color={focused ? PRIMARY : DIM} bold={focused}>
              {w.name}
            </Text>
            <Text color={DIM}> {w.display_name} ({w.entry_count} entries)</Text>
          </Text>
        )}
      />
    )
  }

  // ─── Phase: Action menu ───
  if (phase === 'action-menu' && selectedWorld) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{selectedWorld.name} — {selectedWorld.display_name}</Text>
        <Text color={DIM}>  {t('world.menu.hint')}</Text>
        <Text> </Text>
        {ACTION_ITEMS.map((item, i) => {
          const isSelected = i === actionCursor
          const disabled = item.needsSoul && !soulDir
          return (
            <Text key={item.action}>
              <Text color={isSelected ? ACCENT : DIM}>{isSelected ? '  ❯ ' : '    '}</Text>
              <Text color={disabled ? DARK : isSelected ? PRIMARY : DIM} bold={isSelected} dimColor={disabled}>
                {t(item.labelKey).padEnd(12)}
              </Text>
              <Text color={DIM}>{t(item.descKey)}</Text>
              {disabled && <Text color={DARK}> ({t('world.menu.need_soul')})</Text>}
            </Text>
          )
        })}
      </Box>
    )
  }

  return null
}
