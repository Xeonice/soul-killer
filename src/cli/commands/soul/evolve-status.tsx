import React from 'react'
import { Text, Box } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import { readManifest } from '../../../soul/package.js'
import { listSnapshots } from '../../../soul/snapshot.js'
import type { SoulChunk } from '../../../infra/ingest/types.js'

interface EvolveStatusCommandProps {
  soulDir: string
  soulName: string
}

export function EvolveStatusCommand({ soulDir, soulName }: EvolveStatusCommandProps) {
  const manifest = readManifest(soulDir)
  const snapshots = listSnapshots(soulDir)

  // Load chunks for source breakdown
  const chunksPath = path.join(soulDir, 'chunks.json')
  let chunks: SoulChunk[] = []
  if (fs.existsSync(chunksPath)) {
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'))
    } catch { /* empty */ }
  }

  // Source breakdown
  const sourceCount: Record<string, number> = {}
  for (const chunk of chunks) {
    sourceCount[chunk.source] = (sourceCount[chunk.source] ?? 0) + 1
  }

  // Temporal distribution
  const temporalCount = { exact: 0, inferred: 0, unknown: 0, none: 0 }
  for (const chunk of chunks) {
    if (chunk.temporal) {
      temporalCount[chunk.temporal.confidence]++
    } else {
      temporalCount.none++
    }
  }

  const evolveHistory = manifest?.evolve_history ?? []
  const lastEvolve = evolveHistory.length > 0 ? evolveHistory[evolveHistory.length - 1] : null

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>EVOLVE STATUS — {soulName}</Text>

      <Text color={PRIMARY}>  {t('evolve.total_chunks')}: {chunks.length}</Text>

      {Object.entries(sourceCount).length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {Object.entries(sourceCount).map(([source, count]) => (
            <Text key={source} color={DIM}>  {source}: {count}</Text>
          ))}
        </Box>
      )}

      <Text color={DIM}>  {t('evolve.temporal_dist')}: exact={temporalCount.exact} inferred={temporalCount.inferred} unknown={temporalCount.unknown + temporalCount.none}</Text>

      <Text color={DIM}>  {t('evolve.evolve_sessions')}: {evolveHistory.length}</Text>
      {lastEvolve && (
        <Text color={DIM}>  {t('evolve.last_evolve')}: {lastEvolve.timestamp.slice(0, 10)} ({lastEvolve.mode})</Text>
      )}

      <Text color={DIM}>  {t('evolve.snapshots')}: {snapshots.length}</Text>

      {manifest?.created_at && (
        <Text color={DIM}>  {t('evolve.created_at')}: {manifest.created_at.slice(0, 10)}</Text>
      )}
    </Box>
  )
}
