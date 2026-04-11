import React from 'react'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { MalfunctionError } from '../../src/cli/animation/malfunction-error.js'
import { resetGlitchEngine } from '../../src/cli/animation/glitch-engine.js'

// Disable animation so glitch effects are never applied — ensures snapshot
// stability across environments (local config may differ from CI).
vi.mock('../../src/cli/animation/use-animation.js', () => ({
  isAnimationEnabled: () => false,
}))

// Set deterministic seed as a safety net (glitch won't fire with animation
// disabled, but keeps the engine predictable if any path does use it).
const ORIGINAL_SEED = process.env.SOULKILLER_SEED
beforeAll(() => {
  process.env.SOULKILLER_SEED = '42'
  resetGlitchEngine()
})
afterAll(() => {
  if (ORIGINAL_SEED === undefined) {
    delete process.env.SOULKILLER_SEED
  } else {
    process.env.SOULKILLER_SEED = ORIGINAL_SEED
  }
  resetGlitchEngine()
})

describe('MalfunctionError', () => {
  it('severity=warning renders warning border and label', () => {
    const { lastFrame } = render(
      <MalfunctionError
        severity="warning"
        title="Low memory"
        message="Soul cortex is running low on available memory."
        suggestions={['Free unused relics', 'Run /evolve to compact']}
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('severity=malfunction renders malfunction border and label', () => {
    const { lastFrame } = render(
      <MalfunctionError
        severity="malfunction"
        title="Retrieval failure"
        message="Unable to reach the memory cortex during recall."
        suggestions={['Check soul integrity with /status']}
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('severity=critical renders ASCII art header', () => {
    const { lastFrame } = render(
      <MalfunctionError
        severity="critical"
        title="Soul corruption detected"
        message="Core soul matrix has been fatally corrupted."
        suggestions={['Restore from backup', 'Re-run /evolve']}
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })
})
