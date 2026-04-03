import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

export interface LocalSoul {
  name: string
  description: string
  chunkCount: number
  languages?: string[]
}

export function listLocalSouls(): LocalSoul[] {
  if (!fs.existsSync(SOULS_DIR)) return []

  try {
    const entries = fs.readdirSync(SOULS_DIR, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const manifestPath = path.join(SOULS_DIR, e.name, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            return {
              name: e.name,
              description: manifest.description ?? '',
              chunkCount: manifest.chunk_count ?? 0,
              languages: manifest.languages,
            }
          } catch {
            // Invalid manifest, use defaults
          }
        }
        return { name: e.name, description: '', chunkCount: 0 }
      })
  } catch {
    return []
  }
}

export function getSoulsDir(): string {
  return SOULS_DIR
}
