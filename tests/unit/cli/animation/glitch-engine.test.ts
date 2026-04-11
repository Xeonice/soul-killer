import { describe, it, expect } from 'vitest'
import { GlitchEngine } from '../../../../src/cli/animation/glitch-engine.js'

describe('GlitchEngine', () => {
  it('produces deterministic output with same seed', () => {
    const a = new GlitchEngine(42)
    const b = new GlitchEngine(42)
    const resultA = a.glitchText('Hello World', 0.5)
    const resultB = b.glitchText('Hello World', 0.5)
    expect(resultA).toBe(resultB)
  })

  it('produces different output with different seeds', () => {
    const a = new GlitchEngine(42)
    const b = new GlitchEngine(99)
    const resultA = a.glitchText('Hello World', 0.5)
    const resultB = b.glitchText('Hello World', 0.5)
    expect(resultA).not.toBe(resultB)
  })

  it('returns original text with intensity 0', () => {
    const engine = new GlitchEngine(42)
    const result = engine.glitchText('Hello World', 0)
    expect(result).toBe('Hello World')
  })

  it('replaces all non-space chars with intensity 1', () => {
    const engine = new GlitchEngine(42)
    const result = engine.glitchText('Hello World', 1)
    expect(result[5]).toBe(' ')
    for (let i = 0; i < result.length; i++) {
      if (result[i] !== ' ') {
        expect(result[i]).not.toBe('Hello World'[i])
      }
    }
  })

  it('preserves newlines during glitch', () => {
    const engine = new GlitchEngine(42)
    const result = engine.glitchText('Hello\nWorld', 1)
    expect(result).toContain('\n')
  })

  it('generates hex pairs of correct format', () => {
    const engine = new GlitchEngine(42)
    const pair = engine.hexPair()
    expect(pair).toMatch(/^[0-9A-F]{2}$/)
  })

  it('generates hex matrix lines with correct pair count', () => {
    const engine = new GlitchEngine(42)
    const line = engine.hexMatrixLine(5)
    const pairs = line.split(' ')
    expect(pairs).toHaveLength(5)
    pairs.forEach((p) => expect(p).toMatch(/^[0-9A-F]{2}$/))
  })

  it('random() returns values in [0, 1)', () => {
    const engine = new GlitchEngine(42)
    for (let i = 0; i < 100; i++) {
      const val = engine.random()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})
