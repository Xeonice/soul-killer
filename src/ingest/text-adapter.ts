import crypto from 'node:crypto'
import type { SoulChunk } from './types.js'

const MAX_CHUNK_LENGTH = 2000

/**
 * Convert raw text input into SoulChunks.
 * Splits at paragraph boundaries; long paragraphs are further split.
 */
export function textToChunks(text: string, soulName: string): SoulChunk[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunks: SoulChunk[] = []

  for (const para of paragraphs) {
    const segments = para.length > MAX_CHUNK_LENGTH
      ? splitAtSentenceBoundary(para, MAX_CHUNK_LENGTH)
      : [para]

    for (const segment of segments) {
      const hash = crypto.createHash('sha256').update(`text:${soulName}:${segment}`).digest('hex').slice(0, 16)
      chunks.push({
        id: hash,
        source: 'user-input',
        content: segment,
        timestamp: new Date().toISOString(),
        context: 'personal',
        type: 'knowledge',
        metadata: { origin: 'text-input' },
        temporal: { confidence: 'unknown' },
      })
    }
  }

  return chunks
}

function splitAtSentenceBoundary(text: string, maxLen: number): string[] {
  const result: string[] = []
  let remaining = text

  while (remaining.length > maxLen) {
    // Find last sentence boundary before maxLen
    const slice = remaining.slice(0, maxLen)
    const lastPeriod = Math.max(
      slice.lastIndexOf('。'),
      slice.lastIndexOf('. '),
      slice.lastIndexOf('！'),
      slice.lastIndexOf('？'),
    )

    const splitAt = lastPeriod > maxLen * 0.3 ? lastPeriod + 1 : maxLen
    result.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining) result.push(remaining)
  return result
}
