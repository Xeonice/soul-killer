import fs from 'node:fs'
import path from 'node:path'
import { packageSoul, generateManifest, appendEvolveEntry } from '../../../src/soul/package.js'
import { generateSoulFiles } from '../../../src/soul/distill/generator.js'
import type { WorldBinding } from '../../../src/world/binding.js'
import type { SoulType } from '../../../src/soul/manifest.js'
import type { SoulChunk } from '../../../src/infra/ingest/types.js'

export interface BareSoul {
  soulDir: string
  name: string
}

export interface Persona {
  identity?: string
  style?: string
  behaviors?: Array<{ name: string; content: string }>
}

const DEFAULT_PERSONA: Required<Persona> = {
  identity: 'A test soul created for E2E testing. Analytical and precise.',
  style: 'Direct, concise, and technical. Prefers short sentences.',
  behaviors: [{ name: 'default', content: 'Responds helpfully to all queries.' }],
}

const BUILTIN_CHUNKS: SoulChunk[] = [
  {
    id: 'fixture-chunk-001',
    source: 'markdown',
    content: 'Cyberpunk 2077 is an open-world action-adventure RPG set in Night City, a megalopolis obsessed with power and body modification.',
    timestamp: new Date().toISOString(),
    context: 'public',
    type: 'knowledge',
    metadata: { source_file: 'fixture.md' },
  },
  {
    id: 'fixture-chunk-002',
    source: 'markdown',
    content: 'The Soulkiller program was originally developed by Alt Cunningham to digitize human consciousness and store it in a construct.',
    timestamp: new Date().toISOString(),
    context: 'public',
    type: 'knowledge',
    metadata: { source_file: 'fixture.md' },
  },
  {
    id: 'fixture-chunk-003',
    source: 'markdown',
    content: 'Night City is divided into distinct districts including Watson, Westbrook, Heywood, and Pacifica, each with unique cultural identities.',
    timestamp: new Date().toISOString(),
    context: 'public',
    type: 'knowledge',
    metadata: { source_file: 'fixture.md' },
  },
]

export function createBareSoul(
  homeDir: string,
  name: string,
  opts?: { soulType?: SoulType; description?: string },
): BareSoul {
  const soulDir = path.join(homeDir, '.soulkiller', 'souls', name)
  packageSoul(soulDir)
  generateManifest(
    soulDir,
    name,
    name,
    opts?.description ?? `Test soul: ${name}`,
    0,
    ['en'],
    opts?.soulType ?? 'public',
  )
  return { soulDir, name }
}

export function createDistilledSoul(
  homeDir: string,
  name: string,
  persona?: Persona,
): BareSoul {
  const { soulDir } = createBareSoul(homeDir, name)
  const p = { ...DEFAULT_PERSONA, ...persona }
  generateSoulFiles(soulDir, {
    identity: p.identity,
    style: p.style,
    behaviors: p.behaviors,
  })
  return { soulDir, name }
}

export function createEvolvedSoul(
  homeDir: string,
  name: string,
  opts?: {
    persona?: Persona
    chunks?: SoulChunk[]
    evolveHistory?: boolean
  },
): BareSoul & { chunkCount: number } {
  const { soulDir } = createDistilledSoul(homeDir, name, opts?.persona)
  const chunks = opts?.chunks ?? BUILTIN_CHUNKS

  const chunksPath = path.join(soulDir, 'chunks.json')
  fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2))

  if (opts?.evolveHistory !== false) {
    appendEvolveEntry(soulDir, {
      timestamp: new Date().toISOString(),
      sources: [{ type: 'markdown', path_or_url: 'fixture.md', chunk_count: chunks.length }],
      dimensions_updated: ['identity', 'style', 'behaviors'],
      mode: 'full',
      snapshot_id: 'fixture-snapshot-001',
      total_chunks_after: chunks.length,
    })
  }

  return { soulDir, name, chunkCount: chunks.length }
}

export interface TestWorld {
  worldDir: string
  name: string
}

export function createTestWorld(
  homeDir: string,
  name: string,
  opts?: { displayName?: string; description?: string; entries?: Array<{ name: string; content: string }> },
): TestWorld {
  const worldDir = path.join(homeDir, '.soulkiller', 'worlds', name)
  const entriesDir = path.join(worldDir, 'entries')
  fs.mkdirSync(entriesDir, { recursive: true })

  const manifest = {
    name,
    display_name: opts?.displayName ?? name,
    version: '0.1.0',
    created_at: new Date().toISOString(),
    description: opts?.description ?? `Test world: ${name}`,
    entry_count: opts?.entries?.length ?? 1,
    defaults: { context_budget: 2000, injection_position: 'after_soul' },
    worldType: 'fictional-existing',
    tags: {},
    evolve_history: [],
  }
  fs.writeFileSync(path.join(worldDir, 'world.json'), JSON.stringify(manifest, null, 2))

  const entries = opts?.entries ?? [
    { name: 'geography', content: 'Night City is a sprawling megalopolis on the coast of California.' },
  ]
  for (const entry of entries) {
    fs.writeFileSync(
      path.join(entriesDir, `${entry.name}.md`),
      `---\nname: ${entry.name}\nkeywords: []\npriority: 100\nmode: always\nscope: lore\n---\n\n${entry.content}`,
    )
  }

  return { worldDir, name }
}

export function bindWorldToSoul(soulDir: string, worldName: string): void {
  const bindingsDir = path.join(soulDir, 'bindings')
  fs.mkdirSync(bindingsDir, { recursive: true })
  const binding: WorldBinding = {
    world: worldName,
    enabled: true,
    order: 0,
  }
  fs.writeFileSync(path.join(bindingsDir, `${worldName}.json`), JSON.stringify(binding, null, 2))
}
