import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
import type { CatalogV1 } from '../../../../src/cli/catalog/types.js'
import { installOne, summarize, formatSummaryText } from '../../../../src/cli/skill-install/orchestrator.js'

function makeSkillZip(engineVersion: number): Uint8Array {
  // Archive laid out with a single wrapper dir, as real .skill exports do
  return zipSync({
    'fate-zero/SKILL.md': strToU8('---\nname: fate-zero\n---\nbody'),
    'fate-zero/soulkiller.json': strToU8(JSON.stringify({
      engine_version: engineVersion,
      soulkiller_version: '0.4.0',
      skill_id: 'fate-zero',
    })),
  })
}

function sha256(data: Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

let tmpHome: string
let origHome: string | undefined

beforeEach(() => {
  origHome = process.env.HOME
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-home-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  fs.rmSync(tmpHome, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('installOne — slug source', () => {
  it('downloads, verifies sha256, strips wrapper, writes to claude-code', async () => {
    const bytes = makeSkillZip(2)
    const hash = sha256(bytes)

    const catalog: CatalogV1 = {
      version: 1,
      updated_at: 'now',
      soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'fate-zero',
        display_name: 'Fate/Zero',
        description: '',
        version: '1.0.0',
        engine_version: 2,
        size_bytes: bytes.length,
        sha256: hash,
        url: 'https://cdn.example/fate-zero.skill',
        soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const results = await installOne({
      source: 'fate-zero',
      targets: ['claude-code'],
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('installed')
    expect(results[0]!.engineVersion).toBe(2)

    // Wrapper directory stripped: SKILL.md should be directly under
    // ~/.claude/skills/fate-zero/, not ~/.claude/skills/fate-zero/fate-zero/
    const installedDir = path.join(tmpHome, '.claude', 'skills', 'fate-zero')
    expect(fs.existsSync(path.join(installedDir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(installedDir, 'fate-zero'))).toBe(false)
  })

  it('rejects sha256 mismatch', async () => {
    const bytes = makeSkillZip(2)
    const catalog: CatalogV1 = {
      version: 1,
      updated_at: 'now',
      soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'fate-zero',
        display_name: 'Fate/Zero',
        description: '',
        version: '1.0.0',
        engine_version: 2,
        size_bytes: bytes.length,
        sha256: 'wrong-hash',
        url: 'https://cdn.example/fate-zero.skill',
        soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const results = await installOne({
      source: 'fate-zero',
      targets: ['claude-code'],
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results[0]!.status).toBe('failed')
    expect(results[0]!.reason).toMatch(/checksum mismatch/)
  })

  it('rejects engine_version > CURRENT', async () => {
    const bytes = makeSkillZip(999)
    const hash = sha256(bytes)
    const catalog: CatalogV1 = {
      version: 1,
      updated_at: 'now',
      soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'future-skill',
        display_name: 'Future',
        description: '',
        version: '1.0.0',
        engine_version: 999,
        size_bytes: bytes.length,
        sha256: hash,
        url: 'https://cdn.example/future.skill',
        soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const results = await installOne({
      source: 'future-skill',
      targets: ['claude-code'],
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results[0]!.status).toBe('failed')
    expect(results[0]!.reason).toMatch(/engine_version/)
  })

  it('installs to multiple targets', async () => {
    const bytes = makeSkillZip(2)
    const hash = sha256(bytes)
    const catalog: CatalogV1 = {
      version: 1,
      updated_at: 'now',
      soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'fate-zero',
        display_name: 'Fate/Zero',
        description: '',
        version: '1.0.0',
        engine_version: 2,
        size_bytes: bytes.length,
        sha256: hash,
        url: 'https://cdn.example/fate-zero.skill',
        soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const results = await installOne({
      source: 'fate-zero',
      targets: ['claude-code', 'codex', 'openclaw'],
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results).toHaveLength(3)
    expect(results.map((r) => r.status)).toEqual(['installed', 'installed', 'installed'])
    expect(fs.existsSync(path.join(tmpHome, '.claude/skills/fate-zero/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpHome, '.agents/skills/fate-zero/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(tmpHome, '.openclaw/workspace/skills/fate-zero/SKILL.md'))).toBe(true)
  })

  it('conflict → skipped without overwrite', async () => {
    const bytes = makeSkillZip(2)
    const hash = sha256(bytes)
    const catalog: CatalogV1 = {
      version: 1, updated_at: 'now', soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'fate-zero', display_name: 'Fate/Zero', description: '', version: '1.0.0',
        engine_version: 2, size_bytes: bytes.length, sha256: hash,
        url: 'https://cdn.example/fate-zero.skill', soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const existing = path.join(tmpHome, '.claude/skills/fate-zero')
    fs.mkdirSync(existing, { recursive: true })
    fs.writeFileSync(path.join(existing, 'SKILL.md'), 'old')

    const results = await installOne({
      source: 'fate-zero',
      targets: ['claude-code'],
      scope: 'global',
      overwrite: false,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results[0]!.status).toBe('skipped')
    expect(fs.readFileSync(path.join(existing, 'SKILL.md'), 'utf8')).toBe('old')
  })

  it('overwrite replaces existing', async () => {
    const bytes = makeSkillZip(2)
    const hash = sha256(bytes)
    const catalog: CatalogV1 = {
      version: 1, updated_at: 'now', soulkiller_version_min: '0.4.0',
      skills: [{
        slug: 'fate-zero', display_name: 'Fate/Zero', description: '', version: '1.0.0',
        engine_version: 2, size_bytes: bytes.length, sha256: hash,
        url: 'https://cdn.example/fate-zero.skill', soulkiller_version_min: '0.4.0',
      }],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, arrayBuffer: () => Promise.resolve(bytes.buffer),
    }))

    const existing = path.join(tmpHome, '.claude/skills/fate-zero')
    fs.mkdirSync(existing, { recursive: true })
    fs.writeFileSync(path.join(existing, 'SKILL.md'), 'old')

    const results = await installOne({
      source: 'fate-zero',
      targets: ['claude-code'],
      scope: 'global',
      overwrite: true,
      catalog,
      catalogUrl: 'https://example.com/catalog.json',
    })

    expect(results[0]!.status).toBe('installed')
    expect(fs.readFileSync(path.join(existing, 'SKILL.md'), 'utf8')).toMatch(/^---/)
  })
})

describe('summarize', () => {
  it('counts and formats', () => {
    const items = [
      { slug: 'a', target: 'claude-code' as const, scope: 'global' as const, destDir: '/a', status: 'installed' as const, engineVersion: 2 },
      { slug: 'b', target: 'codex' as const, scope: 'global' as const, destDir: '/b', status: 'failed' as const, reason: 'x' },
    ]
    const s = summarize(items)
    expect(s.counts).toEqual({ installed: 1, skipped: 0, failed: 1 })
    const txt = formatSummaryText(s)
    expect(txt).toContain('✓ a')
    expect(txt).toContain('✗ b')
    expect(txt).toContain('Retry:')
  })
})
