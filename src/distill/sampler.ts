import type { SoulChunk } from '../ingest/types.js'

/**
 * Sample chunks from the full set, grouped by source and type.
 */
export function sampleChunks(chunks: SoulChunk[], sampleSize = 200): SoulChunk[] {
  if (chunks.length <= sampleSize) return [...chunks]

  // Group by source + type
  const groups = new Map<string, SoulChunk[]>()
  for (const chunk of chunks) {
    const key = `${chunk.source}:${chunk.type}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(chunk)
  }

  // Proportional sampling from each group
  const sampled: SoulChunk[] = []
  for (const [, groupChunks] of groups) {
    const proportion = groupChunks.length / chunks.length
    const groupSampleSize = Math.max(1, Math.round(sampleSize * proportion))

    // Shuffle and take
    const shuffled = [...groupChunks].sort(() => Math.random() - 0.5)
    sampled.push(...shuffled.slice(0, groupSampleSize))
  }

  return sampled.slice(0, sampleSize)
}
