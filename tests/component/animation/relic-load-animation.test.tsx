import React from 'react'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render } from 'ink-testing-library'
import { RelicLoadAnimation } from '../../../src/cli/animation/relic-load-animation.js'

describe('RelicLoadAnimation', () => {
  const originalSeed = process.env.SOULKILLER_SEED

  beforeAll(() => {
    process.env.SOULKILLER_SEED = '42'
  })

  afterAll(() => {
    if (originalSeed !== undefined) {
      process.env.SOULKILLER_SEED = originalSeed
    } else {
      delete process.env.SOULKILLER_SEED
    }
  })

  it('renders initial phase with glitched text (contains ▓ marker)', () => {
    const { lastFrame } = render(
      <RelicLoadAnimation soulName="强尼银手" chunkCount={4777} languages={['zh', 'en', 'ja']} onComplete={() => {}} />
    )
    const frame = lastFrame()!
    // Phase 1 always contains ▓ marker (glitch may replace other chars)
    expect(frame).toContain('▓')
    expect(frame.trim().length).toBeGreaterThan(5)
  })

  it('snapshot of initial phase (seeded glitch)', () => {
    const { lastFrame } = render(
      <RelicLoadAnimation soulName="douglastang" chunkCount={100} languages={['zh', 'en']} onComplete={() => {}} />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('renders with default values when no manifest data', () => {
    const { lastFrame } = render(
      <RelicLoadAnimation soulName="test-soul" onComplete={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('▓')
    expect(frame.length).toBeGreaterThan(0)
  })
})
