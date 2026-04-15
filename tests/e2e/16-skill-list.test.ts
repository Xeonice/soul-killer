import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill list (CLI)', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-list-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', version: '1.0.0' })
    server.addSkill({ slug: 'beta-skill', version: '2.0.0' })
    catalogUrl = await server.start()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(homeDir, { recursive: true, force: true })
  })

  async function install(slug: string, targets: string[] = ['claude-code']): Promise<void> {
    const args = ['skill', 'install', slug]
    for (const t of targets) { args.push('--to', t) }
    args.push('--catalog', catalogUrl)
    const result = await spawnCli({ args, homeDir, cwd: homeDir })
    if (result.exitCode !== 0) {
      throw new Error(`install failed: ${result.stdout}\n${result.stderr}`)
    }
  }

  it('shows installed skills vs catalog (up-to-date + updatable)', async () => {
    await install('alpha-skill')
    // Bump catalog to create an updatable diff
    server.addSkill({ slug: 'alpha-skill', version: '1.1.0' })

    const result = await spawnCli({
      args: ['skill', 'list', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    // alpha-skill present as updatable
    expect(result.stdout).toContain('alpha-skill')
    expect(result.stdout).toContain('update → 1.1.0')
  })

  it('--updates filters to only updatable skills', async () => {
    await install('alpha-skill')
    await install('beta-skill')
    server.addSkill({ slug: 'alpha-skill', version: '1.1.0' }) // bumped
    // beta-skill stays at 2.0.0

    const result = await spawnCli({
      args: ['skill', 'list', '--updates', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('alpha-skill')
    expect(result.stdout).not.toContain('beta-skill')
  })

  it('--json emits machine-readable structure', async () => {
    await install('alpha-skill')
    const result = await spawnCli({
      args: ['skill', 'list', '--json', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(Array.isArray(payload.installed)).toBe(true)
    expect(payload.installed[0].slug).toBe('alpha-skill')
    expect(payload.catalog_source).toBe('network')
  })

  it('reports empty when no skills installed', async () => {
    const result = await spawnCli({
      args: ['skill', 'list'],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No soulkiller skills found')
  })
})
