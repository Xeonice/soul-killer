import crypto from 'node:crypto'
import type { SoulChunk, ChunkType, ChunkTemporal } from './types.js'

export interface WebSearchExtraction {
  content: string
  url?: string
  searchQuery: string
  extractionStep: string
  publishedDate?: string // ISO 8601 date if available
}

/**
 * Convert agent search extractions to SoulChunks.
 */
export function webExtractionToChunks(extractions: WebSearchExtraction[]): SoulChunk[] {
  const chunks: SoulChunk[] = []
  const seen = new Set<string>()

  for (const extraction of extractions) {
    // Split into paragraphs for finer-grained chunks
    const paragraphs = extraction.content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20)

    for (const paragraph of paragraphs) {
      // Deduplicate by content hash
      const hash = crypto.createHash('sha256').update(paragraph).digest('hex').slice(0, 16)
      if (seen.has(hash)) continue
      seen.add(hash)

      const temporal: ChunkTemporal = extraction.publishedDate
        ? { date: extraction.publishedDate.slice(0, 10), confidence: 'exact' }
        : { confidence: 'unknown' }

      chunks.push({
        id: `web-${hash}`,
        source: 'web',
        content: paragraph,
        timestamp: new Date().toISOString(),
        context: 'public',
        type: inferWebChunkType(paragraph, extraction.extractionStep),
        metadata: {
          url: extraction.url,
          search_query: extraction.searchQuery,
          extraction_step: extraction.extractionStep,
        },
        temporal,
      })
    }
  }

  return chunks
}

function inferWebChunkType(content: string, step: string): ChunkType {
  // Step-based heuristic
  if (step === 'personality') return 'reflection'
  if (step === 'gather_deep') {
    const lower = content.toLowerCase()
    if (lower.includes('"') || lower.includes('「') || lower.includes('said') || lower.includes('说')) {
      return 'casual' // Dialogue/quotes
    }
    return 'opinion'
  }
  return 'knowledge'
}
