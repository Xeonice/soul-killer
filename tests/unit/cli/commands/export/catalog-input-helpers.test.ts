import { describe, it, expect } from 'vitest'
import {
  normalizeSlugCandidate,
  validateCatalogSubStep,
} from '../../../../../src/cli/commands/export/catalog-input-helpers.js'

describe('normalizeSlugCandidate (skill-catalog-autogen)', () => {
  it('lowercases uppercase input', () => {
    expect(normalizeSlugCandidate('Fate-Zero')).toBe('fate-zero')
  })

  it('replaces underscores with hyphens', () => {
    expect(normalizeSlugCandidate('fate_zero')).toBe('fate-zero')
  })

  it('strips invalid characters', () => {
    expect(normalizeSlugCandidate('fate/zero!')).toBe('fatezero')
  })

  it('collapses consecutive hyphens', () => {
    expect(normalizeSlugCandidate('fate---zero')).toBe('fate-zero')
  })

  it('trims leading and trailing hyphens', () => {
    expect(normalizeSlugCandidate('---fate-zero---')).toBe('fate-zero')
  })

  it('handles combined defects', () => {
    expect(normalizeSlugCandidate('--Fate_ZERO!!--')).toBe('fate-zero')
  })

  it('returns empty string for undefined / null / pure non-ascii', () => {
    expect(normalizeSlugCandidate(undefined)).toBe('')
    expect(normalizeSlugCandidate(null)).toBe('')
    expect(normalizeSlugCandidate('圣杯战争')).toBe('')
  })

  it('preserves already-valid slugs unchanged', () => {
    expect(normalizeSlugCandidate('three-kingdoms')).toBe('three-kingdoms')
    expect(normalizeSlugCandidate('white-album-2')).toBe('white-album-2')
  })
})

describe('validateCatalogSubStep (skill-catalog-autogen)', () => {
  describe('empty detection', () => {
    it('rejects empty string on every sub-step', () => {
      expect(validateCatalogSubStep('slug', '')).toBe('export.err.catalog.empty')
      expect(validateCatalogSubStep('world', '')).toBe('export.err.catalog.empty')
      expect(validateCatalogSubStep('summary', '')).toBe('export.err.catalog.empty')
    })

    it('treats whitespace-only as empty', () => {
      expect(validateCatalogSubStep('slug', '   ')).toBe('export.err.catalog.empty')
    })
  })

  describe('slug', () => {
    it('accepts canonical kebab-case', () => {
      expect(validateCatalogSubStep('slug', 'fate-zero')).toBeNull()
      expect(validateCatalogSubStep('slug', 'three-kingdoms')).toBeNull()
      expect(validateCatalogSubStep('slug', 'wa')).toBeNull() // length 2 boundary
    })

    it('rejects too short / too long', () => {
      expect(validateCatalogSubStep('slug', 'a')).toBe('export.err.catalog.slug_format')
      expect(validateCatalogSubStep('slug', 'a'.repeat(33))).toBe('export.err.catalog.slug_format')
    })

    it('rejects bad format', () => {
      expect(validateCatalogSubStep('slug', 'Fate-Zero')).toBe('export.err.catalog.slug_format')
      expect(validateCatalogSubStep('slug', 'fate_zero')).toBe('export.err.catalog.slug_format')
      expect(validateCatalogSubStep('slug', 'fate--zero')).toBe('export.err.catalog.slug_format')
      expect(validateCatalogSubStep('slug', '-fate')).toBe('export.err.catalog.slug_format')
      expect(validateCatalogSubStep('slug', 'fate-')).toBe('export.err.catalog.slug_format')
    })
  })

  describe('world name', () => {
    it('accepts CJK and symbols', () => {
      expect(validateCatalogSubStep('world', 'Fate/Zero')).toBeNull()
      expect(validateCatalogSubStep('world', '三国')).toBeNull()
    })

    it('rejects strings longer than 40 chars', () => {
      expect(validateCatalogSubStep('world', 'x'.repeat(41))).toBe(
        'export.err.catalog.world_name_length',
      )
    })
  })

  describe('summary', () => {
    it('accepts Chinese single-line summary up to 80 chars', () => {
      expect(validateCatalogSubStep('summary', '第四次圣杯战争，七位御主与英灵的死斗')).toBeNull()
    })

    it('rejects strings longer than 80 chars', () => {
      expect(validateCatalogSubStep('summary', 'x'.repeat(81))).toBe(
        'export.err.catalog.summary_length',
      )
    })

    it('rejects newlines', () => {
      expect(validateCatalogSubStep('summary', '第一\n第二')).toBe(
        'export.err.catalog.summary_newline',
      )
      expect(validateCatalogSubStep('summary', '第一\r第二')).toBe(
        'export.err.catalog.summary_newline',
      )
    })
  })
})
