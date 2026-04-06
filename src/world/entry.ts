import fs from 'node:fs'
import path from 'node:path'
import { getWorldDir } from './manifest.js'
import type { WorldDimension } from '../agent/world-dimensions.js'

export type EntryMode = 'always' | 'keyword' | 'semantic'
export type EntryScope = 'background' | 'rule' | 'lore' | 'atmosphere'

export interface EntryMeta {
  name: string
  keywords: string[]
  priority: number
  mode: EntryMode
  scope: EntryScope
  dimension?: WorldDimension
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

  return `---
name: ${meta.name}
keywords: ${keywordsStr}
priority: ${meta.priority}
mode: ${meta.mode}
scope: ${meta.scope}${dimensionLine}
---

${content}
`
}

const VALID_DIMENSIONS = ['geography', 'history', 'factions', 'systems', 'society', 'culture', 'species', 'figures', 'atmosphere']

function parseEntryMeta(raw: Record<string, unknown>): EntryMeta {
  const dimension = typeof raw.dimension === 'string' && VALID_DIMENSIONS.includes(raw.dimension)
    ? raw.dimension as WorldDimension
    : undefined

  return {
    name: String(raw.name ?? ''),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    priority: typeof raw.priority === 'number' ? raw.priority : 100,
    mode: (['always', 'keyword', 'semantic'].includes(String(raw.mode)) ? String(raw.mode) : 'keyword') as EntryMode,
    scope: (['background', 'rule', 'lore', 'atmosphere'].includes(String(raw.scope)) ? String(raw.scope) : 'lore') as EntryScope,
    ...(dimension ? { dimension } : {}),
  }
}

// --- CRUD ---

function entriesDir(worldName: string): string {
  return path.join(getWorldDir(worldName), 'entries')
}

export function addEntry(worldName: string, meta: EntryMeta, content: string): void {
  const dir = entriesDir(worldName)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${meta.name}.md`)
  fs.writeFileSync(filePath, serializeFrontmatter(meta, content))
}

export function loadEntry(worldName: string, entryName: string): WorldEntry | null {
  const filePath = path.join(entriesDir(worldName), `${entryName}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { meta, body } = parseFrontmatter(raw)
  return { meta: parseEntryMeta(meta), content: body }
}

export function loadAllEntries(worldName: string): WorldEntry[] {
  const dir = entriesDir(worldName)
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      return { meta: parseEntryMeta(meta), content: body }
    })
}

export function removeEntry(worldName: string, entryName: string): void {
  const filePath = path.join(entriesDir(worldName), `${entryName}.md`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function updateEntry(worldName: string, meta: EntryMeta, content: string): void {
  addEntry(worldName, meta, content)
}
