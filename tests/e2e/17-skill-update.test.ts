import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill update (CLI)', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-update-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', version: '1.0.0' })
    catalogUrl = await server.start()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(homeDir, { recursive: true, force: true })
  })

  async function install(slug: string): Promise<void> {
    const result = await spawnCli({
      args: ['skill', 'install', slug, '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    if (result.exitCode !== 0) throw new Error(`install failed: ${result.stderr}`)
  }

  function readInstalledVersion(slug: string): string | null {
    const json = path.join(homeDir, '.claude', 'skills', slug, 'soulkiller.json')
    if (!fs.existsSync(json)) return null
    const data = JSON.parse(fs.readFileSync(json, 'utf8')) as { version?: string }
    return data.version ?? null
  }

  it('updates to newer catalog version', async () => {
    await install('alpha-skill')
    expect(readInstalledVersion('alpha-skill')).toBe('1.0.0')
    server.addSkill({ slug: 'alpha-skill', version: '1.1.0' })

    const result = await spawnCli({
      args: ['skill', 'update', 'alpha-skill', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(readInstalledVersion('alpha-skill')).toBe('1.1.0')
  })

  it('--check reports planned updates without writing', async () => {
    await install('alpha-skill')
    server.addSkill({ slug: 'alpha-skill', version: '1.1.0' })

    const result = await spawnCli({
      args: ['skill', 'update', '--all', '--check', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('alpha-skill')
    expect(result.stdout).toContain('1.0.0 → 1.1.0')
    // Still at old version
    expect(readInstalledVersion('alpha-skill')).toBe('1.0.0')
  })

  it('--check --exit-code-if-updates returns 1 when updates exist', async () => {
    await install('alpha-skill')
    server.addSkill({ slug: 'alpha-skill', version: '1.1.0' })
    const result = await spawnCli({
      args: ['skill', 'update', '--all', '--check', '--exit-code-if-updates', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(1)
  })

  it('already-up-to-date skill reports and exits 0', async () => {
    await install('alpha-skill')
    const result = await spawnCli({
      args: ['skill', 'update', 'alpha-skill', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('already up to date')
  })

  it('errors with exit 2 for unknown slug', async () => {
    const result = await spawnCli({
      args: ['skill', 'update', 'does-not-exist', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(2)
    const combined = result.stdout + result.stderr
    expect(combined).toContain('not installed')
  })
})
