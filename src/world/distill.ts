import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { generateText, type LanguageModel } from 'ai'
import type { DimensionPlan } from '../infra/agent/dimension-framework.js'
import type { SearchResult } from '../infra/search/tavily-search.js'
import type { SoulChunk } from '../infra/ingest/types.js'
import { IngestPipeline, type AdapterType } from '../infra/ingest/pipeline.js'
import {
  addEntry,
  loadAllEntries,
  refreshDimensionIndexes,
  inferDimensionFromScope,
  type EntryMeta,
  type EntryScope,
  type EntryMode,
} from './entry.js'
import { addChronicleEntry, mergeIntoTimelineFile, type ChronicleKind } from './chronicle.js'
import { loadWorld, saveWorld, bumpPatchVersion } from './manifest.js'
import type { WorldClassification, WorldDimension } from './capture/world-dimensions.js'
import { WORLD_DIMENSIONS, ALL_WORLD_DIMENSIONS } from './capture/world-dimensions.js'
import type { DimensionDef } from '../infra/agent/dimension-framework.js'
import type { AgentLogger } from '../infra/utils/agent-logger.js'

export type DistillPhase = 'ingest' | 'classify' | 'cluster' | 'extract' | 'review'

export interface DimensionStats {
  [dimension: string]: number
}

export interface HistorySubProgress {
  pass: 'A' | 'B' | 'C'
  eventsDone: number
  eventsTotal: number
  currentEvent?: string
  completedEvents?: string[]
}

export interface WorldDistillProgress {
  phase: DistillPhase
  current: number
  total: number
  message: string
  dimensionStats?: DimensionStats
  entryName?: string
  entryDimension?: string
  generatedEntries?: { name: string; dimension?: string; scope: string }[]
  historySubProgress?: HistorySubProgress
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
  /**
   * When set, the entry is a chronicle entry and `writeEntries` will route
   * it via the chronicle writers:
   * - `timeline` → merged into `history/timeline.md` single file
   * - `events`   → written to `history/events/<name>.md`
   * Both kinds always carry `meta.scope === 'chronicle'` and
   * `meta.dimension === 'history'`.
   */
  chronicleType?: ChronicleKind
}

const BATCH_SIZE = 20
const HISTORY_PASS_B_CONCURRENCY = 5

export class WorldDistiller extends EventEmitter {
  private model: LanguageModel

  constructor(model: LanguageModel) {
    super()
    this.model = model
  }

  async distill(
    worldName: string,
    sourcePath: string,
    adapterType: AdapterType,
    classification?: WorldClassification,
    dimensions?: DimensionDef[],
    agentLog?: AgentLogger,
  ): Promise<GeneratedEntry[]> {
    const distillStartTime = Date.now()

    // Phase 1: Ingest
    this.emit('progress', { phase: 'ingest', current: 0, total: 1, message: 'Ingesting data source...' } as WorldDistillProgress)
    const pipeline = new IngestPipeline()
    const chunks = await pipeline.run({ adapters: [{ type: adapterType, path: sourcePath }] })
    this.emit('progress', { phase: 'ingest', current: 1, total: 1, message: `Ingested ${chunks.length} chunks` } as WorldDistillProgress)

    if (chunks.length === 0) return []

    agentLog?.distillStart({ model: 'world-distill', totalChunks: chunks.length, sampledChunks: chunks.length })

    const customDimensions = dimensions ?? loadWorld(worldName)?.dimensions

    // Phase 2: Classify
    const classified = await this.classifyChunks(chunks, classification, customDimensions, agentLog)
    const relevant = classified.filter((c): c is ClassifiedChunk & { scope: EntryScope } => c.scope !== 'irrelevant')

    // Track how many chunks had inferred (fallback) dimensions.
    let inferredCount = 0
    for (const c of relevant) {
      if (c.dimension === undefined) inferredCount++
    }

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
    agentLog?.distillPhase('cluster', 'started')
    const clusters = this.clusterChunks(relevant)
    agentLog?.distillPhase('cluster', 'done')
    this.emit('progress', { phase: 'cluster', current: clusters.length, total: clusters.length, message: `${clusters.length} clusters formed`, dimensionStats: dimStats } as WorldDistillProgress)

    // Phase 4: Extract (history dim goes through runHistoryThreePass)
    const rawEntries = await this.extractEntries(worldName, clusters, agentLog)
    this.emit('progress', { phase: 'extract', current: rawEntries.length, total: rawEntries.length, message: `${rawEntries.length} entries generated` } as WorldDistillProgress)

    // Phase 5: Review — merge duplicates and remove shallow entries
    this.emit('progress', { phase: 'review', current: 0, total: 1, message: 'Reviewing entries for duplicates and quality...' } as WorldDistillProgress)
    const entries = await this.reviewEntries(rawEntries, agentLog)
    if (inferredCount > 0) {
      agentLog?.distillPhase('review', 'done', `${inferredCount} entries had inferred dimension`)
    }
    this.emit('progress', { phase: 'review', current: 1, total: 1, message: `${entries.length} entries after review (${rawEntries.length - entries.length} removed/merged)` } as WorldDistillProgress)

    // Log result summary
    const dimCovered = new Set(entries.map((e) => e.meta.dimension).filter(Boolean)).size
    agentLog?.worldDistillEnd({ entries: entries.length, dimensions: dimCovered, totalDurationMs: Date.now() - distillStartTime })

    return entries
  }

