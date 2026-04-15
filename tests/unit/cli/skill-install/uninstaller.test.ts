import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { atomicUninstall, NotInstalledError } from '../../../../src/cli/skill-install/uninstaller.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstaller-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function seedSkill(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: x\n---\n')
  fs.writeFileSync(path.join(dir, 'soulkiller.json'), '{"version":"0.1.0"}')
}

describe('atomicUninstall', () => {
  it('renames to <path>.old-<ts> by default', () => {
    const skillDir = path.join(tmp, 'fate-zero')
    seedSkill(skillDir)
    const result = atomicUninstall({ path: skillDir, timestampOverride: 12345 })
    expect(result.backupPath).toBe(`${skillDir}.old-12345`)
    expect(fs.existsSync(skillDir)).toBe(false)
    expect(fs.existsSync(result.backupPath!)).toBe(true)
    expect(fs.existsSync(path.join(result.backupPath!, 'SKILL.md'))).toBe(true)
  })

  it('with backup=false deletes in place', () => {
    const skillDir = path.join(tmp, 'fate-zero')
    seedSkill(skillDir)
    const result = atomicUninstall({ path: skillDir, backup: false })
    expect(result.backupPath).toBeNull()
    expect(fs.existsSync(skillDir)).toBe(false)
  })

  it('throws NotInstalledError when target is absent', () => {
    expect(() => atomicUninstall({ path: path.join(tmp, 'nope') })).toThrow(NotInstalledError)
  })

  it('produces deterministic backup paths via timestampOverride', () => {
    const skillDir = path.join(tmp, 'fate-zero')
    seedSkill(skillDir)
    const r1 = atomicUninstall({ path: skillDir, timestampOverride: 100 })
    expect(r1.backupPath).toBe(`${skillDir}.old-100`)
    seedSkill(skillDir)
    const r2 = atomicUninstall({ path: skillDir, timestampOverride: 200 })
    expect(r2.backupPath).toBe(`${skillDir}.old-200`)
  })
})
