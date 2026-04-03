export type SourceType = 'markdown' | 'twitter' | 'web' | 'wechat' | 'feishu' | 'claude' | 'user-input' | 'feedback' | 'synthetic'
export type ContextType = 'public' | 'work' | 'personal'
export type ChunkType = 'opinion' | 'decision' | 'reflection' | 'knowledge' | 'casual'
export type TemporalConfidence = 'exact' | 'inferred' | 'unknown'

export interface ChunkTemporal {
  date?: string   // ISO 8601 date (YYYY-MM-DD)
  period?: string // human-readable period, e.g. "2010s", "大学时期"
  confidence: TemporalConfidence
}

export interface SoulChunk {
  id: string
  source: SourceType
  content: string
  timestamp: string // ISO 8601 — ingestion time
  context: ContextType
  type: ChunkType
  metadata: Record<string, unknown>
  temporal?: ChunkTemporal
}

export interface DataAdapter {
  name: string
  adapt(path: string): AsyncIterable<SoulChunk>
}

export interface IngestProgress {
  event: 'files_scanned' | 'chunks_created' | 'embedding_progress'
  current: number
  total?: number
  message?: string
}
