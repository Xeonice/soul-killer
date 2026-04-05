import { EventEmitter } from 'node:events'
import type OpenAI from 'openai'
import type { SoulChunk } from '../ingest/types.js'
import { IngestPipeline, type AdapterType } from '../ingest/pipeline.js'
import { addEntry, type EntryMeta, type EntryScope, type EntryMode } from './entry.js'
import { loadWorld, saveWorld, bumpPatchVersion } from './manifest.js'
import { loadAllEntries } from './entry.js'

export type DistillPhase = 'ingest' | 'classify' | 'cluster' | 'extract' | 'review'

export interface WorldDistillProgress {
  phase: DistillPhase
  current: number
  total: number
  message: string
}

interface ClassifiedChunk {
  chunk: SoulChunk
  scope: EntryScope | 'irrelevant'
}

interface ChunkCluster {
  chunks: SoulChunk[]
  scope: EntryScope
}

export interface GeneratedEntry {
  meta: EntryMeta
  content: string
}

const BATCH_SIZE = 20

export class WorldDistiller extends EventEmitter {
  private client: OpenAI
  private model: string

  constructor(client: OpenAI, model: string) {
    super()
    this.client = client
    this.model = model
  }

  async distill(
    worldName: string,
    sourcePath: string,
    adapterType: AdapterType,
  ): Promise<GeneratedEntry[]> {
    // Phase 1: Ingest
    this.emit('progress', { phase: 'ingest', current: 0, total: 1, message: 'Ingesting data source...' } as WorldDistillProgress)
    const pipeline = new IngestPipeline()
    const chunks = await pipeline.run({ adapters: [{ type: adapterType, path: sourcePath }] })
    this.emit('progress', { phase: 'ingest', current: 1, total: 1, message: `Ingested ${chunks.length} chunks` } as WorldDistillProgress)

    if (chunks.length === 0) return []

    // Phase 2: Classify
    const classified = await this.classifyChunks(chunks)
    const relevant = classified.filter((c): c is ClassifiedChunk & { scope: EntryScope } => c.scope !== 'irrelevant')
    this.emit('progress', { phase: 'classify', current: classified.length, total: classified.length, message: `${relevant.length}/${classified.length} chunks relevant` } as WorldDistillProgress)

    if (relevant.length === 0) return []

    // Phase 3: Cluster
    const clusters = this.clusterChunks(relevant)
    this.emit('progress', { phase: 'cluster', current: clusters.length, total: clusters.length, message: `${clusters.length} clusters formed` } as WorldDistillProgress)

    // Phase 4: Extract
    const entries = await this.extractEntries(clusters)
    this.emit('progress', { phase: 'extract', current: entries.length, total: entries.length, message: `${entries.length} entries generated` } as WorldDistillProgress)

    return entries
  }

  async writeEntries(worldName: string, entries: GeneratedEntry[]): Promise<void> {
    for (const entry of entries) {
      addEntry(worldName, entry.meta, entry.content)
    }

    const manifest = loadWorld(worldName)
    if (manifest) {
      manifest.entry_count = loadAllEntries(worldName).length
      saveWorld(manifest)
    }
  }

  async evolve(
    worldName: string,
    sourcePath: string,
    adapterType: AdapterType,
  ): Promise<{ newEntries: GeneratedEntry[]; conflicts: { name: string; existing: string; generated: string }[] }> {
    const entries = await this.distill(worldName, sourcePath, adapterType)
    const existing = loadAllEntries(worldName)
    const existingNames = new Set(existing.map((e) => e.meta.name))

    const newEntries: GeneratedEntry[] = []
    const conflicts: { name: string; existing: string; generated: string }[] = []

    for (const entry of entries) {
      if (existingNames.has(entry.meta.name)) {
        const existingEntry = existing.find((e) => e.meta.name === entry.meta.name)!
        conflicts.push({
          name: entry.meta.name,
          existing: existingEntry.content,
          generated: entry.content,
        })
      } else {
        newEntries.push(entry)
      }
    }

    return { newEntries, conflicts }
  }

  async finalizeEvolve(worldName: string, entries: GeneratedEntry[]): Promise<void> {
    await this.writeEntries(worldName, entries)

    const manifest = loadWorld(worldName)
    if (manifest) {
      manifest.version = bumpPatchVersion(manifest.version)
      manifest.entry_count = loadAllEntries(worldName).length
      saveWorld(manifest)
    }
  }

