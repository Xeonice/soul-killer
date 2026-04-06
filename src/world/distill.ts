import { EventEmitter } from 'node:events'
import type OpenAI from 'openai'
import type { SoulChunk } from '../ingest/types.js'
import { IngestPipeline, type AdapterType } from '../ingest/pipeline.js'
import { addEntry, type EntryMeta, type EntryScope, type EntryMode } from './entry.js'
import { loadWorld, saveWorld, bumpPatchVersion } from './manifest.js'
import { loadAllEntries } from './entry.js'
import type { WorldClassification, WorldDimension } from '../agent/world-dimensions.js'
import { WORLD_DIMENSIONS, ALL_WORLD_DIMENSIONS } from '../agent/world-dimensions.js'

export type DistillPhase = 'ingest' | 'classify' | 'cluster' | 'extract' | 'review'

export interface DimensionStats {
  [dimension: string]: number
}

export interface WorldDistillProgress {
  phase: DistillPhase
  current: number
  total: number
  message: string
  /** Dimension distribution after classify phase */
  dimensionStats?: DimensionStats
  /** Current entry being generated in extract phase */
  entryName?: string
  entryDimension?: string
  /** Generated entries so far in extract phase */
  generatedEntries?: { name: string; dimension?: string; scope: string }[]
}

interface ClassifiedChunk {
  chunk: SoulChunk
  scope: EntryScope | 'irrelevant'
  dimension?: WorldDimension
}

