import type { TagSet } from '../tags/taxonomy.js'
import { emptyTagSet } from '../tags/taxonomy.js'

export type SoulType = 'personal' | 'public'

export interface EvolveHistoryEntry {
  timestamp: string
  sources: { type: string; path_or_url?: string; chunk_count: number }[]
  dimensions_updated: ('identity' | 'style' | 'behaviors')[]
  mode: 'delta' | 'full'
  snapshot_id: string
  total_chunks_after: number
}

export interface SoulManifest {
  name: string
  display_name: string
  version: string
  created_at: string
  languages: string[]
  description: string
  chunk_count: number
  embedding_model: string
  engine_version: string
  soulType: SoulType
  tags: TagSet
  evolve_history?: EvolveHistoryEntry[]
}

export function createManifest(
  name: string,
  displayName: string,
  description: string,
  chunkCount: number,
  languages: string[] = ['zh'],
  soulType: SoulType = 'public',
  tags: TagSet = emptyTagSet(),
): SoulManifest {
  return {
    name,
    display_name: displayName,
    version: '0.1.0',
    created_at: new Date().toISOString(),
    languages,
    description,
    chunk_count: chunkCount,
    embedding_model: 'local',
    engine_version: '0.1.0',
    soulType,
    tags,
  }
}
