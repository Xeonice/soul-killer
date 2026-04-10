import fs from 'node:fs'
import path from 'node:path'
import type { SoulChunk } from '../ingest/types.js'
import type { EngineAdapter, RecallOptions, RecallResult, IngestResult, EngineStatus } from './adapter.js'

/**
 * Local engine: stores chunks as JSON, uses simple TF-IDF-like similarity for MVP.
 * Full vector search (LanceDB + @xenova/transformers) will be integrated when
 * those heavy dependencies are installed.
 */
export class LocalEngine implements EngineAdapter {
  private chunksPath: string
  private chunks: SoulChunk[] = []

  constructor(soulDir: string) {
    this.chunksPath = path.join(soulDir, 'chunks.json')
    this.loadChunks()
  }

  private loadChunks() {
    if (fs.existsSync(this.chunksPath)) {
      this.chunks = JSON.parse(fs.readFileSync(this.chunksPath, 'utf-8')) as SoulChunk[]
    }
  }

  private saveChunks() {
    const dir = path.dirname(this.chunksPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.chunksPath, JSON.stringify(this.chunks, null, 2))
  }

  async ingest(chunks: SoulChunk[]): Promise<IngestResult> {
    const existingIds = new Set(this.chunks.map((c) => c.id))
    let added = 0

    for (const chunk of chunks) {
      if (!existingIds.has(chunk.id)) {
        this.chunks.push(chunk)
        added++
      }
    }

    this.saveChunks()

    return {
      chunksIngested: added,
      totalChunks: this.chunks.length,
    }
  }

  async recall(query: string, opts?: RecallOptions): Promise<RecallResult[]> {
    const limit = opts?.limit ?? 5
    const queryTerms = tokenize(query)

    const scored = this.chunks
      .filter((chunk) => {
        if (opts?.source && chunk.source !== opts.source) return false
        return true
      })
      .map((chunk) => ({
        chunk,
        similarity: cosineSimilarity(queryTerms, tokenize(chunk.content)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return scored
  }

  async status(): Promise<EngineStatus> {
    return {
      mode: 'local',
      chunkCount: this.chunks.length,
      indexSize: fs.existsSync(this.chunksPath) ? fs.statSync(this.chunksPath).size : 0,
      healthy: true,
    }
  }
}

// Simple TF-based similarity (placeholder for real embedding search)
function tokenize(text: string): Map<string, number> {
  const terms = new Map<string, number>()
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 1)
  for (const word of words) {
    terms.set(word, (terms.get(word) ?? 0) + 1)
  }
  return terms
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const [term, freq] of a) {
    normA += freq * freq
    if (b.has(term)) {
      dot += freq * b.get(term)!
    }
  }
  for (const [, freq] of b) {
    normB += freq * freq
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
