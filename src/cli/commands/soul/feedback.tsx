import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { TextInput } from '../../components/text-input.js'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { FeedbackRecord, FeedbackRating } from '../../../infra/ingest/feedback-adapter.js'

type FeedbackPhase = 'rating' | 'note' | 'done'

interface RatingOption {
  label: string
  rating: FeedbackRating
}

const RATING_OPTIONS: RatingOption[] = [
  { label: t('feedback.rating.positive'), rating: 'positive' },
  { label: t('feedback.rating.somewhat_positive'), rating: 'somewhat_positive' },
  { label: t('feedback.rating.somewhat_negative'), rating: 'somewhat_negative' },
  { label: t('feedback.rating.negative'), rating: 'negative' },
]

interface FeedbackCommandProps {
  soulDir: string
  userQuery: string
  assistantResponse: string
  onComplete: () => void
  onExit: () => void
}

export function FeedbackCommand({ soulDir, userQuery, assistantResponse, onComplete, onExit }: FeedbackCommandProps) {
  const [phase, setPhase] = useState<FeedbackPhase>('rating')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedRating, setSelectedRating] = useState<FeedbackRating>('positive')

  const saveFeedback = useCallback((rating: FeedbackRating, note?: string) => {
    const feedbackPath = path.join(soulDir, 'feedback.json')

    let records: FeedbackRecord[] = []
    if (fs.existsSync(feedbackPath)) {
      records = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'))
    }

    const record: FeedbackRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user_query: userQuery,
      assistant_response: assistantResponse,
      rating,
      note: note || undefined,
      consumed: false,
    }

    records.push(record)
    fs.writeFileSync(feedbackPath, JSON.stringify(records, null, 2), 'utf-8')
  }, [soulDir, userQuery, assistantResponse])

  const handleRatingSelect = useCallback(() => {
    const rating = RATING_OPTIONS[selectedIndex]!.rating
    setSelectedRating(rating)

    if (rating === 'somewhat_negative' || rating === 'negative') {
      setPhase('note')
    } else {
      saveFeedback(rating)
      setPhase('done')
      setTimeout(onComplete, 1000)
    }
  }, [selectedIndex, saveFeedback, onComplete])

  const handleNoteSubmit = useCallback((note: string) => {
    saveFeedback(selectedRating, note || undefined)
    setPhase('done')
    setTimeout(onComplete, 1000)
  }, [selectedRating, saveFeedback, onComplete])

  useInput((input, key) => {
    if (phase !== 'rating') return

    if (key.escape) {
      onExit()
      return
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(RATING_OPTIONS.length - 1, i + 1))
    } else if (key.return) {
      handleRatingSelect()
    }
  })

  if (phase === 'done') {
    return (
      <Box paddingLeft={2}>
        <Text color={PRIMARY}>✓ {t('feedback.saved')}</Text>
      </Box>
    )
  }

  if (phase === 'note') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>FEEDBACK</Text>
        <Text color={DIM}>  {t('feedback.note_prompt')}</Text>
        <TextInput
          prompt="note>"
          onSubmit={handleNoteSubmit}
          onEscape={onExit}
        />
      </Box>
    )
  }

  // rating phase
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>FEEDBACK</Text>
      <Text color={DIM}>  {t('feedback.rate_prompt')}</Text>
      {RATING_OPTIONS.map((opt, i) => (
        <Text key={opt.rating} color={i === selectedIndex ? PRIMARY : DIM}>
          {i === selectedIndex ? '▸ ' : '  '}{opt.label}
        </Text>
      ))}
      <Text color={DIM} dimColor>  ↑↓ {t('feedback.nav_hint')}</Text>
    </Box>
  )
}
