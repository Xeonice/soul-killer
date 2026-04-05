import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import type { GeneratedEntry } from '../../world/distill.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'

type ReviewAction = 'accept' | 'skip' | 'edit' | 'merge'

interface ReviewResult {
  entry: GeneratedEntry
  action: ReviewAction
  mergeTarget?: string
}

interface WorldDistillReviewProps {
  entries: GeneratedEntry[]
  onComplete: (accepted: GeneratedEntry[]) => void
}

export function WorldDistillReview({ entries, onComplete }: WorldDistillReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<ReviewResult[]>([])
  const [done, setDone] = useState(false)

  const current = entries[currentIndex]

  useInput((input, key) => {
    if (done || !current) return

    if (input === 'a') {
      advance({ entry: current, action: 'accept' })
    } else if (input === 's') {
      advance({ entry: current, action: 'skip' })
    } else if (key.return || input === 'q') {
      // Finish early
      finalize([...results])
    }
  })

  function advance(result: ReviewResult) {
    const newResults = [...results, result]
    setResults(newResults)

    if (currentIndex + 1 >= entries.length) {
      finalize(newResults)
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  function finalize(allResults: ReviewResult[]) {
    setDone(true)
    const accepted = allResults
      .filter((r) => r.action === 'accept')
      .map((r) => r.entry)
    onComplete(accepted)
  }

  if (done) {
    const acceptedCount = results.filter((r) => r.action === 'accept').length
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>审查完成: {acceptedCount}/{entries.length} 条目已接受</Text>
      </Box>
    )
  }

  if (!current) {
    return <Text color={DIM}>无条目可审查</Text>
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={PRIMARY}>[{currentIndex + 1}/{entries.length}] </Text>
        <Text bold>{current.meta.name}</Text>
        <Text color={DIM}> ({current.meta.scope}, {current.meta.mode}, priority: {current.meta.priority})</Text>
      </Box>

      {current.meta.keywords.length > 0 && (
        <Box marginBottom={1}>
          <Text color={DIM}>Keywords: </Text>
          <Text>{current.meta.keywords.join(', ')}</Text>
        </Box>
      )}

      <Box marginBottom={1} flexDirection="column">
        <Text color={DIM}>──────────────────────────</Text>
        <Text>{current.content.slice(0, 300)}{current.content.length > 300 ? '...' : ''}</Text>
        <Text color={DIM}>──────────────────────────</Text>
      </Box>

      <Box>
        <Text color={ACCENT}>(a)</Text><Text> 接受  </Text>
        <Text color={ACCENT}>(s)</Text><Text> 跳过  </Text>
        <Text color={ACCENT}>(q)</Text><Text> 结束审查</Text>
      </Box>
    </Box>
  )
}
