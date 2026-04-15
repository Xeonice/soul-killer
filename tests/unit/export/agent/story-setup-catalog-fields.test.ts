import { describe, it, expect } from 'vitest'
import { validateCatalogFields } from '../../../../src/export/agent/story-setup.js'

describe('validateCatalogFields (skill-catalog-autogen)', () => {
  describe('valid input', () => {
    it('accepts a canonical fate-zero record', () => {
      expect(
        validateCatalogFields({
          world_slug: 'fate-zero',
          world_name: 'Fate/Zero',
          summary: '第四次圣杯战争，七位御主与英灵的死斗',
        }),
      ).toBeNull()
    })

    it('accepts numeric digits in slug and ascii-only world names', () => {
      expect(
        validateCatalogFields({
          world_slug: 'white-album-2',
          world_name: 'White Album 2',
          summary: 'A tangled IF route: guilt, forgiveness, and what comes after',
        }),
      ).toBeNull()
    })
  })

  describe('world_slug rejection', () => {
    it('rejects uppercase letters', () => {
      const err = validateCatalogFields({
        world_slug: 'Fate-Zero',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/world_slug/)
    })

    it('rejects underscores', () => {
      const err = validateCatalogFields({
        world_slug: 'fate_zero',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/kebab-case/)
    })

    it('rejects consecutive hyphens', () => {
      const err = validateCatalogFields({
        world_slug: 'fate--zero',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/kebab-case/)
    })

    it('rejects leading hyphen', () => {
      const err = validateCatalogFields({
        world_slug: '-fate-zero',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/kebab-case/)
    })

    it('rejects trailing hyphen', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero-',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/kebab-case/)
    })

    it('rejects slug shorter than 2 chars', () => {
      const err = validateCatalogFields({
        world_slug: 'a',
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/length/)
    })

    it('rejects slug longer than 32 chars', () => {
      const err = validateCatalogFields({
        world_slug: 'a'.repeat(33),
        world_name: 'Fate/Zero',
        summary: 'ok',
      })
      expect(err).toMatch(/length/)
    })
  })

  describe('world_name rejection', () => {
    it('rejects empty string', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: '',
        summary: 'ok',
      })
      expect(err).toMatch(/world_name/)
    })

    it('rejects strings longer than 40 characters', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: 'x'.repeat(41),
        summary: 'ok',
      })
      expect(err).toMatch(/40/)
    })
  })

  describe('summary rejection', () => {
    it('rejects empty string', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: 'Fate/Zero',
        summary: '',
      })
      expect(err).toMatch(/summary/)
    })

    it('rejects strings longer than 80 characters', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: 'Fate/Zero',
        summary: 'x'.repeat(81),
      })
      expect(err).toMatch(/80/)
    })

    it('rejects summaries containing newline characters', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: 'Fate/Zero',
        summary: '第四次圣杯战争\n含完整卡司',
      })
      expect(err).toMatch(/single line/)
    })

    it('rejects summaries containing \\r', () => {
      const err = validateCatalogFields({
        world_slug: 'fate-zero',
        world_name: 'Fate/Zero',
        summary: '第四次圣杯战争\r含完整卡司',
      })
      expect(err).toMatch(/single line/)
    })
  })
})
