import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface WorldDefaults {
  context_budget: number
  injection_position: 'before_soul' | 'after_soul' | 'interleaved'
}

export interface WorldManifest {
  name: string
  display_name: string
  version: string
  created_at: string
  description: string
  entry_count: number
  defaults: WorldDefaults
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
  }
}

export function createWorld(
  name: string,
  displayName: string,
  description: string,
): WorldManifest {
  const worldDir = getWorldDir(name)
  if (fs.existsSync(worldDir)) {
    throw new Error(`World "${name}" already exists`)
  }

  const entriesDir = path.join(worldDir, 'entries')
  fs.mkdirSync(entriesDir, { recursive: true })

  const manifest = createWorldManifest(name, displayName, description)
  fs.writeFileSync(
    path.join(worldDir, 'world.json'),
    JSON.stringify(manifest, null, 2),
  )

  return manifest
}

export function loadWorld(name: string): WorldManifest | null {
  const manifestPath = path.join(getWorldDir(name), 'world.json')
  if (!fs.existsSync(manifestPath)) return null
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as WorldManifest
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
