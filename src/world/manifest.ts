import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { WorldType, WorldClassification, WorldDimension } from './capture/world-dimensions.js'
import type { DimensionDef } from '../infra/agent/dimension-framework.js'
import type { WorldTagSet } from './tags/world-taxonomy.js'
import { emptyWorldTagSet } from './tags/world-taxonomy.js'

export interface WorldDefaults {
  context_budget: number
  injection_position: 'before_soul' | 'after_soul' | 'interleaved'
}

export interface WorldEvolveHistoryEntry {
  timestamp: string
  sources: { type: string; path_or_url?: string; entry_count: number }[]
  dimensions_updated: WorldDimension[]
  total_entries_after: number
}

export interface WorldManifest {
  name: string
  display_name: string
  version: string
  created_at: string
  description: string
  entry_count: number
  defaults: WorldDefaults

  // New fields
  worldType: WorldType
  classification?: WorldClassification
  tags: WorldTagSet
  sources?: { type: string; path_or_url?: string }[]
  origin?: string
  evolve_history?: WorldEvolveHistoryEntry[]
  /** Dimension plan from Planning Agent (base + extensions) */
  dimensions?: DimensionDef[]
}

export function getWorldsDir(): string {
  return path.join(os.homedir(), '.soulkiller', 'worlds')
}

export function getWorldDir(name: string): string {
  return path.join(getWorldsDir(), name)
}

export function createWorldManifest(
  name: string,
  displayName: string,
  description: string,
  worldType: WorldType = 'fictional-existing',
  tags: WorldTagSet = emptyWorldTagSet(),
): WorldManifest {
  return {
    name,
    display_name: displayName,
    version: '0.1.0',
    created_at: new Date().toISOString(),
    description,
    entry_count: 0,
    defaults: {
      context_budget: 2000,
      injection_position: 'after_soul',
    },
    worldType,
    tags,
    evolve_history: [],
  }
}

export function createWorld(
  name: string,
  displayName: string,
  description: string,
  worldType: WorldType = 'fictional-existing',
  tags: WorldTagSet = emptyWorldTagSet(),
): WorldManifest {
  const worldDir = getWorldDir(name)
  if (fs.existsSync(worldDir)) {
    throw new Error(`World "${name}" already exists`)
  }

  // Create the world root directory. Dimension subdirectories are created
  // lazily by addEntry() when the first entry of each dimension is written.
  fs.mkdirSync(worldDir, { recursive: true })

  const manifest = createWorldManifest(name, displayName, description, worldType, tags)
  fs.writeFileSync(
    path.join(worldDir, 'world.json'),
    JSON.stringify(manifest, null, 2),
  )

  return manifest
}

export function loadWorld(name: string): WorldManifest | null {
  const manifestPath = path.join(getWorldDir(name), 'world.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
    // Backward compatibility: fill in missing new fields
    return {
      name: String(raw.name ?? ''),
      display_name: String(raw.display_name ?? ''),
      version: String(raw.version ?? '0.1.0'),
      created_at: String(raw.created_at ?? ''),
      description: String(raw.description ?? ''),
      entry_count: typeof raw.entry_count === 'number' ? raw.entry_count : 0,
      defaults: (raw.defaults as WorldDefaults) ?? { context_budget: 2000, injection_position: 'after_soul' },
      worldType: (raw.worldType as WorldType) ?? 'fictional-existing',
      classification: raw.classification as WorldClassification | undefined,
      tags: (raw.tags as WorldTagSet) ?? emptyWorldTagSet(),
      sources: raw.sources as { type: string; path_or_url?: string }[] | undefined,
      origin: raw.origin as string | undefined,
      evolve_history: (raw.evolve_history as WorldEvolveHistoryEntry[]) ?? [],
      dimensions: raw.dimensions as DimensionDef[] | undefined,
    }
  } catch {
    return null
  }
}

export function saveWorld(manifest: WorldManifest): void {
  const worldDir = getWorldDir(manifest.name)
  fs.writeFileSync(
    path.join(worldDir, 'world.json'),
    JSON.stringify(manifest, null, 2),
  )
}

export function deleteWorld(name: string): void {
  const worldDir = getWorldDir(name)
  if (!fs.existsSync(worldDir)) {
    throw new Error(`World "${name}" does not exist`)
  }
  fs.rmSync(worldDir, { recursive: true })
}

export function listWorlds(): WorldManifest[] {
  if (!fs.existsSync(getWorldsDir())) return []

  try {
    const entries = fs.readdirSync(getWorldsDir(), { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => loadWorld(e.name))
      .filter((m): m is WorldManifest => m !== null)
  } catch {
    return []
  }
}

export function worldExists(name: string): boolean {
  return fs.existsSync(path.join(getWorldDir(name), 'world.json'))
}

export function bumpPatchVersion(version: string): string {
  const parts = version.split('.')
  const patch = parseInt(parts[2] ?? '0', 10) + 1
  return `${parts[0]}.${parts[1]}.${patch}`
}
