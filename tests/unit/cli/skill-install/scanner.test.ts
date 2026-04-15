import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { scanInstalled, readInstallRecord, deriveScanRoots } from '../../../../src/cli/skill-install/scanner.js'

let tmpHome: string
let origHome: string | undefined

function writeSkill(
  dir: string,
  opts: {
    version?: string
    engineVersion?: number
    soulkillerVersion?: string
    skipJson?: boolean
    legacyBin?: boolean
    skillMd?: boolean
  } = {},
): void {
  fs.mkdirSync(dir, { recursive: true })
  if (opts.skillMd !== false) fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: x\n---\n')
  if (!opts.skipJson) {
    const json: Record<string, unknown> = { skill_id: path.basename(dir) }
    if (opts.version) json.version = opts.version
    if (opts.engineVersion !== undefined) json.engine_version = opts.engineVersion
    if (opts.soulkillerVersion) json.soulkiller_version = opts.soulkillerVersion
    fs.writeFileSync(path.join(dir, 'soulkiller.json'), JSON.stringify(json))
  }
  if (opts.legacyBin) {
    fs.mkdirSync(path.join(dir, 'runtime', 'bin'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'runtime', 'bin', 'state'), '#!/bin/bash\n')
    fs.writeFileSync(path.join(dir, 'runtime', 'bin', 'doctor.sh'), '#!/bin/sh\n')
  }
}

beforeEach(() => {
  origHome = process.env.HOME
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-home-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

describe('scanner', () => {
  it('finds a skill installed to claude-code global scope', () => {
    writeSkill(path.join(tmpHome, '.claude', 'skills', 'fate-zero'), {
      version: '0.3.1',
      engineVersion: 2,
      soulkillerVersion: '0.4.0',
    })
    const installed = scanInstalled({ cwd: tmpHome })
    expect(installed).toHaveLength(1)
    expect(installed[0]!.slug).toBe('fate-zero')
    expect(installed[0]!.installs).toHaveLength(1)
    const rec = installed[0]!.installs[0]!
    expect(rec.target).toBe('claude-code')
    expect(rec.scope).toBe('global')
    expect(rec.version).toBe('0.3.1')
    expect(rec.engineVersion).toBe(2)
    expect(rec.soulkillerVersion).toBe('0.4.0')
    expect(rec.hasLegacyRuntimeBin).toBe(false)
  })

  it('merges multiple targets under one slug', () => {
    writeSkill(path.join(tmpHome, '.claude', 'skills', 'fate-zero'), { version: '0.3.1' })
    writeSkill(path.join(tmpHome, '.agents', 'skills', 'fate-zero'), { version: '0.3.1' })
    const installed = scanInstalled({ cwd: tmpHome })
    expect(installed).toHaveLength(1)
    const targets = installed[0]!.installs.map((r) => r.target).sort()
    expect(targets).toEqual(['claude-code', 'codex'])
  })

  it('flags legacy runtime/bin residue', () => {
    writeSkill(path.join(tmpHome, '.claude', 'skills', 'fate-zero'), { legacyBin: true })
    const installed = scanInstalled({ cwd: tmpHome })
    expect(installed[0]!.installs[0]!.hasLegacyRuntimeBin).toBe(true)
  })

  it('ignores generic Claude Code skills without soulkiller.json', () => {
    // e.g. ai-sdk / openspec-* / create-colleague — not soulkiller-produced
    writeSkill(path.join(tmpHome, '.claude', 'skills', 'ai-sdk'), { skipJson: true })
    expect(scanInstalled({ cwd: tmpHome })).toEqual([])
  })

  it('ignores .old-<ts> backup directories', () => {
    writeSkill(path.join(tmpHome, '.claude', 'skills', 'fate-zero'), { version: '0.3.1' })
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills', 'fate-zero.old-12345'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpHome, '.claude', 'skills', 'fate-zero.old-12345', 'SKILL.md'),
      '---\nname: stale\n---\n',
    )
    const installed = scanInstalled({ cwd: tmpHome })
    expect(installed).toHaveLength(1)
    expect(installed[0]!.slug).toBe('fate-zero')
  })

  it('returns empty array when no skills directories exist', () => {
    expect(scanInstalled({ cwd: tmpHome, includeProjectScope: false })).toEqual([])
  })

  it('skips hidden directories', () => {
    writeSkill(path.join(tmpHome, '.claude', 'skills', '.tmp-install'), { version: '0.1.0' })
    expect(scanInstalled({ cwd: tmpHome })).toEqual([])
  })

  it('ignores directories without SKILL.md / soulkiller.json / runtime', () => {
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills', 'not-a-skill'), { recursive: true })
    fs.writeFileSync(path.join(tmpHome, '.claude', 'skills', 'not-a-skill', 'README.md'), 'hi')
    expect(scanInstalled({ cwd: tmpHome })).toEqual([])
  })

  describe('deriveScanRoots', () => {
    it('returns only existing roots', () => {
      fs.mkdirSync(path.join(tmpHome, '.claude', 'skills'), { recursive: true })
      const roots = deriveScanRoots({ cwd: tmpHome, includeProjectScope: false })
      expect(roots.some((r) => r.target === 'claude-code' && r.scope === 'global')).toBe(true)
      expect(roots.some((r) => r.target === 'codex')).toBe(false)
    })

    it('deduplicates cwd==HOME project/global collision', () => {
      fs.mkdirSync(path.join(tmpHome, '.claude', 'skills'), { recursive: true })
      const roots = deriveScanRoots({ cwd: tmpHome })
      const claudeRoots = roots.filter((r) => r.target === 'claude-code')
      expect(claudeRoots).toHaveLength(1)
      expect(claudeRoots[0]!.scope).toBe('global')
    })
  })

  describe('readInstallRecord', () => {
    it('returns null for non-skill directories', () => {
      const dir = path.join(tmpHome, 'not-a-skill')
      fs.mkdirSync(dir, { recursive: true })
      expect(readInstallRecord(dir, 'claude-code', 'global')).toBeNull()
    })

    it('rejects a dir with runtime/ but no soulkiller.json', () => {
      const dir = path.join(tmpHome, 'runtime-only')
      fs.mkdirSync(path.join(dir, 'runtime'), { recursive: true })
      expect(readInstallRecord(dir, 'claude-code', 'global')).toBeNull()
    })

    it('accepts a dir with soulkiller.json but no SKILL.md', () => {
      const dir = path.join(tmpHome, 'no-skill-md')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'soulkiller.json'), '{"version":"0.1.0"}')
      const rec = readInstallRecord(dir, 'claude-code', 'global')
      expect(rec).not.toBeNull()
      expect(rec!.version).toBe('0.1.0')
    })
  })
})
