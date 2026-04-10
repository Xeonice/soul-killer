import fs from 'node:fs'
import path from 'node:path'
import { getWorldDir } from './manifest.js'
import type { WorldDimension } from "./capture/world-dimensions.js";

export type EntryMode = 'always' | 'keyword' | 'semantic'
export type EntryScope =
  | "background"
  | "rule"
  | "lore"
  | "atmosphere"
  | "chronicle";

/**
 * The canonical list of world dimensions that can appear as top-level
 * subdirectories under a world directory. Kept in sync with
 * `WorldDimension` union type in agent/strategy/world-dimensions.ts — this
 * constant lives here (rather than being imported) to avoid a circular
 * dependency with the agent layer.
 */
export const ALL_DIMENSION_DIRS: WorldDimension[] = [
  "geography",
  "history",
  "factions",
  "systems",
  "society",
  "culture",
  "species",
  "figures",
  "atmosphere",
];

export interface EntryMeta {
  name: string;
  keywords: string[];
  priority: number;
  mode: EntryMode;
  scope: EntryScope;
  /**
   * REQUIRED in the dimension-subdirectory layout: determines which
   * subdirectory the entry lives in. `addEntry` will fall back to
   * `inferDimensionFromScope(scope)` if this is missing, but normal flow
   * expects every entry to carry a dimension.
   */
  dimension?: WorldDimension;
  /**
   * Chronicle-only fields (only meaningful when scope === 'chronicle').
   * sort_key is a numeric position on the world's timeline used for ordering
   * and (future) hard-time filtering. Its semantics are not interpreted by
   * the system; the world author / distill agent decides the scale.
   */
  sort_key?: number;
  /**
   * Human-readable time label shown to the LLM (e.g. "2020 年 8 月",
   * "第五次圣杯战争"). Decoupled from sort_key so that exotic calendars
   * still display naturally.
   */
  display_time?: string;
  /**
   * Chronicle timeline-only: slug of the matching detailed event entry
   * under history/events/. Parsed from `> ref: ./events/<stem>.md` in
   * timeline.md, or auto-inferred from same-stem matching.
   */
  event_ref?: string;
  /**
   * Chronicle-only marker. When the distill agent could not extract a
   * reliable time anchor and fell back to a heuristic sort_key, this is
   * set to false so the interactive review can flag it for the user.
   * Absent or true means the sort_key is trustworthy.
   */
  sort_key_inferred?: boolean;
  /**
   * Chronicle timeline-only: importance tier used for runtime token-budget
   * truncation. When a world's chronicle overflows its budget, low-importance
   * entries are dropped first. Defaults to 'medium' if absent.
   */
  importance?: "high" | "medium" | "low";
}

export interface WorldEntry {
  meta: EntryMeta
  content: string
}

// --- Frontmatter parser (custom, no external deps) ---

export function parseFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: text }
  }

  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    return { meta: {}, body: text }
  }

  const yamlBlock = trimmed.slice(4, endIndex).trim()
  const body = trimmed.slice(endIndex + 4).trim()
  const meta: Record<string, unknown> = {}

  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const rawValue = line.slice(colonIndex + 1).trim()

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      // Parse simple array: ["a", "b", "c"] or [a, b, c]
      const inner = rawValue.slice(1, -1)
      if (inner.trim() === '') {
        meta[key] = []
      } else {
        meta[key] = inner.split(',').map((s) =>
          s.trim().replace(/^["']|["']$/g, '')
        )
      }
    } else if (rawValue === 'true') {
      meta[key] = true
    } else if (rawValue === 'false') {
      meta[key] = false
    } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      meta[key] = Number(rawValue)
    } else {
      meta[key] = rawValue.replace(/^["']|["']$/g, '')
    }
  }

  return { meta, body }
}