interface ChunkCluster {
  chunks: SoulChunk[]
  scope: EntryScope
  dimension?: WorldDimension
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
    classification?: WorldClassification,
  ): Promise<GeneratedEntry[]> {
    // Phase 1: Ingest
    this.emit('progress', { phase: 'ingest', current: 0, total: 1, message: 'Ingesting data source...' } as WorldDistillProgress)
    const pipeline = new IngestPipeline()
    const chunks = await pipeline.run({ adapters: [{ type: adapterType, path: sourcePath }] })
    this.emit('progress', { phase: 'ingest', current: 1, total: 1, message: `Ingested ${chunks.length} chunks` } as WorldDistillProgress)

    if (chunks.length === 0) return []

    // Phase 2: Classify
    const classified = await this.classifyChunks(chunks, classification)
    const relevant = classified.filter((c): c is ClassifiedChunk & { scope: EntryScope } => c.scope !== 'irrelevant')

    // Build dimension stats
    const dimStats: DimensionStats = {}
    for (const c of relevant) {
      const dim = c.dimension ?? 'unknown'
      dimStats[dim] = (dimStats[dim] ?? 0) + 1
    }

    this.emit('progress', {
      phase: 'classify',
      current: classified.length,
      total: classified.length,
      message: `${relevant.length}/${classified.length} chunks relevant`,
      dimensionStats: dimStats,
    } as WorldDistillProgress)

    if (relevant.length === 0) return []

    // Phase 3: Cluster
    const clusters = this.clusterChunks(relevant)
    this.emit('progress', { phase: 'cluster', current: clusters.length, total: clusters.length, message: `${clusters.length} clusters formed`, dimensionStats: dimStats } as WorldDistillProgress)

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

  private async classifyChunks(chunks: SoulChunk[], classification?: WorldClassification): Promise<ClassifiedChunk[]> {
    const results: ClassifiedChunk[] = []

    const dimensionList = ALL_WORLD_DIMENSIONS.map((d) => `${d}: ${WORLD_DIMENSIONS[d].description}`).join('\n')
    const classificationHint = classification === 'FICTIONAL_UNIVERSE'
      ? 'This is a fictional world setting. Focus on fictional world-building elements.'
      : classification === 'REAL_SETTING'
        ? 'This is a real-world setting. Focus on real-world information.'
        : ''

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
            content: `You are a world-building classifier. For each text chunk, you MUST assign TWO labels:

1. **scope** — how it will be injected into context:
   - background: Core world setting, always visible
   - rule: World rules and constraints, always visible
   - lore: Specific knowledge, triggered on demand
   - atmosphere: Mood and tone, injected at end
   - irrelevant: Not world-building content, discard

2. **dimension** — what aspect of the world it describes (REQUIRED, pick exactly one):
${dimensionList}
   - irrelevant: Not world-building content
${classificationHint}

IMPORTANT: Every item MUST have both "scope" and "dimension" fields. Do not omit "dimension".

Output format — JSON array only, no other text:
[{"index": 0, "scope": "lore", "dimension": "geography"}, {"index": 1, "scope": "rule", "dimension": "systems"}, ...]`,
          },
          { role: 'user', content: batchContent },
        ],
      })

      const text = response.choices[0]?.message?.content ?? '[]'
      try {
        const parsed = JSON.parse(text) as { index: number; scope: string; dimension?: string }[]
        for (const item of parsed) {
          const chunk = batch[item.index]
          if (chunk) {
            const scope = ['background', 'rule', 'lore', 'atmosphere', 'irrelevant'].includes(item.scope)
              ? (item.scope as EntryScope | 'irrelevant')
              : 'irrelevant'
            const parsedDim = item.dimension && ALL_WORLD_DIMENSIONS.includes(item.dimension as WorldDimension)
              ? item.dimension as WorldDimension
              : undefined
            // Fallback: infer dimension from scope if LLM didn't provide one
            const dimension = parsedDim ?? inferDimensionFromScope(scope === 'irrelevant' ? 'lore' : scope)
            results.push({ chunk, scope, dimension })
          }
        }
        // Handle any chunks not in response
        for (let j = 0; j < batch.length; j++) {
          if (!parsed.some((p) => p.index === j)) {
            results.push({ chunk: batch[j], scope: 'irrelevant', dimension: undefined })
          }
        }
      } catch {
        // If JSON parsing fails, treat all as lore with fallback dimension
        for (const chunk of batch) {
          results.push({ chunk, scope: 'lore', dimension: inferDimensionFromScope('lore') })
        }
      }
    }

    return results
  }

  private clusterChunks(classified: (ClassifiedChunk & { scope: EntryScope })[]): ChunkCluster[] {
    // Group by scope+dimension for better clustering
    const groupKey = (c: ClassifiedChunk & { scope: EntryScope }) => `${c.scope}:${c.dimension ?? 'unknown'}`
    const byGroup = new Map<string, { chunks: SoulChunk[]; scope: EntryScope; dimension?: WorldDimension }>()
    for (const item of classified) {
      const key = groupKey(item)
      if (!byGroup.has(key)) byGroup.set(key, { chunks: [], scope: item.scope, dimension: item.dimension })
      byGroup.get(key)!.chunks.push(item.chunk)
    }

    const clusters: ChunkCluster[] = []

    for (const [, group] of byGroup) {
      if (group.chunks.length <= 3) {
        clusters.push({ chunks: group.chunks, scope: group.scope, dimension: group.dimension })
        continue
      }

      // TF-IDF similarity clustering
      const tokenized = group.chunks.map((c) => tokenize(c.content))
      const assigned = new Set<number>()

      for (let i = 0; i < group.chunks.length; i++) {
        if (assigned.has(i)) continue
        const cluster: SoulChunk[] = [group.chunks[i]]
        assigned.add(i)

        for (let j = i + 1; j < group.chunks.length; j++) {
          if (assigned.has(j)) continue
          const sim = cosineSimilarity(tokenized[i], tokenized[j])
          if (sim > 0.3) {
            cluster.push(group.chunks[j])
            assigned.add(j)
          }
        }

        clusters.push({ chunks: cluster, scope: group.scope, dimension: group.dimension })
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
        entryDimension: clusters[i].dimension,
        generatedEntries: entries.map((e) => ({ name: e.meta.name, dimension: e.meta.dimension, scope: e.meta.scope })),
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
            ...(cluster.dimension ? { dimension: cluster.dimension } : {}),
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
            ...(cluster.dimension ? { dimension: cluster.dimension } : {}),
          },
          content: combinedContent.slice(0, 1000),
        })
      }
    }

    return entries
  }
}

// Fallback: infer a default dimension from scope when LLM doesn't provide one
function inferDimensionFromScope(scope: EntryScope): WorldDimension {
  switch (scope) {
    case 'background': return 'history'
    case 'rule': return 'systems'
    case 'atmosphere': return 'atmosphere'
    case 'lore': return 'factions'
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
