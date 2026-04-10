import type { SoulChunk } from '../infra/ingest/types.js'
import type { EngineAdapter, RecallOptions, RecallResult, IngestResult, EngineStatus } from './adapter.js'

const BASE_URL = 'http://localhost:6600'

export class DockerEngine implements EngineAdapter {
  async ingest(chunks: SoulChunk[]): Promise<IngestResult> {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks }),
    })
    if (!res.ok) throw new Error(`Engine ingest failed: ${res.status}`)
    return (await res.json()) as IngestResult
  }

  async recall(query: string, opts?: RecallOptions): Promise<RecallResult[]> {
    const params = new URLSearchParams({ query })
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.source) params.set('source', opts.source)
    if (opts?.timeRange) params.set('time_range', opts.timeRange)

    const res = await fetch(`${BASE_URL}/recall?${params}`)
    if (!res.ok) throw new Error(`Engine recall failed: ${res.status}`)
    return (await res.json()) as RecallResult[]
  }

  async status(): Promise<EngineStatus> {
    const res = await fetch(`${BASE_URL}/status`)
    if (!res.ok) throw new Error(`Engine status failed: ${res.status}`)
    const data = (await res.json()) as EngineStatus
    return { ...data, mode: 'docker' }
  }
}
