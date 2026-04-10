import fs from 'node:fs'
import crypto from 'node:crypto'
import type { SoulChunk } from './types.js'
import { t } from '../i18n/index.js'

export type FeedbackRating = 'positive' | 'somewhat_positive' | 'somewhat_negative' | 'negative'

export interface FeedbackRecord {
  id: string
  timestamp: string
  user_query: string
  assistant_response: string
  rating: FeedbackRating
  note?: string
  consumed: boolean
}

/**
 * Read unconsumed feedback records from a soul's feedback.json.
 */
export function readUnconsumedFeedback(feedbackPath: string): FeedbackRecord[] {
  if (!fs.existsSync(feedbackPath)) return []

  const data = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8')) as FeedbackRecord[]
  return data.filter((r) => !r.consumed)
}

/**
 * Mark feedback records as consumed in the feedback.json file.
 */
export function markFeedbackConsumed(feedbackPath: string, ids: string[]): void {
  if (!fs.existsSync(feedbackPath)) return

  const data = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8')) as FeedbackRecord[]
  const idSet = new Set(ids)

  for (const record of data) {
    if (idSet.has(record.id)) {
      record.consumed = true
    }
  }

  fs.writeFileSync(feedbackPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Convert feedback records to SoulChunks.
 */
function getRatingLabel(rating: FeedbackRating): string {
  return t(`feedback.rating.${rating}`)
}

export function feedbackToChunks(records: FeedbackRecord[]): SoulChunk[] {
  return records.map((record) => {
    const isPositive = record.rating === 'positive' || record.rating === 'somewhat_positive'
    const ratingLabel = getRatingLabel(record.rating)

    const parts: string[] = [
      `## ${t(isPositive ? 'feedback.chunk.title_positive' : 'feedback.chunk.title_negative')}`,
      '',
      `**${t('feedback.chunk.rating')}**${ratingLabel}`,
      '',
      `### ${t('feedback.chunk.user_query')}`,
      record.user_query,
      '',
      `### ${t('feedback.chunk.assistant_response')}`,
      record.assistant_response,
    ]

    if (record.note) {
      parts.push('', `### ${t('feedback.chunk.user_note')}`, record.note)
    }

    if (isPositive) {
      parts.push('', `> ${t('feedback.chunk.distill_hint_positive')}`)
    } else {
      parts.push('', `> ${t('feedback.chunk.distill_hint_negative')}`)
    }

    const content = parts.join('\n')
    const hash = crypto.createHash('sha256').update(`feedback:${record.id}`).digest('hex').slice(0, 16)
    const feedbackDate = record.timestamp.slice(0, 10)

    return {
      id: hash,
      source: 'feedback' as const,
      content,
      timestamp: new Date().toISOString(),
      context: 'personal' as const,
      type: 'reflection' as const,
      metadata: {
        feedback_id: record.id,
        rating: record.rating,
        original_query: record.user_query,
        note: record.note,
      },
      temporal: {
        date: feedbackDate,
        confidence: 'exact' as const,
      },
    }
  })
}
