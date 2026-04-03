import type { WebSearchExtraction } from '../../ingest/web-adapter.js'
import type { OnProgress } from '../soul-capture-agent.js'

export interface SearchExecutors {
  search: (query: string) => Promise<{ title: string; url: string; content: string }[]>
  wikipedia: (query: string, lang?: string) => Promise<{ title: string; extract: string; url: string }[]>
}

export interface SearchStrategy {
  search(
    englishName: string,
    chineseName: string,
    origin: string,
    executors: SearchExecutors,
    onProgress?: OnProgress,
  ): Promise<WebSearchExtraction[]>
}
