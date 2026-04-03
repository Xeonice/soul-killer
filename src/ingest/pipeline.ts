import { EventEmitter } from 'node:events'
import type { SoulChunk, DataAdapter, IngestProgress } from './types.js'
import { MarkdownAdapter } from './markdown-adapter.js'
import { TwitterAdapter } from './twitter-adapter.js'

export type AdapterType = 'markdown' | 'twitter'

const ADAPTERS: Record<AdapterType, DataAdapter> = {
  markdown: new MarkdownAdapter(),
  twitter: new TwitterAdapter(),
}

export interface IngestRequest {
  adapters: { type: AdapterType; path: string }[]
}

export class IngestPipeline extends EventEmitter {
  async run(request: IngestRequest): Promise<SoulChunk[]> {
    const allChunks: SoulChunk[] = []

    for (const { type, path } of request.adapters) {
      const adapter = ADAPTERS[type]
      if (!adapter) {
        throw new Error(`Unknown adapter: ${type}`)
      }

      let count = 0
      for await (const chunk of adapter.adapt(path)) {
        allChunks.push(chunk)
        count++

        if (count % 50 === 0) {
          this.emit('progress', {
            event: 'chunks_created',
            current: allChunks.length,
            message: `${adapter.name}: ${count} chunks processed`,
          } satisfies IngestProgress)
        }
      }

      this.emit('progress', {
        event: 'files_scanned',
        current: allChunks.length,
        message: `${adapter.name}: done — ${count} chunks`,
      } satisfies IngestProgress)
    }

    return allChunks
  }
}
