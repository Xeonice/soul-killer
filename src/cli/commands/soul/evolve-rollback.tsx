import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../i18n/index.js'
import { listSnapshots, restoreSnapshot, type SnapshotInfo } from '../../../soul/snapshot.js'

interface EvolveRollbackCommandProps {
  soulDir: string
  soulName: string
  chunkCount: number
  onComplete: () => void
  onExit: () => void
}

export function EvolveRollbackCommand({ soulDir, soulName, chunkCount, onComplete, onExit }: EvolveRollbackCommandProps) {
  const [snapshots] = useState<SnapshotInfo[]>(() => listSnapshots(soulDir))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useInput((_, key) => {
    if (done) return

    if (key.escape) {
      onExit()
      return
    }

    if (snapshots.length === 0) return

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(snapshots.length - 1, i + 1))
    } else if (key.return) {
      try {
        const snap = snapshots[selectedIndex]!
        restoreSnapshot(soulDir, snap.id, chunkCount)
        setDone(true)
        setTimeout(onComplete, 1500)
      } catch (err) {
        setError(String(err))
      }
    }
  })

  if (error) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT}>✗ Rollback {t('evolve.failed')}</Text>
        <Text color={DIM}>{error}</Text>
      </Box>
    )
  }

  if (done) {
    return (
      <Box paddingLeft={2}>
        <Text color={PRIMARY} bold>✓ Rollback {t('evolve.complete')} — {soulName}</Text>
      </Box>
    )
  }

  if (snapshots.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text color={DIM}>{t('evolve.no_snapshots')}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>ROLLBACK — {soulName}</Text>
      <Text color={DIM}>  {t('evolve.select_snapshot')}</Text>
      {snapshots.map((snap, i) => (
        <Text key={snap.id} color={i === selectedIndex ? PRIMARY : DIM}>
          {i === selectedIndex ? '▸ ' : '  '}
          {snap.meta.timestamp.slice(0, 19)} — {snap.meta.reason} ({snap.meta.chunk_count_at_time} chunks)
        </Text>
      ))}
      <Text color={DIM} dimColor>  ↑↓ Enter · Esc {t('evolve.cancel')}</Text>
    </Box>
  )
}
