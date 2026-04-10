/**
 * Tests for computeExportStepCap — the dynamic step cap used by the
 * export agent's tool-loop to prevent dead-loops while leaving enough
 * headroom for normal flows to complete.
 *
 * Background: the step cap used to be a hardcoded 20, set back when the
 * workflow had 4 setup steps and characters were capped at 4. After
 * story-level-state and prose-style-anchor added two setup tools and
 * the character cap was lifted, a 9-character skill needed 22+ steps
 * making completion mathematically impossible. See design.md for the
 * full formula derivation.
 */
import { describe, it, expect } from 'vitest'
import { computeExportStepCap } from '../../src/agent/export-agent.js'

describe('computeExportStepCap', () => {
  // Formula: (3 + N × 2 + 1) + max(5, N) = 2N + 4 + max(5, N)
  // For N ≤ 5: buffer = 5, result = 2N + 9
  // For N >  5: buffer = N, result = 3N + 4

  it('returns 11 for 1 character (6 minimal + 5 buffer)', () => {
    expect(computeExportStepCap(1)).toBe(11)
  })

  it('returns 13 for 2 characters (8 minimal + 5 buffer)', () => {
    expect(computeExportStepCap(2)).toBe(13)
  })

  it('returns 15 for 3 characters (10 minimal + 5 buffer)', () => {
    expect(computeExportStepCap(3)).toBe(15)
  })

  it('returns 17 for 4 characters (12 minimal + 5 buffer)', () => {
    expect(computeExportStepCap(4)).toBe(17)
  })

  it('returns 19 for 5 characters (14 minimal + 5 buffer)', () => {
    expect(computeExportStepCap(5)).toBe(19)
  })

  it('returns 22 for 6 characters (16 minimal + 6 buffer)', () => {
    expect(computeExportStepCap(6)).toBe(22)
  })

  it('returns 31 for 9 characters — the three-kingdom-chibi case', () => {
    // 9 × 2 + 3 + 1 = 22 minimal + max(5, 9) = 9 buffer = 31.
    // This is the case that triggered the bug report: 9-character skill
    // exports were hitting the old hardcoded cap of 20.
    expect(computeExportStepCap(9)).toBe(31)
  })

  it('returns 40 for 12 characters (28 minimal + 12 buffer)', () => {
    expect(computeExportStepCap(12)).toBe(40)
  })

  it('returns 64 for 20 characters (44 minimal + 20 buffer)', () => {
    expect(computeExportStepCap(20)).toBe(64)
  })

  it('guarantees step cap is always >= minimal workflow steps', () => {
    for (let n = 1; n <= 20; n++) {
      const minimalNeeded = 3 + n * 2 + 1 // setup + characters + finalize
      expect(computeExportStepCap(n)).toBeGreaterThan(minimalNeeded)
    }
  })

  it('handles 0 characters defensively (returns 9 = 4 minimal + 5 buffer)', () => {
    // Shouldn't happen in practice (runExportAgent requires at least one
    // soul), but the formula must not return negative or zero for edge
    // inputs. 0 characters → 4 minimal + 5 buffer = 9.
    expect(computeExportStepCap(0)).toBe(9)
  })

  it('handles negative input defensively (clamps to 0)', () => {
    // Math.max(0, -3) = 0 → same as 0-character case.
    expect(computeExportStepCap(-3)).toBe(9)
  })

  it('is monotonic: more characters = larger cap', () => {
    for (let n = 1; n < 20; n++) {
      expect(computeExportStepCap(n + 1)).toBeGreaterThan(computeExportStepCap(n))
    }
  })
})
