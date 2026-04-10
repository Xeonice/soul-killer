import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CreateCommand } from './create.js'
import { PRIMARY, ACCENT, DIM, DARK, WARNING } from '../../animation/colors.js'
import { ScrollableList } from '../../components/scrollable-list.js'
import { t } from '../../../i18n/index.js'
import type { SoulManifest } from '../../../soul/manifest.js'
import { readManifest } from '../../../soul/package.js'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

type ListPhase = 'soul-list' | 'action-menu' | 'action-running' | 'confirm-delete' | 'show-detail'

type SoulAction = 'show' | 'use' | 'evolve' | 'delete'

interface SoulEntry {
  name: string
  dir: string
  manifest: SoulManifest | null
}

const ACTION_ITEMS: { action: SoulAction; labelKey: string; descKey: string }[] = [
  { action: 'show', labelKey: 'soul.action.show', descKey: 'soul.action.show_desc' },
  { action: 'use', labelKey: 'soul.action.use', descKey: 'soul.action.use_desc' },
  { action: 'evolve', labelKey: 'soul.action.evolve', descKey: 'soul.action.evolve_desc' },
  { action: 'delete', labelKey: 'soul.action.delete', descKey: 'soul.action.delete_desc' },
]

interface ListCommandProps {
  onUse: (soulName: string, soulDir: string) => void
  onClose: () => void
}

function loadSouls(): SoulEntry[] {
  if (!fs.existsSync(SOULS_DIR)) return []
  return fs.readdirSync(SOULS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(SOULS_DIR, d.name)
      return { name: d.name, dir, manifest: readManifest(dir) }
    })
}