  /**
   * Distill from dimension cache (produced by capture agent's deterministic search).
   * Skips classify/cluster — articles are already organized by dimension.
   * Processes dimensions in parallel with concurrency control, except for
   * the history dimension which routes to runHistoryThreePass.
   */
  async distillFromCache(
    worldName: string,
    sessionDir: string,
    dimensionPlan: DimensionPlan,
    agentLog?: AgentLogger,
  ): Promise<GeneratedEntry[]> {
    const distillStartTime = Date.now()
    const dimFiles = dimensionPlan.dimensions
      .map((dim) => ({
        dim,
        filePath: path.join(sessionDir, `${dim.name}.json`),
      }))
      .filter(({ filePath }) => fs.existsSync(filePath))

    this.emit('progress', { phase: 'extract', current: 0, total: dimFiles.length, message: `Distilling ${dimFiles.length} dimensions...` } as WorldDistillProgress)
    agentLog?.distillPhase('extract', 'started', `${dimFiles.length} dimensions`)

    const CONCURRENCY = 5
    const allEntries: GeneratedEntry[] = []
    let completed = 0

    for (let i = 0; i < dimFiles.length; i += CONCURRENCY) {
      const batch = dimFiles.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(async ({ dim, filePath }) => {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          const results: SearchResult[] = data.results ?? []

          if (results.length === 0) return []

          const MAX_ARTICLE_LENGTH = 30000
          const MAX_TOTAL_LENGTH = 150000

          const combined = results
            .map((r) => {
              const content = r.content.length > MAX_ARTICLE_LENGTH
                ? r.content.slice(0, MAX_ARTICLE_LENGTH) + '\n\n[... article truncated ...]'
                : r.content
              return `### ${r.title}\nSource: ${r.url}\n\n${content}`
            })
            .join('\n\n---\n\n')
            .slice(0, MAX_TOTAL_LENGTH)

          this.emit('progress', {
            phase: 'extract',
            current: completed,
            total: dimFiles.length,
            message: `Distilling: ${dim.name}`,
            entryDimension: dim.name,
          } as WorldDistillProgress)

          try {
            // Route history dimension to the dedicated three-pass flow.
            if (dim.name === 'history') {
              const historyEntries = await this.runHistoryThreePass(
                worldName,
                combined,
                dim.distillTarget as EntryScope,
                agentLog,
              )
              completed++
              this.emit('progress', {
                phase: 'extract',
                current: completed,
                total: dimFiles.length,
                message: `✓ history (${historyEntries.length} entries)`,
                entryDimension: 'history',
              } as WorldDistillProgress)
              return historyEntries
            }

            const batchStart = Date.now()
            const { text } = await generateText({
              model: this.model,
              messages: [
                {
                  role: 'system',
                  content: `You are a world-building entry generator for the world "${worldName}".

From the provided articles about the "${dim.name}" dimension (${dim.description}), create 2-5 detailed world entries.

CRITICAL RULES:
- ONLY extract information that appears in the provided articles. Do NOT add information from your own knowledge.
- Every fact in an entry MUST come from one of the provided articles.
- If the articles don't contain enough information, generate FEWER entries rather than making up content.
- All entries must be specifically about "${worldName}", not about other topics that may appear in the articles.

Each entry should be 5-10 sentences. Explain WHY and HOW, not just WHAT. Include causes, consequences, mechanisms, and relationships.

Output a JSON array of objects, each with:
- name: kebab-case English identifier
- display_name: Human-readable name
- keywords: Array of trigger keywords (multilingual)
- mode: "always" for core rules, "keyword" for specific topics, "semantic" for general knowledge
- priority: 0-1000 (core: 800-1000, important: 400-700, details: 0-300)
- content: The entry text (5-10 sentences, detailed and analytical)

The scope is: ${dim.distillTarget}

Respond ONLY with the JSON array.`,
                },
                { role: 'user', content: combined },
              ],
            })

            agentLog?.distillBatch(`extract:${dim.name}`, completed + 1, dimFiles.length, Date.now() - batchStart, text.length)

            const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
            const parsed = JSON.parse(jsonText)
            const items = Array.isArray(parsed) ? parsed : [parsed]

            const entries: GeneratedEntry[] = []
            for (let j = 0; j < items.length; j++) {
              const item = items[j]
              entries.push({
                meta: {
                  name: item.name || `entry-${dim.name}-${j}`,
                  keywords: Array.isArray(item.keywords) ? item.keywords : [],
                  priority: typeof item.priority === 'number' ? item.priority : 100,
                  mode: (['always', 'keyword', 'semantic'].includes(item.mode) ? item.mode : 'keyword') as EntryMode,
                  scope: dim.distillTarget as EntryScope,
                  dimension: dim.name as WorldDimension,
                },
                content: item.content || '',
              })
            }

            completed++
            this.emit('progress', {
              phase: 'extract',
              current: completed,
              total: dimFiles.length,
              message: `✓ ${dim.name} (${entries.length} entries)`,
              entryDimension: dim.name,
            } as WorldDistillProgress)
            return entries
          } catch (err) {
            agentLog?.toolInternal(`ERROR extract:${dim.name}`, err instanceof Error ? err.message : String(err))
            completed++
            this.emit('progress', {
              phase: 'extract',
              current: completed,
              total: dimFiles.length,
              message: `✗ ${dim.name} (error)`,
              entryDimension: dim.name,
            } as WorldDistillProgress)
            return []
          }
        }),
      )

      allEntries.push(...batchResults.flat())
    }

