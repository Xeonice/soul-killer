import { describe, it, expect } from 'vitest'
import {
  ZH_TRANSLATESE_PATTERNS,
  formatPatternsForToolDescription,
  topForbiddenPatterns,
  type ProseStyleForbiddenPattern,
} from '../../src/export/support/prose-style-index.js'

describe('ZH_TRANSLATESE_PATTERNS', () => {
  it('contains at least 8 entries', () => {
    expect(ZH_TRANSLATESE_PATTERNS.length).toBeGreaterThanOrEqual(8)
  })

  it('covers the required core pattern ids', () => {
    const ids = new Set(ZH_TRANSLATESE_PATTERNS.map((p) => p.id))
    // Core 8 ids called out by prose-style-anchor/spec.md
    const required = [
      'degree_clause',
      'gaze_level',
      'possessive_chain',
      'abstract_noun',
      'literal_metaphor',
      'held_back_negative',
      'night_of_event',
      'small_body',
    ]
    for (const id of required) {
      expect(ids.has(id), `missing required pattern id: ${id}`).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = ZH_TRANSLATESE_PATTERNS.map((p) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every entry has non-empty bad / good / reason strings', () => {
    for (const p of ZH_TRANSLATESE_PATTERNS) {
      expect(p.bad.length).toBeGreaterThan(0)
      expect(p.good.length).toBeGreaterThan(0)
      expect(p.reason.length).toBeGreaterThan(0)
    }
  })

  it('id is snake_case', () => {
    for (const p of ZH_TRANSLATESE_PATTERNS) {
      expect(p.id).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })
})

describe('formatPatternsForToolDescription', () => {
  it('renders each pattern with ✗ / ✓ / Reason labels', () => {
    const out = formatPatternsForToolDescription()
    expect(out).toContain('✗ Bad:')
    expect(out).toContain('✓ Good:')
    expect(out).toContain('Reason:')
  })

  it('includes the id for every pattern', () => {
    const out = formatPatternsForToolDescription()
    for (const p of ZH_TRANSLATESE_PATTERNS) {
      expect(out).toContain(`[id: ${p.id}]`)
    }
  })

  it('separates entries with blank line', () => {
    const out = formatPatternsForToolDescription()
    // Two consecutive newlines between entries.
    expect(out.split('\n\n').length).toBe(ZH_TRANSLATESE_PATTERNS.length)
  })

  it('accepts a custom pattern array', () => {
    const custom: ProseStyleForbiddenPattern[] = [
      { id: 'test_a', bad: 'b', good: 'g', reason: 'r' },
    ]
    const out = formatPatternsForToolDescription(custom)
    expect(out).toContain('[id: test_a]')
    expect(out).not.toContain('[id: degree_clause]')
  })
})

describe('topForbiddenPatterns', () => {
  it('returns first 5 by default', () => {
    const top = topForbiddenPatterns()
    expect(top).toHaveLength(5)
    expect(top[0].id).toBe(ZH_TRANSLATESE_PATTERNS[0].id)
  })

  it('respects the n parameter', () => {
    expect(topForbiddenPatterns(3)).toHaveLength(3)
    expect(topForbiddenPatterns(10).length).toBeLessThanOrEqual(
      ZH_TRANSLATESE_PATTERNS.length,
    )
  })
})
