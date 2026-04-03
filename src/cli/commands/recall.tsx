import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import type { EngineAdapter, RecallResult } from '../../engine/adapter.js'

interface RecallCommandProps {
  query: string
  engine: EngineAdapter
  onResults?: (results: RecallResult[]) => void
}

export function RecallCommand({ query, engine, onResults }: RecallCommandProps) {
  const [results, setResults] = useState<RecallResult[] | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const res = await engine.recall(query, { limit: 5 })
        if (!cancelled) {
          setResults(res)
          setLoading(false)
          onResults?.(res)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [query, engine, onResults])

  if (loading) {
    return (
      <Box paddingLeft={2}>
        <Text color={PRIMARY}>▓ {t('recall.searching', { query })}</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box paddingLeft={2}>
        <Text color={DIM}>✗ {t('recall.failed', { error })}</Text>
      </Box>
    )
  }

  if (!results || results.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text color={DIM}>{t('recall.no_results')}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={PRIMARY} bold>RECALL — &quot;{query}&quot;</Text>
      <Text> </Text>
      {results.map((r, i) => (
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