  private async classifyChunks(chunks: SoulChunk[]): Promise<ClassifiedChunk[]> {
    const results: ClassifiedChunk[] = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      this.emit('progress', {
        phase: 'classify',
        current: i,
        total: chunks.length,
        message: `Classifying chunk ${i + 1}/${chunks.length}`,
      } as WorldDistillProgress)

      const batchContent = batch
        .map((c, idx) => `[${idx}] ${c.content.slice(0, 500)}`)
        .join('\n\n')

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a world-building classifier. For each text chunk, classify it into one of these categories:
- background: General world setting/history
- rule: World rules, constraints, laws
- lore: Specific knowledge, characters, factions, locations
- atmosphere: Mood, tone, cultural details
- irrelevant: Not related to world-building (plot summary, author notes, etc.)

Respond with a JSON array of objects: [{"index": 0, "scope": "lore"}, ...]
Respond ONLY with the JSON array, no other text.`,
          },
          { role: 'user', content: batchContent },
        ],
      })

      const text = response.choices[0]?.message?.content ?? '[]'
      try {
        const parsed = JSON.parse(text) as { index: number; scope: string }[]
        for (const item of parsed) {
          const chunk = batch[item.index]
          if (chunk) {
            const scope = ['background', 'rule', 'lore', 'atmosphere', 'irrelevant'].includes(item.scope)
              ? (item.scope as EntryScope | 'irrelevant')
              : 'irrelevant'
            results.push({ chunk, scope })
          }
        }
        // Handle any chunks not in response
        for (let j = 0; j < batch.length; j++) {
          if (!parsed.some((p) => p.index === j)) {
            results.push({ chunk: batch[j], scope: 'irrelevant' })
          }
        }
      } catch {
        // If JSON parsing fails, treat all as lore
        for (const chunk of batch) {
          results.push({ chunk, scope: 'lore' })
        }
      }
    }

    return results
  }

  private clusterChunks(classified: (ClassifiedChunk & { scope: EntryScope })[]): ChunkCluster[] {
    // Group by scope first
    const byScope = new Map<EntryScope, SoulChunk[]>()
    for (const { chunk, scope } of classified) {
      if (!byScope.has(scope)) byScope.set(scope, [])
      byScope.get(scope)!.push(chunk)
    }

    const clusters: ChunkCluster[] = []

    for (const [scope, chunks] of byScope) {
      if (chunks.length <= 3) {
        // Small group → single cluster
        clusters.push({ chunks, scope })
        continue
      }

      // TF-IDF similarity clustering
      const tokenized = chunks.map((c) => tokenize(c.content))
      const assigned = new Set<number>()

      for (let i = 0; i < chunks.length; i++) {
        if (assigned.has(i)) continue
        const cluster: SoulChunk[] = [chunks[i]]
        assigned.add(i)

        for (let j = i + 1; j < chunks.length; j++) {
          if (assigned.has(j)) continue
          const sim = cosineSimilarity(tokenized[i], tokenized[j])
          if (sim > 0.3) {
            cluster.push(chunks[j])
            assigned.add(j)
          }
        }

        clusters.push({ chunks: cluster, scope })
      }
    }

    return clusters
  }

  private async extractEntries(clusters: ChunkCluster[]): Promise<GeneratedEntry[]> {
    const entries: GeneratedEntry[] = []

    for (let i = 0; i < clusters.length; i++) {
      this.emit('progress', {
        phase: 'extract',
        current: i,
        total: clusters.length,
        message: `Extracting entry ${i + 1}/${clusters.length}`,
      } as WorldDistillProgress)

      const cluster = clusters[i]
      const combinedContent = cluster.chunks.map((c) => c.content).join('\n\n')

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a world-building entry generator. From the provided text, create a single world entry.

Output a JSON object with:
- name: kebab-case English identifier (e.g., "mega-corporations")
- display_name: Human-readable name
- keywords: Array of trigger keywords (mix of languages if content is multilingual)
- mode: "always" for core rules, "keyword" for specific topics, "semantic" for general knowledge
- priority: 0-1000 (higher = more important. Core rules: 800-1000, important lore: 400-700, details: 0-300)
- content: The world entry text, concise and informative

The scope is: ${cluster.scope}

Respond ONLY with the JSON object, no other text.`,
          },
          { role: 'user', content: combinedContent.slice(0, 4000) },
        ],
      })

      const text = response.choices[0]?.message?.content ?? '{}'
      try {
        const parsed = JSON.parse(text) as {
          name: string
          keywords: string[]
          mode: string
          priority: number
          content: string
        }

        const mode = (['always', 'keyword', 'semantic'].includes(parsed.mode) ? parsed.mode : 'keyword') as EntryMode

        entries.push({
          meta: {
            name: parsed.name || `entry-${i}`,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
            priority: typeof parsed.priority === 'number' ? parsed.priority : 100,
            mode,
            scope: cluster.scope,
          },
          content: parsed.content || combinedContent.slice(0, 1000),
        })
      } catch {
        // Fallback: use raw cluster content
        entries.push({
          meta: {
            name: `entry-${i}`,
            keywords: [],
            priority: 100,
            mode: 'semantic',
            scope: cluster.scope,
          },
          content: combinedContent.slice(0, 1000),
        })
      }
    }

    return entries
  }
}

// Reused from local-engine.ts pattern
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
    if (b.has(term)) dot += freq * b.get(term)!
  }
  for (const [, freq] of b) {
    normB += freq * freq
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
