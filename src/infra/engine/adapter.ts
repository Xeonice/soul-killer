import type { SoulChunk } from '../ingest/types.js'

export interface RecallOptions {
  limit?: number
  source?: string
  timeRange?: string
}

export interface IngestResult {
  chunksIngested: number
  totalChunks: number
}

export interface SoulFiles {
  identity: string
  style: string
  behaviors: Record<string, string>
}

export interface DistillConfig {
  model: string
  sampleSize?: number
}

export interface EngineStatus {
  mode: 'docker' | 'local'
  chunkCount: number
  indexSize?: number // bytes
  healthy: boolean
}

export interface RecallResult {
  chunk: SoulChunk
  similarity: number
}

export interface EngineAdapter {
  ingest(chunks: SoulChunk[]): Promise<IngestResult>
  recall(query: string, opts?: RecallOptions): Promise<RecallResult[]>
  status(): Promise<EngineStatus>
}
