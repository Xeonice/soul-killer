import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { cleanupStaleSkillBackups } from '../../../../src/cli/cleanup.js'

let tmpHome: string
let origHome: string | undefined

beforeEach(() => {
  origHome = process.env.HOME
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-backups-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

describe('cleanupStaleSkillBackups', () => {
  it('removes backups older than the retention window', () => {
    const skillsDir = path.join(tmpHome, '.claude', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days ago
    const oldBackup = path.join(skillsDir, `fate-zero.old-${oldTs}`)
    fs.mkdirSync(oldBackup)
    fs.writeFileSync(path.join(oldBackup, 'marker'), 'old')

    const freshTs = Date.now() - 1 * 24 * 60 * 60 * 1000 // 1 day ago
    const freshBackup = path.join(skillsDir, `beta.old-${freshTs}`)
    fs.mkdirSync(freshBackup)
    fs.writeFileSync(path.join(freshBackup, 'marker'), 'fresh')

    // Keep user's regular skill dir untouched
    const real = path.join(skillsDir, 'current-skill')
    fs.mkdirSync(real)
    fs.writeFileSync(path.join(real, 'SKILL.md'), '---\nname: x\n---\n')

    cleanupStaleSkillBackups()

    expect(fs.existsSync(oldBackup)).toBe(false)
    expect(fs.existsSync(freshBackup)).toBe(true)
    expect(fs.existsSync(real)).toBe(true)
  })

  it('respects a custom retention window', () => {
    const skillsDir = path.join(tmpHome, '.claude', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })
    const ts = Date.now() - 10_000 // 10s ago
    fs.mkdirSync(path.join(skillsDir, `x.old-${ts}`))
    cleanupStaleSkillBackups(5_000) // 5s retention
    expect(fs.existsSync(path.join(skillsDir, `x.old-${ts}`))).toBe(false)
  })

  it('is a no-op when no target directories exist', () => {
    // cwd-scoped and HOME both empty — must not throw
    expect(() => cleanupStaleSkillBackups()).not.toThrow()
  })
})
