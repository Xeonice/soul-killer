import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import { WorldCreateWizard } from './world-create-wizard.js'
import { WorldEntryCommand } from './world-entry.js'
import { WorldBindCommand } from './world-bind.js'
import { WorldListCommand, WorldShowCommand } from './world-list.js'
import { WorldDistillCommand, WorldEvolveCommand } from './world-distill.js'
import { listWorlds } from '../../world/manifest.js'
import { TextInput } from '../components/text-input.js'
import type { AdapterType } from '../../ingest/pipeline.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'

type SubAction =
  | 'menu'
  | 'create'
  | 'entry'
  | 'bind'
  | 'unbind'
  | 'list'
  | 'show'
  | 'distill'
  | 'evolve'

// Intermediate collection steps
type CollectStep =
  | 'none'
  | 'collect-name'         // world name for create
  | 'collect-world-select' // select existing world
  | 'collect-source-path'  // source path for distill/evolve
  | 'collect-adapter'      // adapter type for distill/evolve

interface MenuItem {
  action: SubAction
  labelKey: string
  descKey: string
  needsSoul?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { action: 'create', labelKey: 'world.menu.create', descKey: 'world.menu.create_desc' },
  { action: 'list', labelKey: 'world.menu.list', descKey: 'world.menu.list_desc' },
  { action: 'show', labelKey: 'world.menu.show', descKey: 'world.menu.show_desc' },
  { action: 'entry', labelKey: 'world.menu.entry', descKey: 'world.menu.entry_desc' },
  { action: 'bind', labelKey: 'world.menu.bind', descKey: 'world.menu.bind_desc', needsSoul: true },
  { action: 'unbind', labelKey: 'world.menu.unbind', descKey: 'world.menu.unbind_desc', needsSoul: true },
  { action: 'distill', labelKey: 'world.menu.distill', descKey: 'world.menu.distill_desc' },
  { action: 'evolve', labelKey: 'world.menu.evolve', descKey: 'world.menu.evolve_desc' },
]

interface WorldCommandProps {
  soulDir?: string
  onClose: () => void
}

