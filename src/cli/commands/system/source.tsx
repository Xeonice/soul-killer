import React from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, DIM } from '../../animation/colors.js'
import { t } from '../../../i18n/index.js'
import type { RecallResult } from '../../../engine/adapter.js'

interface SourceCommandProps {
  lastRecallResults: RecallResult[]
}

export function SourceCommand({ lastRecallResults }: SourceCommandProps) {
  if (lastRecallResults.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text color={DIM}>{t('source.no_records')}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={PRIMARY} bold>{t('source.title')}</Text>
      <Text> </Text>
      {lastRecallResults.map((r, i) => (
        <Box key={r.chunk.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color={PRIMARY}>  [{i + 1}] </Text>
            <Text color={DIM}>{r.chunk.source}:{r.chunk.type}</Text>
            <Text color={PRIMARY}> — {(r.similarity * 100).toFixed(1)}%</Text>
          </Text>
          <Text color={DIM}>      {r.chunk.content.slice(0, 120)}{r.chunk.content.length > 120 ? '...' : ''}</Text>
        </Box>
      ))}
    </Box>
  )
}
