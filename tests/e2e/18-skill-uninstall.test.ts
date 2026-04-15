import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill uninstall (CLI)', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-uninstall-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', version: '1.0.0' })
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
    if (result.exitCode !== 0) throw new Error(`install failed: ${result.stderr}`)
  }

  it('creates .old-<ts> backup by default', async () => {
    await install('alpha-skill')
    const skillDir = path.join(homeDir, '.claude', 'skills', 'alpha-skill')
    expect(fs.existsSync(skillDir)).toBe(true)

    const result = await spawnCli({
      args: ['skill', 'uninstall', 'alpha-skill'],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(skillDir)).toBe(false)
    const parent = path.join(homeDir, '.claude', 'skills')
    const backups = fs.readdirSync(parent).filter((n) => n.startsWith('alpha-skill.old-'))
    expect(backups.length).toBe(1)
  })

  it('--no-backup deletes in place', async () => {
    await install('alpha-skill')
    const result = await spawnCli({
      args: ['skill', 'uninstall', 'alpha-skill', '--no-backup'],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    const parent = path.join(homeDir, '.claude', 'skills')
    expect(fs.readdirSync(parent)).toEqual([])
  })

  it('--all-targets removes from every target', async () => {
    await install('alpha-skill', ['claude-code', 'codex'])
    const result = await spawnCli({
      args: ['skill', 'uninstall', 'alpha-skill', '--all-targets'],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/alpha-skill'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, '.agents/skills/alpha-skill'))).toBe(false)
  })

  it('errors exit 1 when nothing to uninstall', async () => {
    const result = await spawnCli({
      args: ['skill', 'uninstall', 'nonexistent'],
      homeDir, cwd: homeDir,
    })
    expect(result.exitCode).toBe(1)
  })
})