export function ListCommand({ onUse, onClose }: ListCommandProps) {
  const [phase, setPhase] = useState<ListPhase>('soul-list')
  const [souls, setSouls] = useState<SoulEntry[]>(() => loadSouls())
  const [soulCursor, setSoulCursor] = useState(0)
  const [actionCursor, setActionCursor] = useState(0)
  const [selected, setSelected] = useState<SoulEntry | null>(null)
  const [confirmCursor, setConfirmCursor] = useState(0)

  useInput((_input, key) => {
    if (phase === 'soul-list') {
      if (key.upArrow && souls.length > 0) setSoulCursor((c) => (c - 1 + souls.length) % souls.length)
      if (key.downArrow && souls.length > 0) setSoulCursor((c) => (c + 1) % souls.length)
      if (key.escape) { onClose(); return }
      if (key.return && souls.length > 0) {
        setSelected(souls[soulCursor]!)
        setActionCursor(0)
        setPhase('action-menu')
      }
      return
    }

    if (phase === 'action-menu') {
      if (key.upArrow) setActionCursor((c) => (c - 1 + ACTION_ITEMS.length) % ACTION_ITEMS.length)
      if (key.downArrow) setActionCursor((c) => (c + 1) % ACTION_ITEMS.length)
      if (key.escape) { setPhase('soul-list'); return }
      if (key.return && selected) {
        const action = ACTION_ITEMS[actionCursor]!.action
        if (action === 'show') {
          setPhase('show-detail')
        } else if (action === 'use') {
          onUse(selected.name, selected.dir)
        } else if (action === 'evolve') {
          setPhase('action-running')
        } else if (action === 'delete') {
          setConfirmCursor(0)
          setPhase('confirm-delete')
        }
      }
      return
    }

    if (phase === 'show-detail') {
      if (key.escape || key.return) { setPhase('action-menu'); return }
      return
    }

    if (phase === 'confirm-delete') {
      if (key.upArrow || key.downArrow) setConfirmCursor((c) => (c + 1) % 2)
      if (key.escape) { setPhase('action-menu'); return }
      if (key.return) {
        if (confirmCursor === 0 && selected) {
          // Confirm delete
          fs.rmSync(selected.dir, { recursive: true })
          setSelected(null)
          setSouls(loadSouls())
          setSoulCursor(0)
          setPhase('soul-list')
        } else {
          setPhase('action-menu')
        }
      }
      return
    }

    // action-running: ESC returns to action menu
    if (phase === 'action-running' && key.escape) {
      setPhase('action-menu')
    }
  })

  // ─── Phase: action-running (evolve) ───
  if (phase === 'action-running' && selected) {
    return (
      <CreateCommand
        supplementSoul={{ name: selected.name, dir: selected.dir }}
        onComplete={() => { setPhase('action-menu') }}
        onCancel={() => { setPhase('action-menu') }}
      />
    )
  }

  // ─── Phase: show-detail ───
  if (phase === 'show-detail' && selected) {
    const m = selected.manifest
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{selected.name}</Text>
        {m ? (
          <>
            <Text color={DIM}>  {t('soul.detail.display_name')}: {m.display_name}</Text>
            <Text color={DIM}>  {t('soul.detail.type')}: {m.soulType}</Text>
            <Text color={DIM}>  {t('soul.detail.description')}: {m.description}</Text>
            <Text color={DIM}>  {t('soul.detail.chunks')}: {m.chunk_count}</Text>
            <Text color={DIM}>  {t('soul.detail.version')}: {m.version}</Text>
            {m.evolve_history && m.evolve_history.length > 0 && (
              <Text color={DIM}>  {t('soul.detail.evolve_count')}: {m.evolve_history.length}</Text>
            )}
          </>
        ) : (
          <Text color={DIM}>  no manifest</Text>
        )}
        <Text> </Text>
        <Text color={DIM}>  {t('world.nav.back')}</Text>
      </Box>
    )
  }

  // ─── Phase: confirm-delete ───
  if (phase === 'confirm-delete' && selected) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={WARNING} bold>⚠ {t('soul.delete.confirm_title', { name: selected.name })}</Text>
        {selected.manifest && (
          <Text color={DIM}>  {selected.manifest.chunk_count} chunks</Text>
        )}
        <Text> </Text>
        {[t('soul.delete.yes'), t('soul.delete.no')].map((label, i) => (
          <Text key={i}>
            <Text color={i === confirmCursor ? ACCENT : DIM}>{i === confirmCursor ? '  ❯ ' : '    '}</Text>
            <Text color={i === confirmCursor ? (i === 0 ? WARNING : PRIMARY) : DIM}>{label}</Text>
          </Text>
        ))}
      </Box>
    )
  }

  // ─── Phase: soul-list ───
  if (phase === 'soul-list') {
    return (
      <ScrollableList
        items={souls}
        cursor={soulCursor}
        title={t('list.title')}
        hint={t('world.menu.hint')}
        emptyMessage={t('list.empty')}
        renderItem={(s, i, focused) => (
          <Text key={s.name}>
            <Text color={focused ? ACCENT : DIM}>{focused ? '  ❯ ' : '    '}</Text>
            <Text color={focused ? PRIMARY : DIM} bold={focused}>
              {s.name.padEnd(20)}
            </Text>
            <Text color={DIM}>
              {s.manifest ? `${s.manifest.chunk_count} chunks` : 'no manifest'}
            </Text>
          </Text>
        )}
      />
    )
  }

  // ─── Phase: action-menu ───
  if (phase === 'action-menu' && selected) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{selected.name}{selected.manifest ? ` — ${selected.manifest.display_name}` : ''}</Text>
        <Text color={DIM}>  {t('world.menu.hint')}</Text>
        <Text> </Text>
        {ACTION_ITEMS.map((item, i) => (
          <Text key={item.action}>
            <Text color={i === actionCursor ? ACCENT : DIM}>{i === actionCursor ? '  ❯ ' : '    '}</Text>
            <Text color={i === actionCursor ? PRIMARY : DIM} bold={i === actionCursor}>
              {t(item.labelKey).padEnd(12)}
            </Text>
            <Text color={DIM}>{t(item.descKey)}</Text>
          </Text>
        ))}
      </Box>
    )
  }

  return null
}
