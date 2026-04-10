import React from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import type { EngineStatus } from '../../../engine/adapter.js'

interface StatusCommandProps {
  soulName?: string
  engineStatus?: EngineStatus
}

export function StatusCommand({ soulName, engineStatus }: StatusCommandProps) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>SOULKILLER STATUS</Text>
      <Text> </Text>
      <Text color={PRIMARY}>  soul:        <Text color={soulName ? PRIMARY : DIM}>{soulName ?? 'none'}</Text></Text>
      <Text color={PRIMARY}>  engine:      <Text color={DIM}>{engineStatus?.mode ?? 'unknown'}</Text></Text>
      <Text color={PRIMARY}>  chunks:      <Text color={DIM}>{engineStatus?.chunkCount ?? 0}</Text></Text>
      {engineStatus?.indexSize !== undefined && (
        <Text color={PRIMARY}>  index size:  <Text color={DIM}>{formatBytes(engineStatus.indexSize)}</Text></Text>
      )}
      <Text color={PRIMARY}>  health:      <Text color={engineStatus?.healthy ? PRIMARY : WARNING}>{engineStatus?.healthy ? '✓ online' : '✗ offline'}</Text></Text>
    </Box>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
