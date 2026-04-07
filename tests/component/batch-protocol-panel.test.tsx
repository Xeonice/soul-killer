import React from 'react'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render } from 'ink-testing-library'
import { BatchProtocolPanel } from '../../src/cli/animation/batch-protocol-panel.js'
import { setLocale } from '../../src/i18n/index.js'
import type { SoulTaskStatus } from '../../src/agent/batch-pipeline.js'

function makeStatus(name: string, overrides?: Partial<SoulTaskStatus>): SoulTaskStatus {
  return {
    name,
    description: `desc for ${name}`,
    phase: 'pending',
    toolCalls: [],
    distillToolCalls: [],
    fragments: 0,
    elapsedMs: 0,
    ...overrides,
  }
}

describe('BatchProtocolPanel', () => {
  beforeAll(() => {
    process.env.SOULKILLER_SEED = '42'
    setLocale('en')
  })

  afterAll(() => {
    delete process.env.SOULKILLER_SEED
    setLocale('zh')
  })

  it('renders compact view with all souls', () => {
    const statuses = [
      makeStatus('Alice', { phase: 'capturing', capturePhase: 'searching', fragments: 5 }),
      makeStatus('Bob', { phase: 'distilling', fragments: 10 }),
      makeStatus('Carol', { phase: 'pending' }),
    ]

    const { lastFrame } = render(<BatchProtocolPanel statuses={statuses} />)
    const frame = lastFrame()!

    expect(frame).toContain('BATCH CAPTURE [3]')
    expect(frame).toContain('Alice')
    expect(frame).toContain('Bob')
    expect(frame).toContain('Carol')
    expect(frame).toContain('capturing')
    expect(frame).toContain('distilling')
    expect(frame).toContain('pending')
  })

  it('shows summary line with counts', () => {
    const statuses = [
      makeStatus('Alice', { phase: 'done', fragments: 12 }),
      makeStatus('Bob', { phase: 'capturing' }),
      makeStatus('Carol', { phase: 'failed', error: 'rate limit' }),
    ]

    const { lastFrame } = render(<BatchProtocolPanel statuses={statuses} />)
    const frame = lastFrame()!

    expect(frame).toContain('1/3')
    expect(frame).toContain('complete')
    expect(frame).toContain('1')  // 1 active
    expect(frame).toContain('failed')
  })

  it('shows done checkmark and failed cross', () => {
    const statuses = [
      makeStatus('Alice', { phase: 'done' }),
      makeStatus('Bob', { phase: 'failed', error: 'oops' }),
    ]

    const { lastFrame } = render(<BatchProtocolPanel statuses={statuses} />)
    const frame = lastFrame()!

    expect(frame).toContain('✓')
    expect(frame).toContain('✗')
  })

  it('shows progress bar based on tool calls', () => {
    const statuses = [
      makeStatus('Alice', {
        phase: 'capturing',
        toolCalls: Array.from({ length: 5 }, (_, i) => ({
          tool: 'search',
          query: `q${i}`,
          status: 'done' as const,
          phase: 'searching' as const,
        })),
        fragments: 8,
      }),
    ]

    const { lastFrame } = render(<BatchProtocolPanel statuses={statuses} />)
    const frame = lastFrame()!

    // Should have some filled blocks
    expect(frame).toContain('█')
    expect(frame).toContain('8 frags')
  })
})