    agentLog?.distillPhase('extract', 'done')
    this.emit('progress', { phase: 'extract', current: dimFiles.length, total: dimFiles.length, message: `${allEntries.length} entries generated from ${dimFiles.length} dimensions` } as WorldDistillProgress)

    // Review: merge duplicates and remove shallow entries
    this.emit('progress', { phase: 'review', current: 0, total: 1, message: 'Reviewing entries...' } as WorldDistillProgress)
    const reviewed = await this.reviewEntries(allEntries, agentLog)
    this.emit('progress', { phase: 'review', current: 1, total: 1, message: `${reviewed.length} entries after review` } as WorldDistillProgress)

    const dimCovered = new Set(reviewed.map((e) => e.meta.dimension).filter(Boolean)).size
    agentLog?.worldDistillEnd({ entries: reviewed.length, dimensions: dimCovered, totalDurationMs: Date.now() - distillStartTime })

    return reviewed
  }

  /**
   * History dimension's independent three-pass distill:
   * - Pass A: exhaustively list every time-anchored event (list mode, no analysis)
   * - Pass B: expand each timeline item into a 5-10 sentence event detail (concurrent)
   * - Pass C: extract non-event history content (long-term trends, institutional evolution)
   *
   * Returns GeneratedEntry rows with `chronicleType` tagged for writeEntries to route.
   */
  private async runHistoryThreePass(
    worldName: string,
    combinedText: string,
    defaultScope: EntryScope,
    agentLog?: AgentLogger,
  ): Promise<GeneratedEntry[]> {
    const passStart = Date.now()
    agentLog?.distillPhase('history-three-pass', 'started')

    // --- Pass A: exhaustive timeline extraction ---
    this.emit('progress', {
      phase: 'extract',
      current: 0,
      total: 3,
      message: 'history: Pass A — listing timeline events...',
      entryDimension: 'history',
      historySubProgress: { pass: 'A', eventsDone: 0, eventsTotal: 0 },
    } as WorldDistillProgress)
    let passAItems: PassAItem[] = []
    try {
      const passAStart = Date.now()
      const { text: passAText } = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a timeline extractor for the world "${worldName}".

Your ONLY job: list EVERY time-anchored event you can find in the provided articles. Do NOT write analysis. Do NOT filter for "importance". Do NOT write long descriptions. Just list events.

CRITICAL: ONLY list events that appear in the provided articles. Do NOT add events from your training-data knowledge of the world or any IP. If an event you "know" about is not in the source, leave it out.

CRITICAL — IN-WORLD ONLY: Only list events that happen INSIDE the fictional world, to the characters, factions, places, or civilizations of the story. You MUST EXCLUDE real-world / meta / production events about the work itself, such as:
- game / novel / manga / anime / CD / soundtrack / drama-CD / Blu-ray / merchandise releases (发售, 発売, release, launch, 出版, 上市)
- broadcast / airing / streaming dates (放送, 配信, aired, broadcast, streamed)
- voice cast / staff announcements, production milestones, awards, sales figures, re-releases, ports, remasters
- any date that belongs to the real calendar of the author / studio / publisher rather than to the story's internal timeline
If an "event" is about the product shipping to customers or being published to the real world, DROP IT, even if the source article clearly lists it with a date.

A time-anchored event has:
- a concrete time label IN THE STORY'S OWN TIMELINE (in-story year, era, numbered war, dynasty, semester, etc.), AND
- a specific happening tied to that time that happens to someone/something INSIDE the story (battle, founding, death, treaty, disaster, confession, transfer, festival, etc.)

For each event, output:
- name: kebab-case English slug (e.g. "battle-of-chibi")
- display_time: the time label as it appears in the source (e.g. "208 年", "第三纪元 3019 年", "第五次圣杯战争")
- sort_key: numeric position on the timeline — use the year if it's an earth-year, otherwise an integer/float that makes the events sort chronologically in this world
- one_line: one sentence, max 100 characters, describing what happened (NO analysis, NO causes, NO consequences)
- source_excerpt: the minimal quote from the source that mentions this event (used later for detail expansion)
- sort_key_inferred: true if you're confident about sort_key from the source, false if you had to guess
- importance: "high" for world-defining events, "medium" for notable events, "low" for minor mentions

RULES:
- List EVERY event, not just the "major" ones. Minor events matter for world density.
- Do NOT skip events because they're too small.
- Do NOT combine multiple events into one entry.
- Do NOT write essay-style descriptions in one_line — keep it to one clause.
- If the same event is described in multiple articles, list it once.

Output a JSON array of objects. No other text. No markdown fences.`,
          },
          { role: 'user', content: combinedText },
        ],
      })

      const passAJson = passAText.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      const parsed = JSON.parse(passAJson)
      passAItems = Array.isArray(parsed) ? parsed : []
      agentLog?.distillBatch('history:pass-a', 1, 1, Date.now() - passAStart, passAText.length)
      this.emit('progress', {
        phase: 'extract',
        current: 0,
        total: 3,
        message: `history: Pass A complete — ${passAItems.length} events found`,
        entryDimension: 'history',
        historySubProgress: { pass: 'A', eventsDone: passAItems.length, eventsTotal: passAItems.length },
      } as WorldDistillProgress)
    } catch (err) {
      agentLog?.toolInternal('ERROR history:pass-a', err instanceof Error ? err.message : String(err))
      passAItems = []
    }

    // Build timeline + events GeneratedEntry rows from Pass A.
    const timelineEntries: GeneratedEntry[] = []
    const passBTasks: { item: PassAItem; index: number }[] = []

    for (let i = 0; i < passAItems.length; i++) {
      const item = passAItems[i]
      if (!item || typeof item !== 'object') continue

      const name = typeof item.name === 'string' && item.name.length > 0
        ? item.name
        : `history-event-${i}`
      const sortKey = typeof item.sort_key === 'number' ? item.sort_key : i
      const displayTime = typeof item.display_time === 'string' ? item.display_time : undefined
      const oneLine = typeof item.one_line === 'string' ? item.one_line : ''
      const inferred = item.sort_key_inferred === false
      const importance = ['high', 'medium', 'low'].includes(item.importance as string)
        ? item.importance as 'high' | 'medium' | 'low'
        : 'medium'

      const timelineMeta: EntryMeta = {
        name,
        keywords: [],
        priority: importance === 'high' ? 950 : importance === 'medium' ? 800 : 650,
        mode: 'always',
        scope: 'chronicle',
        dimension: 'history',
        sort_key: sortKey,
        ...(displayTime ? { display_time: displayTime } : {}),
        ...(inferred ? { sort_key_inferred: false } : {}),
        importance,
      }

      timelineEntries.push({
        meta: timelineMeta,
        content: oneLine,
        chronicleType: 'timeline',
      })

      passBTasks.push({ item: { ...item, name, sort_key: sortKey, display_time: displayTime }, index: i })
    }

    // --- Pass B: expand each timeline item into an event detail (concurrent) ---
    this.emit('progress', {
      phase: 'extract',
      current: 1,
      total: 3,
      message: `history: Pass B — expanding ${passBTasks.length} events (0/${passBTasks.length})`,
      entryDimension: 'history',
    } as WorldDistillProgress)
    const eventsEntries: GeneratedEntry[] = []
    const passBStart = Date.now()
    let passBDone = 0
    const passBCompletedNames: string[] = []
    for (let i = 0; i < passBTasks.length; i += HISTORY_PASS_B_CONCURRENCY) {
      const batch = passBTasks.slice(i, i + HISTORY_PASS_B_CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(async ({ item }) => {
          const eventStart = Date.now()
          try {
            const { text } = await generateText({
              model: this.model,
              messages: [
                {
                  role: 'system',
                  content: `You are a history event writer for the world "${worldName}".

Given a single historical event and its source excerpt, write a 5-10 sentence detailed description. Explain the causes, key participants, how it unfolded, and its consequences.

CRITICAL RULES:
- Use ONLY information from the source excerpt and the article context provided in the user message.
- Do NOT add information from your training-data knowledge of the world, the IP, or any related works.
- If the source excerpt is sparse, write a SHORTER description rather than padding with invented details.
- Every fact you state must trace back to the provided excerpt or article context.

Output ONLY the description text, no preamble, no markdown headings.`,
                },
                {
                  role: 'user',
                  content: `Event: ${item.display_time ?? ''} — ${item.name}
One-line summary: ${item.one_line ?? ''}

Source excerpt:
${item.source_excerpt ?? ''}

Context (full article):
${combinedText.slice(0, 6000)}`,
                },
              ],
            })

            const body = text.trim()
            const meta: EntryMeta = {
              name: item.name,
              keywords: [item.name.replace(/-/g, ' ')],
              priority: 800,
              mode: 'keyword',
              scope: 'chronicle',
              dimension: 'history',
              sort_key: item.sort_key,
              ...(item.display_time ? { display_time: item.display_time } : {}),
            }
            // Per-event progress
            passBDone++
            passBCompletedNames.push(item.name)
            agentLog?.distillBatch(`history:pass-b:${item.name}`, passBDone, passBTasks.length, Date.now() - eventStart, body.length)
            this.emit('progress', {
              phase: 'extract',
              current: 1,
              total: 3,
              message: `history: Pass B — ${item.name} (${passBDone}/${passBTasks.length})`,
              entryDimension: 'history',
              historySubProgress: {
                pass: 'B',
                eventsDone: passBDone,
                eventsTotal: passBTasks.length,
                currentEvent: item.name,
                completedEvents: [...passBCompletedNames],
              },
            } as WorldDistillProgress)

            return {
              meta,
              content: body,
              chronicleType: 'events' as ChronicleKind,
            }
          } catch (err) {
            passBDone++
            agentLog?.toolInternal(`ERROR history:pass-b:${item.name}`, err instanceof Error ? err.message : String(err))
            return null
          }
        }),
      )
      for (const r of batchResults) {
        if (r) eventsEntries.push(r)
      }
    }
    agentLog?.distillBatch('history:pass-b', 1, 1, Date.now() - passBStart, eventsEntries.length)

    // --- Pass C: non-event history content ---
    this.emit('progress', {
      phase: 'extract',
      current: 2,
      total: 3,
      message: 'history: Pass C — extracting long-term trends...',
      entryDimension: 'history',
      historySubProgress: { pass: 'C', eventsDone: 0, eventsTotal: 0 },
    } as WorldDistillProgress)
    const passCEntries: GeneratedEntry[] = []
    try {
      const passCStart = Date.now()
      const { text: passCText } = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a world-building entry generator for the world "${worldName}".

Pass A of the history pipeline has ALREADY extracted every time-anchored event as a separate timeline entry. Your job is to extract the OTHER kind of history content — long-term trends, institutional evolution, cultural shifts, power transitions — that span eras rather than happen at a single point in time.

CRITICAL: ONLY use information that appears in the provided text. Do NOT add long-term trends or institutional analyses from your training-data knowledge of any IP. If the source doesn't describe a trend, do not invent one.

DO NOT:
- List specific dated events (Pass A already did that)
- Write about single battles, single deaths, or single treaties (those belong to Pass A)
- Add information from your model knowledge that isn't in the source

DO:
- Write about aristocratic class rise/fall, institutional decay, shifting alliances, long-term economic trends, etc. — but ONLY when the source supports it
- 5-10 sentences per entry, analytical tone, explain WHY and HOW
- Generate 0-5 entries — it's fine to return an empty array if the source has no non-event content. **Empty array is the correct answer when source is sparse.**

Output a JSON array of objects, each with:
- name: kebab-case English identifier
- keywords: Array of trigger keywords (multilingual)
- mode: "keyword" or "semantic"
- priority: 0-1000 (core: 800-1000, important: 400-700, details: 0-300)
- content: The entry text (5-10 sentences)

Respond ONLY with the JSON array.`,
          },
          { role: 'user', content: combinedText },
        ],
      })
      agentLog?.distillBatch('history:pass-c', 1, 1, Date.now() - passCStart, passCText.length)

      const passCJson = passCText.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      const parsed = JSON.parse(passCJson)
      const items = Array.isArray(parsed) ? parsed : []

      for (let j = 0; j < items.length; j++) {
        const item = items[j]
        if (!item || typeof item !== 'object') continue
        passCEntries.push({
          meta: {
            name: item.name || `history-trend-${j}`,
            keywords: Array.isArray(item.keywords) ? item.keywords : [],
            priority: typeof item.priority === 'number' ? item.priority : 500,
            mode: (['always', 'keyword', 'semantic'].includes(item.mode) ? item.mode : 'keyword') as EntryMode,
            scope: defaultScope ?? 'background',
            dimension: 'history',
          },
          content: item.content || '',
        })
      }
    } catch (err) {
      agentLog?.toolInternal('ERROR history:pass-c', err instanceof Error ? err.message : String(err))
    }

    agentLog?.distillPhase('history-three-pass', 'done', `${timelineEntries.length} timeline, ${eventsEntries.length} events, ${passCEntries.length} non-event, ${Date.now() - passStart}ms`)

    return [...timelineEntries, ...eventsEntries, ...passCEntries]
  }

  async writeEntries(worldName: string, entries: GeneratedEntry[]): Promise<void> {
    // Collect timeline entries and merge them in one shot so merge conflicts
    // are logged once per batch rather than per entry.
    const timelineBatch: { meta: EntryMeta; content: string }[] = []

    for (const entry of entries) {
      if (entry.chronicleType === 'timeline') {
        timelineBatch.push({
          meta: { ...entry.meta, scope: 'chronicle', dimension: 'history' },
          content: entry.content,
        })
      } else if (entry.chronicleType === 'events') {
        addChronicleEntry(worldName, 'events', entry.meta, entry.content)
      } else {
        addEntry(worldName, entry.meta, entry.content)
      }
    }

    if (timelineBatch.length > 0) {
      mergeIntoTimelineFile(worldName, timelineBatch)
    }

    // Refresh _index.md for every dimension that has entries.
    refreshDimensionIndexes(worldName)

    const manifest = loadWorld(worldName)
    if (manifest) {
      // entry_count tracks normal entries only — chronicle entries live in
      // their own subtree and are not part of the headline count.
      manifest.entry_count = loadAllEntries(worldName).length
      saveWorld(manifest)
    }
  }

  async evolve(
    worldName: string,
    sourcePath: string,
    adapterType: AdapterType,
    agentLog?: AgentLogger,
  ): Promise<{ newEntries: GeneratedEntry[]; conflicts: { name: string; existing: string; generated: string }[] }> {
    const entries = await this.distill(worldName, sourcePath, adapterType, undefined, undefined, agentLog)
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

  private async reviewEntries(entries: GeneratedEntry[], agentLog?: AgentLogger): Promise<GeneratedEntry[]> {
    if (entries.length <= 2) return entries
    agentLog?.distillPhase('review', 'started', `${entries.length} entries`)

    // Exclude timeline entries from the duplicate/quality review — they're
    // governed by Pass A's "list exhaustively" rule and shouldn't be merged.
    const reviewable = entries.filter((e) => e.chronicleType !== 'timeline')
    const passthrough = entries.filter((e) => e.chronicleType === 'timeline')
    if (reviewable.length <= 2) return entries

    const entrySummaries = reviewable.map((e, idx) => {
      const sentenceCount = e.content.split(/[.。!！?？\n]/).filter((s) => s.trim().length > 5).length
      return `[${idx}] "${e.meta.name}" (${e.meta.dimension ?? e.meta.scope}, ${sentenceCount} sentences): ${e.content.slice(0, 150)}...`
    }).join('\n')

    try {
      const reviewStart = Date.now()
      const { text } = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a world-building editor. Review these world entries and identify quality issues.

Find:
1. Entries that overlap significantly and should be merged (return index pairs)
2. Entries with fewer than 2 meaningful sentences that add no value (return indices to delete)

Output JSON only:
{"merges": [[idx1, idx2], ...], "deletes": [idx, ...]}

Be conservative — only merge entries that are truly redundant, and only delete entries that are genuinely too shallow to be useful.`,
          },
          { role: 'user', content: entrySummaries },
        ],
      })
      agentLog?.distillBatch('review', 1, 1, Date.now() - reviewStart, text.length)
      const review = JSON.parse(text) as { merges?: number[][]; deletes?: number[] }

      const toDelete = new Set<number>(review.deletes ?? [])
      const merged = new Set<number>()

      const result = [...reviewable]
      if (review.merges) {
        for (const [idx1, idx2] of review.merges) {
          if (idx1 == null || idx2 == null) continue
          if (idx1 >= reviewable.length || idx2 >= reviewable.length) continue
          if (merged.has(idx1) || merged.has(idx2)) continue

          result[idx1] = {
            meta: result[idx1].meta,
            content: result[idx1].content + '\n\n' + result[idx2].content,
          }
          merged.add(idx2)
        }
      }

      const filtered = result.filter((_, idx) => !toDelete.has(idx) && !merged.has(idx))
      agentLog?.distillPhase('review', 'done', `merged: ${review.merges?.length ?? 0}, deleted: ${review.deletes?.length ?? 0}`)
      return [...filtered, ...passthrough]
    } catch (err) {
      agentLog?.toolInternal('ERROR review', err instanceof Error ? err.message : String(err))
      agentLog?.distillPhase('review', 'done', 'fallback: review failed')
      return entries
    }
  }

  private async classifyChunks(chunks: SoulChunk[], classification?: WorldClassification, customDimensions?: DimensionDef[], agentLog?: AgentLogger): Promise<ClassifiedChunk[]> {
    const results: ClassifiedChunk[] = []

    const allDimNames = customDimensions
      ? customDimensions.map((d) => d.name)
      : ALL_WORLD_DIMENSIONS as string[]
    const dimensionList = customDimensions
      ? customDimensions.map((d) => `${d.name}: ${d.description}`).join('\n')
      : ALL_WORLD_DIMENSIONS.map((d) => `${d}: ${WORLD_DIMENSIONS[d].description}`).join('\n')
    const classificationHint = classification === 'FICTIONAL_UNIVERSE'
      ? 'This is a fictional world setting. Focus on fictional world-building elements.'
      : classification === 'REAL_SETTING'
        ? 'This is a real-world setting. Focus on real-world information.'
        : ''

    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)
    agentLog?.distillPhase('classify', 'started', `${totalBatches} batches`)

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

      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const batchStart = Date.now()
      const { text } = await generateText({
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
      agentLog?.distillBatch('classify', batchNum, totalBatches, Date.now() - batchStart, text.length)
      try {
        const parsed = JSON.parse(text) as { index: number; scope: string; dimension?: string }[]
        for (const item of parsed) {
          const chunk = batch[item.index]
          if (chunk) {
            const scope = ['background', 'rule', 'lore', 'atmosphere', 'irrelevant'].includes(item.scope)
              ? (item.scope as EntryScope | 'irrelevant')
              : 'irrelevant'
            const parsedDim = item.dimension && allDimNames.includes(item.dimension)
              ? item.dimension as WorldDimension
              : undefined
            // Fallback: infer dimension from scope if LLM didn't provide one
            const dimension = parsedDim ?? inferDimensionFromScope(scope === 'irrelevant' ? 'lore' : scope)
            results.push({ chunk, scope, dimension })
          }
        }
        for (let j = 0; j < batch.length; j++) {
          if (!parsed.some((p) => p.index === j)) {
            results.push({ chunk: batch[j], scope: 'irrelevant', dimension: undefined })
          }
        }
      } catch (err) {
        agentLog?.toolInternal(`ERROR classify batch ${batchNum}`, err instanceof Error ? err.message : String(err))
        for (const chunk of batch) {
          results.push({ chunk, scope: 'lore', dimension: inferDimensionFromScope('lore') })
        }
      }
    }

    agentLog?.distillPhase('classify', 'done')
    return results
  }

  private clusterChunks(classified: (ClassifiedChunk & { scope: EntryScope })[]): ChunkCluster[] {
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

  private async extractEntries(worldName: string, clusters: ChunkCluster[], agentLog?: AgentLogger): Promise<GeneratedEntry[]> {
    // Group clusters by dimension for per-dimension merge-then-expand.
    const byDimension = new Map<string, { chunks: SoulChunk[]; scope: EntryScope; dimension?: WorldDimension }>()
    for (const cluster of clusters) {
      const key = cluster.dimension ?? 'unknown'
      if (!byDimension.has(key)) {
        byDimension.set(key, { chunks: [], scope: cluster.scope, dimension: cluster.dimension })
      }
      const group = byDimension.get(key)!
      group.chunks.push(...cluster.chunks)
    }

    const entries: GeneratedEntry[] = []
    const dimensionGroups = Array.from(byDimension.entries())

    for (let i = 0; i < dimensionGroups.length; i++) {
      const [dimKey, group] = dimensionGroups[i]
      this.emit('progress', {
        phase: 'extract',
        current: i,
        total: dimensionGroups.length,
        message: `Extracting entries for dimension: ${dimKey}`,
        entryDimension: group.dimension,
        generatedEntries: entries.map((e) => ({ name: e.meta.name, dimension: e.meta.dimension, scope: e.meta.scope })),
      } as WorldDistillProgress)

      const combinedContent = group.chunks.map((c) => c.content).join('\n\n').slice(0, 8000)

      // History dimension → route to three-pass flow.
      if (group.dimension === 'history') {
        try {
          const historyEntries = await this.runHistoryThreePass(worldName, combinedContent, group.scope, agentLog)
          entries.push(...historyEntries)
        } catch (err) {
          agentLog?.toolInternal(`ERROR extract:history`, err instanceof Error ? err.message : String(err))
        }
        continue
      }

      const extractStart = Date.now()
      const { text } = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a world-building entry generator. From the provided text about the "${dimKey}" dimension, create 2-5 detailed world entries.

CRITICAL RULES:
- ONLY extract information that appears in the provided text. Do NOT add information from your training-data knowledge of any IP, world, or fictional setting.
- Every fact in an entry MUST come from the provided text.
- If the text doesn't contain enough information for 2 entries, generate FEWER entries (even just 1) rather than padding with invented content.
- Initial correctness from the source data outweighs entry count quotas.

Each entry should be 5-10 sentences. Explain WHY and HOW, not just WHAT. Include causes, consequences, mechanisms, and relationships. Do NOT write single-sentence entries.

Output a JSON array of objects, each with:
- name: kebab-case English identifier (e.g., "battle-of-chibi")
- display_name: Human-readable name
- keywords: Array of trigger keywords (mix of languages if content is multilingual)
- mode: "always" for core rules, "keyword" for specific topics, "semantic" for general knowledge
- priority: 0-1000 (higher = more important. Core rules: 800-1000, important lore: 400-700, details: 0-300)
- content: The world entry text, detailed and analytical (5-10 sentences minimum)

The scope is: ${group.scope}

Respond ONLY with the JSON array, no other text.`,
          },
          { role: 'user', content: combinedContent },
        ],
      })
      agentLog?.distillBatch(`extract:${dimKey}`, i + 1, dimensionGroups.length, Date.now() - extractStart, text.length)
      try {
        const parsed = JSON.parse(text)
        const items = Array.isArray(parsed) ? parsed : [parsed]

        for (let j = 0; j < items.length; j++) {
          const item = items[j] as {
            name?: string
            keywords?: string[]
            mode?: string
            priority?: number
            content?: string
          }

          const mode = (['always', 'keyword', 'semantic'].includes(item.mode ?? '') ? item.mode : 'keyword') as EntryMode

          entries.push({
            meta: {
              name: item.name || `entry-${dimKey}-${j}`,
              keywords: Array.isArray(item.keywords) ? item.keywords : [],
              priority: typeof item.priority === 'number' ? item.priority : 100,
              mode,
              scope: group.scope,
              ...(group.dimension ? { dimension: group.dimension } : {}),
            },
            content: item.content || combinedContent.slice(0, 1000),
          })
        }
      } catch (err) {
        agentLog?.toolInternal(`ERROR extract:${dimKey}`, err instanceof Error ? err.message : String(err))
        entries.push({
          meta: {
            name: `entry-${dimKey}`,
            keywords: [],
            priority: 100,
            mode: 'semantic',
            scope: group.scope,
            ...(group.dimension ? { dimension: group.dimension } : {}),
          },
          content: combinedContent.slice(0, 2000),
        })
      }
    }

    return entries
  }
}

// Shape of an item returned by Pass A's LLM call.
interface PassAItem {
  name: string
  display_time?: string
  sort_key: number
  one_line?: string
  source_excerpt?: string
  sort_key_inferred?: boolean
  importance?: 'high' | 'medium' | 'low'
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
