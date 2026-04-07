/**
 * Chronicle module — manages a world's structured timeline of major events.
 *
 * New layout (dimension-directory refactor):
 *
 *   history/
 *   ├── _index.md          ← dimension overview (author view, skipped at runtime)
 *   ├── timeline.md        ← single aggregated file, parsed by `## ` sections
 *   ├── events/            ← detail layer, one .md per event, recalled on demand
 *   │   ├── battle-of-chibi.md
 *   │   └── ...
 *   └── <name>.md          ← non-event history entries (long-term trends)
 *
 * `timeline.md` is a single markdown file: each `## <display_time> — <title>`
 * heading delimits one timeline entry. Metadata lines under the heading use
 * block-quote syntax (`> sort_key: 208`, `> display_time: "208 年"`,
 * `> ref: ./events/battle-of-chibi.md`, `> importance: high`). Remaining
 * body text is the one-line description.
 *
 * `sort_key` is a plain numeric position. The system never interprets its
 * meaning — earth years, fractional months, Fate war count, Middle-earth
 * ages all share the same field. `display_time` is the human-readable
 * label that the LLM actually sees.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  serializeFrontmatter,
  getHistoryEventsDir,
  getHistoryTimelinePath,
  type EntryMeta,
  type WorldEntry,
} from './entry.js'

export type ChronicleKind = 'timeline' | 'events'

/**
 * Parse a single `history/timeline.md` file into an array of WorldEntry.
 * Each `## ` heading starts one entry; metadata lines (`> key: value`)
 * follow; the remaining prose becomes the one-line body.
 */