export function serializeFrontmatter(meta: EntryMeta, content: string): string {
  const keywordsStr = meta.keywords.length > 0
    ? `[${meta.keywords.map((k) => `"${k}"`).join(', ')}]`
    : '[]'

  const dimensionLine = meta.dimension ? `\ndimension: ${meta.dimension}` : ''
  const sortKeyLine =
    typeof meta.sort_key === "number" ? `\nsort_key: ${meta.sort_key}` : "";
  // Wrap display_time in quotes to survive the simple parser (it strips
  // surrounding quotes on read).
  const displayTimeLine = meta.display_time
    ? `\ndisplay_time: "${meta.display_time.replace(/"/g, '\\"')}"`
    : "";
  const eventRefLine = meta.event_ref ? `\nevent_ref: ${meta.event_ref}` : "";
  // Only emit sort_key_inferred when explicitly false (the meaningful case).
  const sortKeyInferredLine =
    meta.sort_key_inferred === false ? `\nsort_key_inferred: false` : "";
  const importanceLine = meta.importance
    ? `\nimportance: ${meta.importance}`
    : "";

  return `---
name: ${meta.name}
keywords: ${keywordsStr}
priority: ${meta.priority}
mode: ${meta.mode}
scope: ${meta.scope}${dimensionLine}${sortKeyLine}${displayTimeLine}${eventRefLine}${sortKeyInferredLine}${importanceLine}
---

${content}
`;
}

const VALID_DIMENSIONS = ALL_DIMENSION_DIRS as readonly string[];

const VALID_SCOPES = ["background", "rule", "lore", "atmosphere", "chronicle"];

export function parseEntryMeta(raw: Record<string, unknown>): EntryMeta {
  const dimension =
    typeof raw.dimension === "string" &&
    VALID_DIMENSIONS.includes(raw.dimension)
      ? (raw.dimension as WorldDimension)
      : undefined;

  const importance =
    typeof raw.importance === "string" &&
    ["high", "medium", "low"].includes(raw.importance)
      ? (raw.importance as "high" | "medium" | "low")
      : undefined;

  return {
    name: String(raw.name ?? ""),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    priority: typeof raw.priority === "number" ? raw.priority : 100,
    mode: (["always", "keyword", "semantic"].includes(String(raw.mode))
      ? String(raw.mode)
      : "keyword") as EntryMode,
    scope: (VALID_SCOPES.includes(String(raw.scope))
      ? String(raw.scope)
      : "lore") as EntryScope,
    ...(dimension ? { dimension } : {}),
    ...(typeof raw.sort_key === "number" ? { sort_key: raw.sort_key } : {}),
    ...(typeof raw.display_time === "string" && raw.display_time.length > 0
      ? { display_time: raw.display_time }
      : {}),
    ...(typeof raw.event_ref === "string" && raw.event_ref.length > 0
      ? { event_ref: raw.event_ref }
      : {}),
    // Only carry sort_key_inferred when explicitly false; default (absent) means trustworthy.
    ...(raw.sort_key_inferred === false ? { sort_key_inferred: false } : {}),
    ...(importance ? { importance } : {}),
  };
}

// --- Path resolution (central) ---

/**
 * Map a scope to a default dimension for entries that arrive without an
 * explicit dimension field. Keep in sync with the capture strategy fallback
 * — the mapping is used both by the classify fallback and by addEntry's
 * directory routing.
 */
export function inferDimensionFromScope(scope: EntryScope): WorldDimension {
  switch (scope) {
    case 'background': return 'history'
    case 'rule': return 'systems'
    case 'atmosphere': return 'atmosphere'
    case 'lore': return 'factions'
    case 'chronicle': return 'history'
  }
}

/** `<worldDir>/<dimension>` — the top-level subdirectory for a dimension. */
export function getDimensionDir(worldName: string, dimension: WorldDimension): string {
  return path.join(getWorldDir(worldName), dimension)
}

/**
 * Resolve an entry's on-disk file path from its meta. Uses
 * `meta.dimension`, falling back to `inferDimensionFromScope(meta.scope)`
 * when missing.
 */
export function getEntryPath(worldName: string, meta: EntryMeta): string {
  const dim = meta.dimension ?? inferDimensionFromScope(meta.scope)
  return path.join(getDimensionDir(worldName, dim), `${meta.name}.md`)
}

/** `<worldDir>/history/events` — detail layer directory. */
export function getHistoryEventsDir(worldName: string): string {
  return path.join(getWorldDir(worldName), 'history', 'events')
}

/** `<worldDir>/history/timeline.md` — single aggregated timeline file. */
export function getHistoryTimelinePath(worldName: string): string {
  return path.join(getWorldDir(worldName), 'history', 'timeline.md')
}

// --- CRUD ---

