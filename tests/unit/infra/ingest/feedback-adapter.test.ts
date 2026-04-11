import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {
  readUnconsumedFeedback,
  markFeedbackConsumed,
  feedbackToChunks,
  type FeedbackRecord,
} from '../../../../src/infra/ingest/feedback-adapter.js'

function makeFeedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: crypto.randomUUID(),
    timestamp: '2024-06-15T12:00:00Z',
    user_query: '你觉得编程怎么样？',
    assistant_response: '编程是一种创造性的活动。',
    rating: 'positive',
    consumed: false,
    ...overrides,
  }
}

describe('readUnconsumedFeedback', () => {
  let tmpDir: string
  let feedbackPath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-fb-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    feedbackPath = path.join(tmpDir, 'feedback.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty for non-existent file', () => {
    expect(readUnconsumedFeedback(feedbackPath)).toEqual([])
  })

  it('returns only unconsumed records', () => {
    const records = [
      makeFeedback({ id: '1', consumed: false }),
      makeFeedback({ id: '2', consumed: true }),
      makeFeedback({ id: '3', consumed: false }),
    ]
    fs.writeFileSync(feedbackPath, JSON.stringify(records))
    const result = readUnconsumedFeedback(feedbackPath)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['1', '3'])
  })
})

describe('markFeedbackConsumed', () => {
  let tmpDir: string
  let feedbackPath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-fb-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    feedbackPath = path.join(tmpDir, 'feedback.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('marks specified records as consumed', () => {
    const records = [
      makeFeedback({ id: 'a', consumed: false }),
      makeFeedback({ id: 'b', consumed: false }),
    ]
    fs.writeFileSync(feedbackPath, JSON.stringify(records))

    markFeedbackConsumed(feedbackPath, ['a'])

    const updated = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8')) as FeedbackRecord[]
    expect(updated[0]!.consumed).toBe(true)
    expect(updated[1]!.consumed).toBe(false)
  })

  it('does nothing for non-existent file', () => {
    expect(() => markFeedbackConsumed(feedbackPath, ['x'])).not.toThrow()
  })
})

describe('feedbackToChunks', () => {
  it('converts positive feedback with full conversation context', () => {
    const record = makeFeedback({ rating: 'positive' })
    const chunks = feedbackToChunks([record])

    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.source).toBe('feedback')
    expect(chunks[0]!.type).toBe('reflection')
    // Full query and response preserved
    expect(chunks[0]!.content).toContain(record.user_query)
    expect(chunks[0]!.content).toContain(record.assistant_response)
    // Positive distill hint
    expect(chunks[0]!.content).toContain('保持和强化')
    expect(chunks[0]!.content).toContain('很像本人')
    expect(chunks[0]!.temporal?.confidence).toBe('exact')
  })

  it('converts negative feedback with full context and correction hint', () => {
    const record = makeFeedback({
      rating: 'negative',
      note: '他不会用这种语气说话',
    })
    const chunks = feedbackToChunks([record])

    expect(chunks[0]!.content).toContain(record.user_query)
    expect(chunks[0]!.content).toContain(record.assistant_response)
    expect(chunks[0]!.content).toContain('避免类似')
    expect(chunks[0]!.content).toContain('他不会用这种语气说话')
  })

  it('includes feedback metadata', () => {
    const record = makeFeedback({ id: 'test-id', rating: 'somewhat_negative' })
    const chunks = feedbackToChunks([record])

    expect(chunks[0]!.metadata.feedback_id).toBe('test-id')
    expect(chunks[0]!.metadata.rating).toBe('somewhat_negative')
  })

  it('preserves full long response without truncation', () => {
    const longResponse = 'A'.repeat(2000)
    const record = makeFeedback({ assistant_response: longResponse })
    const chunks = feedbackToChunks([record])
    expect(chunks[0]!.content).toContain(longResponse)
  })

  it('treats somewhat_positive as positive', () => {
    const record = makeFeedback({ rating: 'somewhat_positive' })
    const chunks = feedbackToChunks([record])
    expect(chunks[0]!.content).toContain('正面')
    expect(chunks[0]!.content).toContain('基本像')
    expect(chunks[0]!.content).toContain('保持和强化')
  })

  it('treats somewhat_negative as negative', () => {
    const record = makeFeedback({ rating: 'somewhat_negative' })
    const chunks = feedbackToChunks([record])
    expect(chunks[0]!.content).toContain('负面')
    expect(chunks[0]!.content).toContain('不太像')
    expect(chunks[0]!.content).toContain('避免类似')
  })

  it('negative feedback without note omits note section', () => {
    const record = makeFeedback({ rating: 'negative', note: undefined })
    const chunks = feedbackToChunks([record])
    expect(chunks[0]!.content).not.toContain('用户备注')
  })

  it('extracts temporal date from feedback timestamp', () => {
    const record = makeFeedback({ timestamp: '2025-03-15T08:30:00Z' })
    const chunks = feedbackToChunks([record])
    expect(chunks[0]!.temporal).toEqual({ date: '2025-03-15', confidence: 'exact' })
  })

  it('converts multiple records to multiple chunks', () => {
    const records = [
      makeFeedback({ id: 'a', rating: 'positive' }),
      makeFeedback({ id: 'b', rating: 'negative', note: 'wrong tone' }),
      makeFeedback({ id: 'c', rating: 'somewhat_positive' }),
    ]
    const chunks = feedbackToChunks(records)
    expect(chunks).toHaveLength(3)
  })

  it('returns empty for empty input', () => {
    expect(feedbackToChunks([])).toEqual([])
  })

  it('includes structured markdown sections', () => {
    const record = makeFeedback({ rating: 'negative', note: '语气太正式了' })
    const chunks = feedbackToChunks([record])
    const content = chunks[0]!.content
    expect(content).toContain('### 用户提问')
    expect(content).toContain('### 分身回复')
    expect(content).toContain('### 用户备注')
    expect(content).toContain('蒸馏提示')
  })
})

describe('feedback consume-then-read cycle', () => {
  let tmpDir: string
  let feedbackPath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-fb-cycle-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    feedbackPath = path.join(tmpDir, 'feedback.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('full cycle: read unconsumed → convert to chunks → mark consumed → no more unconsumed', () => {
    const records = [
      makeFeedback({ id: 'x', consumed: false }),
      makeFeedback({ id: 'y', consumed: false }),
    ]
    fs.writeFileSync(feedbackPath, JSON.stringify(records))

    // Step 1: read unconsumed
    const unconsumed = readUnconsumedFeedback(feedbackPath)
    expect(unconsumed).toHaveLength(2)

    // Step 2: convert to chunks
    const chunks = feedbackToChunks(unconsumed)
    expect(chunks).toHaveLength(2)

    // Step 3: mark consumed
    markFeedbackConsumed(feedbackPath, unconsumed.map((r) => r.id))

    // Step 4: no more unconsumed
    const remaining = readUnconsumedFeedback(feedbackPath)
    expect(remaining).toHaveLength(0)
  })

  it('new feedback added after consume is still readable', () => {
    const initial = [makeFeedback({ id: 'old', consumed: false })]
    fs.writeFileSync(feedbackPath, JSON.stringify(initial))

    markFeedbackConsumed(feedbackPath, ['old'])

    // Add new feedback
    const data = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8')) as FeedbackRecord[]
    data.push(makeFeedback({ id: 'new', consumed: false }))
    fs.writeFileSync(feedbackPath, JSON.stringify(data))

    const unconsumed = readUnconsumedFeedback(feedbackPath)
    expect(unconsumed).toHaveLength(1)
    expect(unconsumed[0]!.id).toBe('new')
  })
})
