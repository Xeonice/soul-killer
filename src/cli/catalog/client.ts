import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import type { CatalogV1 } from './types.js'
import { resolveCatalogUrl } from './url.js'

const CACHE_DIR = path.join(homedir(), '.soulkiller', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'catalog.json')
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export interface CatalogFetchResult {
  catalog: CatalogV1
  source: 'network' | 'cache'
  /** If cache, age in milliseconds */
  ageMs?: number
}

export class CatalogError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'CatalogError'
  }
}

function validateCatalog(raw: unknown): CatalogV1 {
  if (!raw || typeof raw !== 'object') {
    throw new CatalogError('catalog is not an object')
  }
  const c = raw as Record<string, unknown>
  if (c.version !== 1) {
    throw new CatalogError(`unsupported catalog version: ${String(c.version)}`)
  }
  if (typeof c.updated_at !== 'string') throw new CatalogError('missing updated_at')
  if (typeof c.soulkiller_version_min !== 'string') throw new CatalogError('missing soulkiller_version_min')
  if (!Array.isArray(c.skills)) throw new CatalogError('skills must be an array')
  for (const [i, s] of c.skills.entries()) {
    if (!s || typeof s !== 'object') throw new CatalogError(`skills[${i}] not an object`)
    const e = s as Record<string, unknown>
    const required = ['slug', 'display_name', 'description', 'version', 'url', 'sha256', 'soulkiller_version_min'] as const
    for (const k of required) {
      if (typeof e[k] !== 'string') throw new CatalogError(`skills[${i}].${k} missing or not a string`)
    }
    if (typeof e.engine_version !== 'number') throw new CatalogError(`skills[${i}].engine_version missing or not a number`)
    if (typeof e.size_bytes !== 'number') throw new CatalogError(`skills[${i}].size_bytes missing or not a number`)
  }
  return c as unknown as CatalogV1
}

function readCache(): { catalog: CatalogV1; mtimeMs: number } | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    const catalog = validateCatalog(raw)
    const stat = fs.statSync(CACHE_FILE)
    return { catalog, mtimeMs: stat.mtimeMs }
  } catch {
    return null
  }
}

function writeCache(catalog: CatalogV1): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(catalog, null, 2), 'utf8')
  } catch {
    // Cache write failures are non-fatal
  }
}

export async function fetchCatalog(flagUrl?: string): Promise<CatalogFetchResult> {
  const url = resolveCatalogUrl(flagUrl)

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'soulkiller-catalog' } })
    if (!res.ok) throw new CatalogError(`HTTP ${res.status} ${res.statusText}`)
    const raw = await res.json()
    const catalog = validateCatalog(raw)
    writeCache(catalog)
    return { catalog, source: 'network' }
  } catch (err) {
    const cached = readCache()
    if (cached) {
      const ageMs = Date.now() - cached.mtimeMs
      return { catalog: cached.catalog, source: 'cache', ageMs }
    }
    const cause = err instanceof Error ? err.message : String(err)
    throw new CatalogError(
      `catalog unavailable and no local cache; check network or pass --catalog <url>. cause: ${cause}`,
      err,
    )
  }
}

export function findSkillInCatalog(catalog: CatalogV1, slug: string): CatalogV1['skills'][number] | undefined {
  return catalog.skills.find((s) => s.slug === slug)
}

export function isCacheStale(ageMs: number | undefined): boolean {
  return ageMs !== undefined && ageMs > STALE_THRESHOLD_MS
}

export { STALE_THRESHOLD_MS, CACHE_FILE }