export function addEntry(
  worldName: string,
  meta: EntryMeta,
  content: string,
): void {
  // Normalize: ensure meta carries an explicit dimension for the downstream
  // writers and for consistent frontmatter.
  const dim = meta.dimension ?? inferDimensionFromScope(meta.scope);
  const normalizedMeta: EntryMeta = { ...meta, dimension: dim };
  const dir = getDimensionDir(worldName, dim);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${normalizedMeta.name}.md`);
  fs.writeFileSync(filePath, serializeFrontmatter(normalizedMeta, content));
}

export function loadEntry(
  worldName: string,
  entryName: string,
): WorldEntry | null {
  // Without a dimension hint, scan all known dimension subdirectories for a
  // file matching `<entryName>.md`. This is O(dimensions) which is fine.
  for (const dim of ALL_DIMENSION_DIRS) {
    const filePath = path.join(
      getDimensionDir(worldName, dim),
      `${entryName}.md`,
    );
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    return { meta: parseEntryMeta(meta), content: body };
  }
  return null;
}

/**
 * Load all regular entries across all dimension subdirectories. SKIPS:
 * - Any file whose name starts with `_` (author views like `_index.md`).
 * - `history/events/*` (loaded via `loadChronicleEvents`).
 * - `history/timeline.md` (loaded via `loadChronicleTimeline`).
 */
export function loadAllEntries(worldName: string): WorldEntry[] {
  const results: WorldEntry[] = [];
  for (const dim of ALL_DIMENSION_DIRS) {
    const dir = getDimensionDir(worldName, dim);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      if (f.startsWith("_")) continue;
      // history/timeline.md is a single aggregated file — skip, belongs to chronicle loader.
      if (dim === "history" && f === "timeline.md") continue;
      const full = path.join(dir, f);
      // Skip subdirectories (history/events/). readdirSync returns names; we
      // need a stat check, but fs.readdirSync with { withFileTypes: true } is
      // more efficient — use a try/catch fallback for simplicity.
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
      const raw = fs.readFileSync(full, "utf-8");
      const { meta, body } = parseFrontmatter(raw);
      results.push({ meta: parseEntryMeta(meta), content: body });
    }
  }
  return results;
}

export function removeEntry(worldName: string, entryName: string): void {
  for (const dim of ALL_DIMENSION_DIRS) {
    const filePath = path.join(
      getDimensionDir(worldName, dim),
      `${entryName}.md`,
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return;
    }
  }
}

// --- Dimension index generation ---

/**
 * Write a `_index.md` author-view file inside each non-empty dimension
 * subdirectory. Called by distill/evolve after all entries have been
 * written. `_index.md` is skipped at load time (leading `_`) so it never
 * enters the runtime context.
 */
export function refreshDimensionIndexes(worldName: string): void {
  for (const dim of ALL_DIMENSION_DIRS) {
    const dir = getDimensionDir(worldName, dim);
    if (!fs.existsSync(dir)) continue;

    // Collect regular entries in this dimension (skip _* and history subfiles).
    const entries: WorldEntry[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      if (f.startsWith("_")) continue;
      if (dim === "history" && f === "timeline.md") continue;
      const full = path.join(dir, f);
      try {
        if (!fs.statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      const raw = fs.readFileSync(full, "utf-8");
      const { meta, body } = parseFrontmatter(raw);
      entries.push({ meta: parseEntryMeta(meta), content: body });
    }

    if (entries.length === 0) continue;

    const indexPath = path.join(dir, "_index.md");
    fs.writeFileSync(indexPath, renderDimensionIndex(dim, entries));
  }
}

function renderDimensionIndex(
  dimension: WorldDimension,
  entries: WorldEntry[],
): string {
  // Sort by priority desc so high-priority entries surface at the top.
  const sorted = [...entries].sort((a, b) => b.meta.priority - a.meta.priority);

  const rows = sorted
    .map((e) => {
      const summary = summarizeContent(e.content);
      const linkName = e.meta.name;
      return `| [${linkName}](./${linkName}.md) | ${e.meta.priority} | ${e.meta.mode} | ${summary} |`;
    })
    .join("\n");

  return `---
type: dimension-index
dimension: ${dimension}
entry_count: ${entries.length}
---

# ${dimension} — ${entries.length} entries

| Entry | Priority | Mode | Summary |
| --- | --- | --- | --- |
${rows}
`;
}

function summarizeContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  // Take first sentence (up to 。.!！?？ or newline), cap at 80 chars.
  const firstSentence = trimmed.split(/[。.!！?？\n]/)[0].trim();
  const snippet =
    firstSentence.length > 80
      ? firstSentence.slice(0, 77) + "..."
      : firstSentence;
  // Escape pipes so they don't break the markdown table.
  return snippet.replace(/\|/g, "\\|");
}
