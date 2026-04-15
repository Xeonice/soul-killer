import { describe, it, expect } from 'vitest'
import { checkArchiveContract } from '../../../src/export/packager.js'

/**
 * Skill / Binary Contract invariant (see CLAUDE.md).
 * Archive entries must be pure data; no executable code anywhere.
 */

describe('checkArchiveContract — whitelist', () => {
  it('accepts a fully compliant archive layout', () => {
    const paths = [
      'SKILL.md',
      'soulkiller.json',
      'story-spec.md',
      'souls/judy/identity.md',
      'souls/judy/style.md',
      'world/night-city/overview.md',
      'runtime/engine.md',
      'runtime/scripts/.gitkeep',
      'runtime/saves/.gitkeep',
    ]
    expect(checkArchiveContract(paths)).toEqual([])
  })

  it('rejects .ts inside runtime/lib/', () => {
    const paths = ['SKILL.md', 'runtime/lib/apply.ts']
    const violations = checkArchiveContract(paths)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.map((v) => v.path)).toContain('runtime/lib/apply.ts')
  })

  it('rejects executable extensions even under allowed prefixes', () => {
    const paths = ['runtime/scripts/malicious.sh', 'runtime/saves/evil.js']
    const violations = checkArchiveContract(paths)
    expect(violations.length).toBe(2)
    for (const v of violations) {
      expect(v.reason).toMatch(/executable extension/)
    }
  })

  it('rejects foreign top-level directories', () => {
    const paths = ['SKILL.md', 'src/hacker.ts', 'lib/stuff.ts', 'bin/thing']
    const violations = checkArchiveContract(paths)
    expect(violations.length).toBe(3)
    for (const v of violations) {
      expect(v.reason).toMatch(/whitelist/)
    }
  })

  it('rejects runtime/bin/ (pre skill-runtime-binary bash wrapper era)', () => {
    const paths = ['runtime/bin/state', 'runtime/bin/doctor.sh']
    const violations = checkArchiveContract(paths)
    expect(violations.length).toBe(2)
  })

  it('accepts both array and Record input forms', () => {
    const record: Record<string, Uint8Array> = {
      'SKILL.md': new Uint8Array(),
      'souls/a/x.md': new Uint8Array(),
    }
    expect(checkArchiveContract(record)).toEqual([])
  })
})
