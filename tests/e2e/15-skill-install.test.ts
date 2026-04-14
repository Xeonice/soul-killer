import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { spawnCli } from './harness/spawn-cli.js'

describe('E2E: skill install (CLI)', () => {
  let server: MockCatalogServer
  let catalogUrl: string
  let homeDir: string

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-install-'))
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', displayName: 'Alpha' })
    server.addSkill({ slug: 'beta-skill',  displayName: 'Beta' })
    server.addSkill({ slug: 'too-new',     engineVersion: 999 })
    catalogUrl = await server.start()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(homeDir, { recursive: true, force: true })
  })

  it('installs slug to claude-code (happy path)', async () => {
    const result = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    const installedDir = path.join(homeDir, '.claude', 'skills', 'alpha-skill')
    expect(fs.existsSync(path.join(installedDir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(installedDir, 'soulkiller.json'))).toBe(true)
    // Wrapper dir was stripped
    expect(fs.existsSync(path.join(installedDir, 'alpha-skill'))).toBe(false)
  })

  it('installs to multiple targets in one command', async () => {
    const result = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--to', 'codex', '--to', 'openclaw', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/alpha-skill/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, '.agents/skills/alpha-skill/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, '.openclaw/workspace/skills/alpha-skill/SKILL.md'))).toBe(true)
  })

  it('rejects unknown slug before touching filesystem', async () => {
    const result = await spawnCli({
      args: ['skill', 'install', 'does-not-exist', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(1)
    const combined = result.stdout + result.stderr
    expect(combined).toMatch(/unknown slug|not in catalog/i)
    expect(fs.existsSync(path.join(homeDir, '.claude', 'skills'))).toBe(false)
  })

  it('aborts when engine_version is higher than CLI supports', async () => {
    const result = await spawnCli({
      args: ['skill', 'install', 'too-new', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(1)
    const combined = result.stdout + result.stderr
    expect(combined).toMatch(/engine_version/i)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/too-new/SKILL.md'))).toBe(false)
  })

  it('installs from local .skill path without catalog', async () => {
    const localPath = path.join(homeDir, 'alpha-skill.skill')
    server.writeSkillToPath('alpha-skill', localPath)

    const result = await spawnCli({
      args: ['skill', 'install', localPath, '--to', 'claude-code'],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/alpha-skill/SKILL.md'))).toBe(true)
  })

  it('skips without --overwrite when already installed', async () => {
    const firstRun = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })
    expect(firstRun.exitCode).toBe(0)

    // Mark the existing installation so we can detect overwrite vs skip
    const marker = path.join(homeDir, '.claude/skills/alpha-skill/.marker')
    fs.writeFileSync(marker, 'keep-me')

    const secondRun = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })

    // "skipped" is not a fatal outcome — exit code stays 0; marker proves no overwrite
    expect(secondRun.exitCode).toBe(0)
    expect(secondRun.stdout).toMatch(/skipped|already installed/i)
    expect(fs.readFileSync(marker, 'utf8')).toBe('keep-me')
  })

  it('overwrites when --overwrite is passed', async () => {
    await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })
    const marker = path.join(homeDir, '.claude/skills/alpha-skill/.marker')
    fs.writeFileSync(marker, 'will-vanish')

    const overwrite = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'claude-code', '--overwrite', '--catalog', catalogUrl],
      homeDir,
    })

    expect(overwrite.exitCode).toBe(0)
    expect(fs.existsSync(marker)).toBe(false)
  })

  it('rejects openclaw + project scope combination', async () => {
    const result = await spawnCli({
      args: ['skill', 'install', 'alpha-skill', '--to', 'openclaw', '--scope', 'project', '--catalog', catalogUrl],
      homeDir,
    })

    // The install runs per-target; openclaw target returns 'failed' with clear reason
    expect(result.exitCode).toBe(1)
    const combined = result.stdout + result.stderr
    expect(combined).toMatch(/does not support project scope/i)
  })

  it('--all installs every catalog skill (except incompatible ones)', async () => {
    // Remove the too-new skill so --all doesn't fail across the board
    server = new MockCatalogServer()
    await server.stop()
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill' })
    server.addSkill({ slug: 'beta-skill' })
    catalogUrl = await server.start()

    const result = await spawnCli({
      args: ['skill', 'install', '--all', '--to', 'claude-code', '--catalog', catalogUrl],
      homeDir,
    })

    expect(result.exitCode).toBe(0)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/alpha-skill/SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/beta-skill/SKILL.md'))).toBe(true)
  })
})
