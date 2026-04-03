import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

export interface RecallResult {
  path: string
  similarity: number
}

interface SoulRecallPanelProps {
  results: RecallResult[]
  retrievalTimeMs: number
  /** Auto-collapse after this many ms (0 = never) */
  autoCollapseMs?: number
  onCollapse?: () => void
}

export function SoulRecallPanel({
  results,
  retrievalTimeMs,
  autoCollapseMs = 2000,
  onCollapse,
}: SoulRecallPanelProps) {
  const animationEnabled = isAnimationEnabled()
  const [visible, setVisible] = useState(true)
  const [revealedCount, setRevealedCount] = useState(animationEnabled ? 0 : results.length)

  // Progressively reveal results
  useEffect(() => {
    if (!animationEnabled || revealedCount >= results.length) return
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1)
    }, 150)
    return () => clearTimeout(timer)
  }, [animationEnabled, revealedCount, results.length])

  // Auto-collapse
  useEffect(() => {
    if (autoCollapseMs <= 0 || revealedCount < results.length) return
    const timer = setTimeout(() => {
      setVisible(false)
      onCollapse?.()
    }, autoCollapseMs)
    return () => clearTimeout(timer)
  }, [autoCollapseMs, revealedCount, results.length, onCollapse])

  if (!visible) return null

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={PRIMARY}
      paddingX={1}
      width={50}
    >
      <Text color={ACCENT} bold> SOUL_RECALL </Text>
      <Text> </Text>
      <Text color={DIM}>  scanning memory cortex...</Text>
      <Text> </Text>
      {results.slice(0, revealedCount).map((result, i) => (
        <Box key={i} flexDirection="column">
          <Text>
            <Text color={PRIMARY}>  ▸ </Text>
            <Text color={DIM}>{result.path}</Text>
          </Text>
          <Text>
            <Text color={PRIMARY}>    {simBar(result.similarity)}</Text>
            <Text color={DIM}> sim: {result.similarity.toFixed(2)}</Text>
          </Text>
        </Box>
      ))}
      {revealedCount >= results.length && (
        <>
          <Text> </Text>
          <Text color={DIM}>
            {'  '}{results.length} memories loaded · {retrievalTimeMs}ms
          </Text>
        </>
      )}
    </Box>
  )
}

function simBar(similarity: number): string {
  const width = 26
  const filled = Math.floor(similarity * width)
  return '░'.repeat(filled) + ' '.repeat(width - filled)
}
