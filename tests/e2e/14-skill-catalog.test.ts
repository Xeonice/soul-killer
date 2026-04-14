import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill catalog', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-catalog-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', displayName: 'Alpha',  description: 'First' })
    server.addSkill({ slug: 'beta-skill',  displayName: 'Beta',   description: 'Second' })
    catalogUrl = await server.start()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(homeDir, { recursive: true, force: true })
  })

  it('renders human-readable table', async () => {
    const result = await spawnCli({
      args: ['skill', 'catalog', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('alpha-skill')
    expect(result.stdout).toContain('Alpha')
    expect(result.stdout).toContain('beta-skill')
    expect(result.stdout).toContain('SLUG')
    expect(result.stdout).toContain('NAME')
  })

  it('--json emits valid CatalogV1 JSON', async () => {
    const result = await spawnCli({
      args: ['skill', 'catalog', '--catalog', catalogUrl, '--json'],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.version).toBe(1)
    expect(parsed.skills).toHaveLength(2)
    const slugs = parsed.skills.map((s: { slug: string }) => s.slug).sort()
    expect(slugs).toEqual(['alpha-skill', 'beta-skill'])
  })

  it('fails cleanly when catalog URL is unreachable', async () => {
    const result = await spawnCli({
      args: ['skill', 'catalog', '--catalog', 'http://127.0.0.1:1'],
      homeDir,
    })

    expect(result.exitCode).toBe(1)
    const combined = result.stdout + result.stderr
    expect(combined).toMatch(/catalog unavailable|unavailable|refused|ECONN/i)
  })
})
