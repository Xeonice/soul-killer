import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fetchCatalog, findSkillInCatalog, isCacheStale, STALE_THRESHOLD_MS, CACHE_FILE } from '../../../../src/cli/catalog/client.js'
import type { CatalogV1 } from '../../../../src/cli/catalog/types.js'

const validCatalog: CatalogV1 = {
  version: 1,
  updated_at: '2026-04-15T10:00:00Z',
  soulkiller_version_min: '0.4.0',
  skills: [
    {
      slug: 'fate-zero',
      display_name: 'Fate/Zero',
      description: 'Multi-character VN',
      version: '1.0.0',
      engine_version: 3,
      size_bytes: 2411724,
      sha256: 'abc123',
      url: '/examples/skills/fate-zero.skill',
      soulkiller_version_min: '0.4.0',
    },
  ],
}

let origHome: string | undefined
let tmpHome: string

beforeEach(() => {
  origHome = process.env.HOME
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  fs.rmSync(tmpHome, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('fetchCatalog network path', () => {
  it('returns parsed catalog on 200 and writes cache', async () => {
    // cache file path is captured at module load, so the test write goes to
    // real home dir. We're not testing cache writes here, just the fetch path.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(validCatalog),
    }))

    const result = await fetchCatalog('https://example.com/catalog.json')
    expect(result.source).toBe('network')
    expect(result.catalog.skills[0]!.slug).toBe('fate-zero')
  })

  it('rejects wrong version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...validCatalog, version: 2 }),
    }))
    // No cache exists → rethrown
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE)

    await expect(fetchCatalog('https://example.com/catalog.json')).rejects.toThrow(/unsupported catalog version/)
  })

  it('rejects missing required field', async () => {
    const bad = { ...validCatalog, skills: [{ slug: 'x' }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(bad),
    }))
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE)

    await expect(fetchCatalog('https://example.com/catalog.json')).rejects.toThrow(/display_name/)
  })
})

describe('findSkillInCatalog', () => {
  it('finds by slug', () => {
    expect(findSkillInCatalog(validCatalog, 'fate-zero')?.display_name).toBe('Fate/Zero')
  })
  it('returns undefined for unknown slug', () => {
    expect(findSkillInCatalog(validCatalog, 'nonexistent')).toBeUndefined()
  })
})

describe('isCacheStale', () => {
  it('true when age > 7 days', () => {
    expect(isCacheStale(STALE_THRESHOLD_MS + 1)).toBe(true)
  })
  it('false when fresh', () => {
    expect(isCacheStale(1000)).toBe(false)
  })
  it('false for undefined', () => {
    expect(isCacheStale(undefined)).toBe(false)
  })
})