export function WorldCommand({ soulDir, onClose }: WorldCommandProps) {
  const [cursor, setCursor] = useState(0)
  const [action, setAction] = useState<SubAction>('menu')
  const [collectStep, setCollectStep] = useState<CollectStep>('none')

  // Collected params
  const [worldName, setWorldName] = useState('')
  const [sourcePath, setSourcePath] = useState('')
  const [adapterType, setAdapterType] = useState<AdapterType>('markdown')
  const [worldSelectCursor, setWorldSelectCursor] = useState(0)

  const worlds = listWorlds()

  useInput((input, key) => {
    // ESC from any sub-action returns to menu
    if (action !== 'menu' && key.escape) {
      backToMenu()
      return
    }
    if (action !== 'menu') return
    if (collectStep !== 'none' && collectStep !== 'collect-world-select') return

    if (collectStep === 'collect-world-select') {
      if (key.upArrow && worlds.length > 0) {
        setWorldSelectCursor((c) => (c - 1 + worlds.length) % worlds.length)
        return
      }
      if (key.downArrow && worlds.length > 0) {
        setWorldSelectCursor((c) => (c + 1) % worlds.length)
        return
      }
      if (key.escape) {
        setCollectStep('none')
        return
      }
      if (key.return && worlds.length > 0) {
        const selected = worlds[worldSelectCursor]!
        handleWorldSelected(selected.name)
        return
      }
      return
    }

    if (key.upArrow) {
      setCursor((c) => (c - 1 + MENU_ITEMS.length) % MENU_ITEMS.length)
      return
    }
    if (key.downArrow) {
      setCursor((c) => (c + 1) % MENU_ITEMS.length)
      return
    }
    if (key.escape) {
      onClose()
      return
    }
    if (key.return) {
      const item = MENU_ITEMS[cursor]!
      if (item.needsSoul && !soulDir) {
        // Can't proceed without a loaded soul
        return
      }
      handleMenuSelect(item.action)
      return
    }
  })

  function handleMenuSelect(selectedAction: SubAction) {
    switch (selectedAction) {
      case 'list':
        setAction('list')
        break
      case 'create':
        setAction('create')
        break
      case 'show':
      case 'entry':
      case 'bind':
      case 'unbind':
        if (worlds.length === 0) {
          // No worlds to select from
          return
        }
        setAction(selectedAction)
        setCollectStep('collect-world-select')
        break
      case 'distill':
      case 'evolve':
        if (worlds.length === 0 && selectedAction === 'evolve') return
        if (selectedAction === 'distill') {
          setAction(selectedAction)
          setCollectStep('collect-name')
        } else {
          setAction(selectedAction)
          setCollectStep('collect-world-select')
        }
        break
    }
  }

  function handleWorldSelected(name: string) {
    setWorldName(name)
    const currentAction = action

    if (currentAction === 'show') {
      setCollectStep('none')
      // show is rendered directly
    } else if (currentAction === 'entry') {
      setCollectStep('none')
    } else if (currentAction === 'bind' || currentAction === 'unbind') {
      setCollectStep('none')
    } else if (currentAction === 'evolve') {
      setCollectStep('collect-source-path')
    } else {
      setCollectStep('none')
    }
  }

  function handleNameCollected(name: string) {
    setWorldName(name)
    if (action === 'distill') {
      setCollectStep('collect-source-path')
    } else {
      setCollectStep('none')
    }
  }

  function handleSourcePathCollected(p: string) {
    setSourcePath(p)
    setCollectStep('none')
  }

  function backToMenu() {
    setAction('menu')
    setCollectStep('none')
    setWorldName('')
    setSourcePath('')
  }

  // ─── Render: Collecting params ───

  if (action === 'create') {
    return <WorldCreateWizard onComplete={backToMenu} onCancel={backToMenu} />
  }

  if (action === 'distill' && collectStep === 'collect-name') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('world.menu.distill')}</Text>
        <Box>
          <Text color={DIM}>{t('world.collect.name')}: </Text>
          <TextInput onSubmit={handleNameCollected} />
        </Box>
      </Box>
    )
  }

  if (collectStep === 'collect-world-select') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('world.collect.select_world')}</Text>
        <Text color={DIM}>  {t('world.collect.select_hint')}</Text>
        <Text> </Text>
        {worlds.map((w, i) => (
          <Text key={w.name}>
            <Text color={i === worldSelectCursor ? ACCENT : DIM}>
              {i === worldSelectCursor ? '  ❯ ' : '    '}
            </Text>
            <Text color={i === worldSelectCursor ? PRIMARY : DIM} bold={i === worldSelectCursor}>
              {w.name}
            </Text>
            <Text color={DIM}> ({w.display_name})</Text>
          </Text>
        ))}
      </Box>
    )
  }

  if ((action === 'distill' || action === 'evolve') && collectStep === 'collect-source-path') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{action === 'distill' ? t('world.menu.distill') : t('world.menu.evolve')}</Text>
        <Text color={DIM}>  {t('world.collect.world')}: {worldName}</Text>
        <Box>
          <Text color={DIM}>{t('world.collect.source_path')}: </Text>
          <TextInput pathCompletion onSubmit={handleSourcePathCollected} />
        </Box>
      </Box>
    )
  }

  // ─── Render: Sub-actions ───

  if (action === 'list') {
    return (
      <Box flexDirection="column">
        <WorldListCommand />
        <Text color={DIM} dimColor>{'\n'}{t('world.nav.back')}</Text>
      </Box>
    )
  }

  if (action === 'show' && worldName && collectStep === 'none') {
    return (
      <Box flexDirection="column">
        <WorldShowCommand worldName={worldName} />
        <Text color={DIM} dimColor>{'\n'}{t('world.nav.back')}</Text>
      </Box>
    )
  }

  // create is handled above via WorldCreateWizard

  if (action === 'entry' && worldName && collectStep === 'none') {
    return <WorldEntryCommand worldName={worldName} onComplete={backToMenu} />
  }

  if ((action === 'bind' || action === 'unbind') && worldName && soulDir && collectStep === 'none') {
    return <WorldBindCommand worldName={worldName} soulDir={soulDir} action={action} onComplete={backToMenu} />
  }

  if (action === 'distill' && worldName && sourcePath && collectStep === 'none') {
    return <WorldDistillCommand worldName={worldName} sourcePath={sourcePath} adapterType={adapterType} onComplete={backToMenu} />
  }

  if (action === 'evolve' && worldName && sourcePath && collectStep === 'none') {
    return <WorldEvolveCommand worldName={worldName} sourcePath={sourcePath} adapterType={adapterType} onComplete={backToMenu} />
  }

  // ─── Render: Main menu ───

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>{t('world.menu.title')}</Text>
      <Text color={DIM}>  {t('world.menu.hint')}</Text>
      <Text> </Text>

      {MENU_ITEMS.map((item, i) => {
        const isSelected = i === cursor
        const disabled = item.needsSoul && !soulDir

        return (
          <Text key={item.action}>
            <Text color={isSelected ? ACCENT : DIM}>
              {isSelected ? '  ❯ ' : '    '}
            </Text>
            <Text color={disabled ? DIM : isSelected ? PRIMARY : DIM} bold={isSelected} dimColor={disabled}>
              {t(item.labelKey).padEnd(12)}
            </Text>
            <Text color={DIM}>{t(item.descKey)}</Text>
            {disabled && <Text color={DIM}> (需先 /use 加载分身)</Text>}
          </Text>
        )
      })}
    </Box>
  )
}
