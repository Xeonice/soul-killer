import { describe, it, expect } from 'vitest'
import { buildSoulkillerManifest } from '../../../src/export/packager.js'
import { CURRENT_ENGINE_VERSION } from '../../../src/export/spec/skill-template.js'

describe('buildSoulkillerManifest', () => {
  const fixedNow = new Date('2026-04-15T03:00:00.000Z')

  it('includes author version when provided', () => {
    const json = buildSoulkillerManifest({
      skill_id: 'alpha-skill',
      author_version: '1.2.0',
      now: fixedNow,
    })
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.2.0')
    expect(parsed.skill_id).toBe('alpha-skill')
    expect(parsed.engine_version).toBe(CURRENT_ENGINE_VERSION)
    expect(parsed.exported_at).toBe('2026-04-15T03:00:00.000Z')
  })

  it('falls back to 0.0.0 when author_version is undefined', () => {
    const json = buildSoulkillerManifest({
      skill_id: 'x',
      author_version: undefined,
      now: fixedNow,
    })
    expect(JSON.parse(json).version).toBe('0.0.0')
  })

  it('falls back to 0.0.0 when author_version is empty string', () => {
    const json = buildSoulkillerManifest({
      skill_id: 'x',
      author_version: '',
      now: fixedNow,
    })
    expect(JSON.parse(json).version).toBe('0.0.0')
  })

  it('reads SOULKILLER_VERSION from env at call time', () => {
    const prev = process.env.SOULKILLER_VERSION
    try {
      process.env.SOULKILLER_VERSION = '0.5.0'
      const json = buildSoulkillerManifest({
        skill_id: 'x',
        author_version: '1.0.0',
        now: fixedNow,
      })
      expect(JSON.parse(json).soulkiller_version).toBe('0.5.0')
    } finally {
      if (prev === undefined) delete process.env.SOULKILLER_VERSION
      else process.env.SOULKILLER_VERSION = prev
    }
  })

  it('emits trailing newline', () => {
    const json = buildSoulkillerManifest({
      skill_id: 'x',
      author_version: '1.0.0',
      now: fixedNow,
    })
    expect(json.endsWith('\n')).toBe(true)
  })
})
