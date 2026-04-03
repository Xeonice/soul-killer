import fs from 'node:fs'
import path from 'node:path'
import type { SoulManifest, SoulType, EvolveHistoryEntry } from './manifest.js'
import { createManifest } from './manifest.js'
import type { TagSet } from '../tags/taxonomy.js'
import { emptyTagSet } from '../tags/taxonomy.js'

/**
 * Generate and write manifest.json for a soul package.
 */
export function generateManifest(
  soulDir: string,
  soulName: string,
  displayName: string,
  description: string,
  chunkCount: number,
  languages: string[] = ['zh'],
  soulType: SoulType = 'public',
  tags: TagSet = emptyTagSet(),
): SoulManifest {
  const manifest = createManifest(soulName, displayName, description, chunkCount, languages, soulType, tags)
  const manifestPath = path.join(soulDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
  return manifest
}

/**
 * Create the full soul package directory structure.
 *   <soulDir>/
 *     manifest.json
 *     soul/
 *       identity.md
 *       style.md
 *       behaviors/
 *     vectors/
 *     examples/
 */
export function packageSoul(soulDir: string): void {
  const dirs = [
    path.join(soulDir, 'soul'),
    path.join(soulDir, 'soul', 'behaviors'),
    path.join(soulDir, 'vectors'),
    path.join(soulDir, 'examples'),
  ]

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Read manifest.json from a soul directory.
 * Ensures evolve_history defaults to [] for backward compatibility.
 */
export function readManifest(soulDir: string): SoulManifest | null {
  const manifestPath = path.join(soulDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as SoulManifest
    if (!manifest.evolve_history) {
      manifest.evolve_history = []
    }
    return manifest
  } catch {
    return null
  }
}

/**
 * Append an evolve history entry to the manifest and save.
 */
export function appendEvolveEntry(soulDir: string, entry: EvolveHistoryEntry): void {
  const manifest = readManifest(soulDir)
  if (!manifest) return

  if (!manifest.evolve_history) {
    manifest.evolve_history = []
  }
  manifest.evolve_history.push(entry)
  manifest.chunk_count = entry.total_chunks_after

  const manifestPath = path.join(soulDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
}
