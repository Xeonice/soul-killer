import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { bindWorld, unbindWorld, findSoulsBoundToWorld } from '../../../world/binding.js'
import { listLocalSouls, getSoulsDir } from '../../soul-resolver.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { t } from '../../../i18n/index.js'
import path from 'node:path'

interface WorldBindProps {
  worldName: string
  onComplete: () => void
}

interface SoulItem {
  name: string
  description: string
  checked: boolean
  wasBound: boolean
}

type BindPhase = 'select' | 'done' | 'empty'

export function WorldBindCommand({ worldName, onComplete }: WorldBindProps) {
  const [phase, setPhase] = useState<BindPhase>(() => {
    const souls = listLocalSouls()
    if (souls.length === 0) return 'empty'
    return 'select'
  })

  const [items, setItems] = useState<SoulItem[]>(() => {
    const souls = listLocalSouls()
    const boundSouls = new Set(findSoulsBoundToWorld(worldName))
    return souls.map((s) => ({
      name: s.name,
      description: s.description || `${s.chunkCount} chunks`,
      checked: boundSouls.has(s.name),
      wasBound: boundSouls.has(s.name),
    }))
  })

  const [cursor, setCursor] = useState(0)
  const [summary, setSummary] = useState<{ bound: string[]; unbound: string[] }>({ bound: [], unbound: [] })

  const handleConfirm = useCallback(() => {
    const soulsDir = getSoulsDir()
    const bound: string[] = []
    const unbound: string[] = []

    for (const item of items) {
      const soulDir = path.join(soulsDir, item.name)
      if (item.checked && !item.wasBound) {
        bindWorld(soulDir, worldName, { order: 0 })
        bound.push(item.name)
      } else if (!item.checked && item.wasBound) {
        unbindWorld(soulDir, worldName)
        unbound.push(item.name)
      }
    }

    setSummary({ bound, unbound })
    setPhase('done')
  }, [items, worldName])

  useInput((_input, key) => {
    if (phase !== 'select') return

    if (key.upArrow) {
      setCursor((c) => (c - 1 + items.length) % items.length)
    } else if (key.downArrow) {
      setCursor((c) => (c + 1) % items.length)
    } else if (_input === ' ') {
      setItems((prev) => prev.map((item, i) =>
        i === cursor ? { ...item, checked: !item.checked } : item,
      ))
    } else if (key.return) {
      handleConfirm()
    } else if (key.escape) {
      onComplete()
    }
  }, { isActive: phase === 'select' })

  if (phase === 'empty') {
    setTimeout(onComplete, 100)
    return <Text color={WARNING}>{t('world.bind.no_souls')}</Text>
  }

  if (phase === 'done') {
    const hasChanges = summary.bound.length > 0 || summary.unbound.length > 0

    setTimeout(onComplete, 100)

    if (!hasChanges) {
      return <Text color={DIM}>{t('world.bind.no_changes')}</Text>
    }

    return (
      <Box flexDirection="column">
        {summary.bound.length > 0 && (
          <Text color={PRIMARY}>
            {t('world.bind.summary_bound', { names: summary.bound.join(', ') })}
          </Text>
        )}
        {summary.unbound.length > 0 && (
          <Text color={WARNING}>
            {t('world.bind.summary_unbound', { names: summary.unbound.join(', ') })}
          </Text>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>{t('world.bind.title', { name: worldName })}</Text>
      <Text color={DIM}>  {t('world.bind.hint')}</Text>
      <Text> </Text>
      {items.map((item, i) => {
        const isSelected = i === cursor
        const checkbox = item.checked ? '☑' : '☐'
        const changed = item.checked !== item.wasBound
        return (
          <Text key={item.name}>
            <Text color={isSelected ? ACCENT : DIM}>{isSelected ? '  ❯ ' : '    '}</Text>
            <Text color={item.checked ? PRIMARY : DIM}>{checkbox} </Text>
            <Text color={isSelected ? PRIMARY : DIM} bold={isSelected}>
              {item.name}
            </Text>
            <Text color={DIM}> {item.description}</Text>
            {changed && <Text color={WARNING}> *</Text>}
          </Text>
        )
      })}
    </Box>
  )
}
