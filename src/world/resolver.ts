import type { WorldEntry } from './entry.js'
import type { WorldBinding, EntryFilter } from './binding.js'
import type { EngineAdapter } from '../engine/adapter.js'
import type { ChatMessage } from '../llm/stream.js'

export interface ResolvedEntry {
  entry: WorldEntry
  worldName: string
  effectivePriority: number
}

const MAX_ORDER = 1000
const KEYWORD_HISTORY_ROUNDS = 3
const SEMANTIC_THRESHOLD = 0.1

export function resolveEntries(
  entries: WorldEntry[],
  binding: WorldBinding,
  userInput: string,
  recentMessages: ChatMessage[],
): ResolvedEntry[] {
  const filter = binding.entry_filter
  const filtered = applyFilter(entries, filter)
  const resolved: ResolvedEntry[] = []

  const searchText = buildSearchText(userInput, recentMessages)

  for (const entry of filtered) {
    const triggered = checkTrigger(entry, searchText, userInput)
    if (!triggered) continue

    const boost = filter?.priority_boost?.[entry.meta.name] ?? 0
    const effectivePriority =
      (MAX_ORDER - binding.order) * 1000 + entry.meta.priority + boost

    resolved.push({
      entry,
      worldName: binding.world,
      effectivePriority,
    })
  }

  return resolved
}

export async function resolveSemanticEntries(
  entries: WorldEntry[],
  binding: WorldBinding,
  userInput: string,
  engine: EngineAdapter,
): Promise<ResolvedEntry[]> {
  const filter = binding.entry_filter
  const semanticEntries = applyFilter(entries, filter).filter(
    (e) => e.meta.mode === 'semantic',
  )

  if (semanticEntries.length === 0) return []

  const results = await engine.recall(userInput, { limit: 10 })
  const matchedContents = new Set(
    results
      .filter((r) => r.similarity > SEMANTIC_THRESHOLD)
      .map((r) => r.chunk.content),
  )

  const resolved: ResolvedEntry[] = []
  for (const entry of semanticEntries) {
    // Check if any recall result is similar to this entry's content
    // Simple heuristic: check if the entry content shares significant words with results
    const entryWords = new Set(
      entry.content.toLowerCase().split(/\W+/).filter((w) => w.length > 1),
    )
    let matched = false
    for (const content of matchedContents) {
      const resultWords = content.toLowerCase().split(/\W+/).filter((w) => w.length > 1)
      const overlap = resultWords.filter((w) => entryWords.has(w)).length
      if (overlap > 2) {
        matched = true
        break
      }
    }

    if (matched) {
      const boost = filter?.priority_boost?.[entry.meta.name] ?? 0
      const effectivePriority =
        (MAX_ORDER - binding.order) * 1000 + entry.meta.priority + boost
      resolved.push({ entry, worldName: binding.world, effectivePriority })
    }
  }

  return resolved
}

function applyFilter(entries: WorldEntry[], filter?: EntryFilter): WorldEntry[] {
  if (!filter) return entries

  return entries.filter((e) => {
    if (filter.include_scopes && !filter.include_scopes.includes(e.meta.scope)) {
      return false
    }
    if (filter.exclude_entries && filter.exclude_entries.includes(e.meta.name)) {
      return false
    }
    return true
  })
}

function buildSearchText(userInput: string, recentMessages: ChatMessage[]): string {
  const parts = [userInput]
  // Take last N rounds (each round = user + assistant)
  const recent = recentMessages.slice(-(KEYWORD_HISTORY_ROUNDS * 2))
  for (const msg of recent) {
    parts.push(msg.content)
  }
  return parts.join(' ')
}

function checkTrigger(entry: WorldEntry, searchText: string, _userInput: string): boolean {
  switch (entry.meta.mode) {
    case 'always':
      return true
    case 'keyword':
      return matchKeywords(entry.meta.keywords, searchText)
    case 'semantic':
      // Semantic entries are resolved separately via resolveSemanticEntries
      return false
    default:
      return false
  }
}

function matchKeywords(keywords: string[], text: string): boolean {
  if (keywords.length === 0) return false
  const lowerText = text.toLowerCase()
  return keywords.some((kw) => lowerText.includes(kw.toLowerCase()))
}
