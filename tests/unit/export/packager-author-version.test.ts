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

  describe('catalog display fields (skill-catalog-autogen)', () => {
    it('writes world_slug / world_name / summary when provided', () => {
      const json = buildSoulkillerManifest({
        skill_id: 'fz-in-fate-zero',
        author_version: '0.2.0',
        world_slug: 'fate-zero',
        world_name: 'Fate/Zero',
        summary: '第四次圣杯战争，含完整卡司',
        now: fixedNow,
      })
      const parsed = JSON.parse(json)
      expect(parsed.world_slug).toBe('fate-zero')
      expect(parsed.world_name).toBe('Fate/Zero')
      expect(parsed.summary).toBe('第四次圣杯战争，含完整卡司')
      expect(typeof parsed.world_slug).toBe('string')
      expect(typeof parsed.world_name).toBe('string')
      expect(typeof parsed.summary).toBe('string')
    })

    it('falls back to empty string when fields are omitted', () => {
      const json = buildSoulkillerManifest({
        skill_id: 'x',
        author_version: '1.0.0',
        now: fixedNow,
      })
      const parsed = JSON.parse(json)
      expect(parsed.world_slug).toBe('')
      expect(parsed.world_name).toBe('')
      expect(parsed.summary).toBe('')
    })

    it('emits all three fields as strings even when empty (never null/undefined)', () => {
      const json = buildSoulkillerManifest({
        skill_id: 'x',
        author_version: '1.0.0',
        world_slug: undefined,
        world_name: undefined,
        summary: undefined,
        now: fixedNow,
      })
      const parsed = JSON.parse(json)
      expect(parsed).toHaveProperty('world_slug')
      expect(parsed).toHaveProperty('world_name')
      expect(parsed).toHaveProperty('summary')
      expect(typeof parsed.world_slug).toBe('string')
      expect(typeof parsed.world_name).toBe('string')
      expect(typeof parsed.summary).toBe('string')
    })
  })
})