export function parseTimelineFile(filePath: string): WorldEntry[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')

  // Strip frontmatter if present.
  let content = raw
  if (content.trimStart().startsWith('---')) {
    const trimmed = content.trimStart()
    const end = trimmed.indexOf('\n---', 3)
    if (end !== -1) {
      content = trimmed.slice(end + 4)
    }
  }

  const entries: WorldEntry[] = []
  // Split by `## ` sections. The leading `#` title (if any) is discarded.
  const sections = content.split(/^##\s+/m).slice(1)

  for (const section of sections) {
    const lines = section.split('\n')
    const headingLine = lines.shift() ?? ''
    const heading = headingLine.trim()

    // Extract metadata from `> key: value` lines and collect remaining body.
    const metaFromQuotes: Record<string, string> = {}
    const bodyLines: string[] = []
    for (const line of lines) {
      const quoteMatch = line.match(/^>\s*([a-z_]+)\s*:\s*(.*)$/i)
      if (quoteMatch) {
        metaFromQuotes[quoteMatch[1]] = quoteMatch[2].trim()
        continue
      }
      bodyLines.push(line)
    }

    const body = bodyLines.join('\n').trim()

    // Resolve name: prefer explicit metadata, else derive from `ref` stem,
    // else slugify the heading tail (after the `—`/`-` separator).
    const refRaw = metaFromQuotes.ref
    const refStem = refRaw ? path.basename(refRaw).replace(/\.md$/, '') : undefined
    const name = metaFromQuotes.name || refStem || slugifyHeading(heading)

    // sort_key: numeric
    const sortKeyRaw = metaFromQuotes.sort_key
    const sort_key = sortKeyRaw && /^-?\d+(\.\d+)?$/.test(sortKeyRaw)
      ? Number(sortKeyRaw)
      : undefined

    // display_time: strip surrounding quotes if any. Fall back to the
    // heading prefix (everything before the first ` — ` / ` - ` separator).
    const displayTimeRaw = metaFromQuotes.display_time
    const display_time = displayTimeRaw
      ? displayTimeRaw.replace(/^["']|["']$/g, '')
      : extractDisplayTimeFromHeading(heading)

    // importance
    const importanceRaw = metaFromQuotes.importance as 'high' | 'medium' | 'low' | undefined
    const importance = importanceRaw && ['high', 'medium', 'low'].includes(importanceRaw)
      ? importanceRaw
      : undefined

    const sortKeyInferredFlag = metaFromQuotes.sort_key_inferred === 'false'

    const meta: EntryMeta = {
      name,
      keywords: [],
      priority: 950,
      mode: 'always',
      scope: 'chronicle',
      dimension: 'history',
      ...(typeof sort_key === 'number' ? { sort_key } : {}),
      ...(display_time ? { display_time } : {}),
      ...(refStem ? { event_ref: refStem } : {}),
      ...(importance ? { importance } : {}),
      ...(sortKeyInferredFlag ? { sort_key_inferred: false } : {}),
    }

    entries.push({ meta, content: body })
  }

  return entries
}

function slugifyHeading(heading: string): string {
  // Strip leading time label before ` — ` / ` - `.
  const tail = heading.split(/\s[—-]\s/).slice(1).join(' — ') || heading
  return tail
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chronicle-entry'
}

function extractDisplayTimeFromHeading(heading: string): string | undefined {
  const match = heading.match(/^([^—-]+)\s*[—-]\s*/)
  return match ? match[1].trim() : undefined
}

/**
 * Serialize an array of WorldEntry into the `history/timeline.md` single
 * file format. Entries are sorted by sort_key ascending (entries without a
 * sort_key go last, preserving relative order among themselves).
 */
export function writeTimelineFile(
  worldName: string,
  entries: WorldEntry[],
  title?: string,
): void {
  const filePath = getHistoryTimelinePath(worldName)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const sorted = [...entries].sort((a, b) => {
    const ka = typeof a.meta.sort_key === 'number' ? a.meta.sort_key : Number.POSITIVE_INFINITY
    const kb = typeof b.meta.sort_key === 'number' ? b.meta.sort_key : Number.POSITIVE_INFINITY
    if (ka !== kb) return ka - kb
    return a.meta.name.localeCompare(b.meta.name)
  })

  const heading = title ?? `${worldName} 编年史`
  const sections: string[] = []

  for (const entry of sorted) {
    const time = entry.meta.display_time?.trim() ?? ''
    const sectionTitle = time ? `${time} — ${entry.meta.name}` : entry.meta.name
    const lines: string[] = [`## ${sectionTitle}`]
    if (typeof entry.meta.sort_key === 'number') {
      lines.push(`> sort_key: ${entry.meta.sort_key}`)
    }
    if (time) {
      lines.push(`> display_time: "${time.replace(/"/g, '\\"')}"`)
    }
    if (entry.meta.event_ref) {
      lines.push(`> ref: ./events/${entry.meta.event_ref}.md`)
    } else {
      lines.push(`> ref: ./events/${entry.meta.name}.md`)
    }
    if (entry.meta.importance) {
      lines.push(`> importance: ${entry.meta.importance}`)
    }
    if (entry.meta.sort_key_inferred === false) {
      lines.push(`> sort_key_inferred: false`)
    }
    lines.push('')
    lines.push(entry.content.trim())
    sections.push(lines.join('\n'))
  }

  const frontmatter = `---
type: chronicle-timeline
dimension: history
mode: always
---

`
  const body = `# ${heading}\n\n${sections.join('\n\n')}\n`
  fs.writeFileSync(filePath, frontmatter + body)
}

/**
 * Merge `newEntries` into the existing `history/timeline.md`. Entries with
 * a stem already present in the file are preserved (author edits win);
 * new stems are inserted and the resulting list re-sorted by sort_key.
 * Logs a warn-level message for each conflict via the optional logger.
 */
export function mergeIntoTimelineFile(
  worldName: string,
  newEntries: WorldEntry[],
  warnLogger?: (msg: string) => void,
): void {
  const existing = loadChronicleTimeline(worldName)
  const existingNames = new Set(existing.map((e) => e.meta.name))

  const merged: WorldEntry[] = [...existing]
  for (const entry of newEntries) {
    if (existingNames.has(entry.meta.name)) {
      warnLogger?.(`Chronicle conflict: ${entry.meta.name} kept author version`)
      continue
    }
    merged.push(entry)
    existingNames.add(entry.meta.name)
  }

  writeTimelineFile(worldName, merged)
}

export function loadChronicleTimeline(worldName: string): WorldEntry[] {
  return parseTimelineFile(getHistoryTimelinePath(worldName))
}

export function loadChronicleEvents(worldName: string): WorldEntry[] {
  const dir = getHistoryEventsDir(worldName)
  if (!fs.existsSync(dir)) return []
  const results: WorldEntry[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue
    if (f.startsWith('_')) continue
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    const entry = parseChronicleEventFile(raw, f)
    if (entry) results.push(entry)
  }
  return results
}

function parseChronicleEventFile(raw: string, filename: string): WorldEntry | null {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) {
    // No frontmatter — treat entire file as body with derived name.
    return {
      meta: {
        name: filename.replace(/\.md$/, ''),
        keywords: [],
        priority: 800,
        mode: 'keyword',
        scope: 'chronicle',
        dimension: 'history',
      },
      content: raw.trim(),
    }
  }

  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return null
  const yamlBlock = trimmed.slice(4, end).trim()
  const body = trimmed.slice(end + 4).trim()

  const rawMeta: Record<string, unknown> = {}
  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    const rawValue = line.slice(colonIndex + 1).trim()
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1)
      rawMeta[key] = inner.trim() === ''
        ? []
        : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
    } else if (rawValue === 'true') rawMeta[key] = true
    else if (rawValue === 'false') rawMeta[key] = false
    else if (/^-?\d+(\.\d+)?$/.test(rawValue)) rawMeta[key] = Number(rawValue)
    else rawMeta[key] = rawValue.replace(/^["']|["']$/g, '')
  }

  const name = String(rawMeta.name ?? filename.replace(/\.md$/, ''))
  const keywords = Array.isArray(rawMeta.keywords) ? rawMeta.keywords.map(String) : []
  const priority = typeof rawMeta.priority === 'number' ? rawMeta.priority : 800
  const mode = (['always', 'keyword', 'semantic'].includes(String(rawMeta.mode))
    ? String(rawMeta.mode)
    : 'keyword') as EntryMeta['mode']

  const meta: EntryMeta = {
    name,
    keywords,
    priority,
    mode,
    scope: 'chronicle',
    dimension: 'history',
    ...(typeof rawMeta.sort_key === 'number' ? { sort_key: rawMeta.sort_key } : {}),
    ...(typeof rawMeta.display_time === 'string' && rawMeta.display_time.length > 0
      ? { display_time: rawMeta.display_time as string }
      : {}),
    ...(typeof rawMeta.event_ref === 'string' && (rawMeta.event_ref as string).length > 0
      ? { event_ref: rawMeta.event_ref as string }
      : {}),
    ...(rawMeta.sort_key_inferred === false ? { sort_key_inferred: false } : {}),
  }

  return { meta, content: body }
}

/**
 * Write a chronicle entry to its kind-specific location.
 * - `timeline` → merges into `history/timeline.md` single file
 * - `events`   → writes `history/events/<name>.md`
 *
 * Forces `scope` to `'chronicle'` and `dimension` to `'history'` regardless
 * of the input meta to keep the storage layout in sync with the semantics.
 */
export function addChronicleEntry(
  worldName: string,
  kind: ChronicleKind,
  meta: EntryMeta,
  content: string,
): void {
  const finalMeta: EntryMeta = {
    ...meta,
    scope: 'chronicle',
    dimension: 'history',
  }

  if (kind === 'timeline') {
    mergeIntoTimelineFile(worldName, [{ meta: finalMeta, content }])
    return
  }

  // events — individual file under history/events/
  const dir = getHistoryEventsDir(worldName)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${finalMeta.name}.md`)
  fs.writeFileSync(filePath, serializeFrontmatter(finalMeta, content))
}

export function loadChronicleEntry(
  worldName: string,
  kind: ChronicleKind,
  entryName: string,
): WorldEntry | null {
  if (kind === 'timeline') {
    const all = loadChronicleTimeline(worldName)
    return all.find((e) => e.meta.name === entryName) ?? null
  }
  const filePath = path.join(getHistoryEventsDir(worldName), `${entryName}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parseChronicleEventFile(raw, path.basename(filePath))
}

export function removeChronicleEntry(
  worldName: string,
  kind: ChronicleKind,
  entryName: string,
): void {
  if (kind === 'timeline') {
    const existing = loadChronicleTimeline(worldName)
    const filtered = existing.filter((e) => e.meta.name !== entryName)
    if (filtered.length === existing.length) return
    writeTimelineFile(worldName, filtered)
    return
  }
  const filePath = path.join(getHistoryEventsDir(worldName), `${entryName}.md`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

/**
 * Sort chronicle entries by `sort_key` ascending. Entries with a missing or
 * non-numeric sort_key are pushed to the end (treated as +Infinity) so they
 * remain visible but don't disrupt the ordered prefix.
 */
export function sortByChronicle(entries: WorldEntry[]): WorldEntry[] {
  return [...entries].sort((a, b) => {
    const ka = typeof a.meta.sort_key === 'number' ? a.meta.sort_key : Number.POSITIVE_INFINITY
    const kb = typeof b.meta.sort_key === 'number' ? b.meta.sort_key : Number.POSITIVE_INFINITY
    if (ka === kb) return a.meta.name.localeCompare(b.meta.name)
    return ka - kb
  })
}
