import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill info (CLI)', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-info-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', version: '1.0.0', displayName: 'Alpha Test' })
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

  it('shows install locations + catalog info', async () => {
    await install('alpha-skill')
    const result = await spawnCli({
      args: ['skill', 'info', 'alpha-skill', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('alpha-skill')
    expect(result.stdout).toContain('Catalog version: 1.0.0')
    expect(result.stdout).toContain('Installed:       yes')
    expect(result.stdout).toContain('claude-code:global')
  })

  it('--json emits structured payload', async () => {
    await install('alpha-skill')
    const result = await spawnCli({
      args: ['skill', 'info', 'alpha-skill', '--json', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.slug).toBe('alpha-skill')
    expect(Array.isArray(payload.installed)).toBe(true)
    expect(payload.catalog.version).toBe('1.0.0')
  })

  it('reports "not installed" for unknown slug', async () => {
    const result = await spawnCli({
      args: ['skill', 'info', 'ghost', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(1)
  })

  it('warns about legacy runtime/bin residue', async () => {
    await install('alpha-skill')
    const binDir = path.join(homeDir, '.claude', 'skills', 'alpha-skill', 'runtime', 'bin')
    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(path.join(binDir, 'state'), '#!/bin/bash\n')

    const result = await spawnCli({
      args: ['skill', 'info', 'alpha-skill', '--catalog', catalogUrl],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('legacy runtime/bin')
  })
})
