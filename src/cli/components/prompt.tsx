import React from 'react'
import { Text } from 'ink'
import { PRIMARY, ACCENT, DIM, DARK } from '../animation/colors.js'

export type PromptMode = 'void' | 'loaded' | 'relic'
export type PromptStatus = 'idle' | 'recall' | 'streaming' | 'malfunction'

interface SoulPromptProps {
  mode: PromptMode
  soulName?: string
  status?: PromptStatus
  recallProgress?: number
  streamProgress?: number
}

export function SoulPrompt({
  mode,
  soulName,
  status = 'idle',
  recallProgress,
  streamProgress,
}: SoulPromptProps) {
  const name = mode === 'void' ? 'void' : soulName ?? 'unknown'
  const statusColor = status === 'malfunction' ? DARK : status === 'recall' ? ACCENT : PRIMARY

  return (
    <Text>
      <Text color={PRIMARY}>◈ </Text>
      <Text color={PRIMARY}>soul://</Text>
      <Text color={mode === 'relic' ? ACCENT : PRIMARY}>{name}</Text>
      {mode === 'relic' && status === 'idle' && (
        <Text color={DIM}> [RELIC]</Text>
      )}
      {status === 'recall' && (
        <Text color={DIM}> [{progressChars(recallProgress ?? 0)} RECALL]</Text>
      )}
      {status === 'streaming' && (
        <Text color={DIM}> [{progressChars(streamProgress ?? 0)} STREAMING]</Text>
      )}
      {status === 'malfunction' && (
        <Text color={DARK}> [!MALFUNCTION]</Text>
      )}
      <Text color={statusColor}> &gt; </Text>
    </Text>
  )
}

function progressChars(progress: number): string {
  const filled = Math.floor(progress * 4)
  return '▓'.repeat(filled) + '░'.repeat(4 - filled)
}
