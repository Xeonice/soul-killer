import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { SoulRecallPanel, type RecallResult } from '../../src/cli/animation/soul-recall-panel.js'

// Disable animation so revealedCount starts at results.length for deterministic snapshots
vi.mock('../../src/cli/animation/use-animation.js', () => ({
  isAnimationEnabled: () => false,
}))

const SAMPLE_RESULTS: RecallResult[] = [
  { path: 'data/conversations/2024-01-15.md', similarity: 0.92 },
  { path: 'data/notes/architecture-thoughts.md', similarity: 0.87 },
  { path: 'data/journal/weekly-review.md', similarity: 0.74 },
]

/** Wait for real async timers to fire and React to flush state updates. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('SoulRecallPanel', () => {
  it('renders initial state with no results revealed yet', () => {
    const { lastFrame } = render(
      <SoulRecallPanel
        results={SAMPLE_RESULTS}
        retrievalTimeMs={42}
        autoCollapseMs={0}
      />
    )
    // On first render the progressive-reveal effect has not fired yet
    expect(lastFrame()).toMatchSnapshot()
  })

  it('renders fully populated panel after all results are revealed', async () => {
    const { lastFrame } = render(
      <SoulRecallPanel
        results={SAMPLE_RESULTS}
        retrievalTimeMs={42}
        autoCollapseMs={0}
      />
    )

    // Each result is revealed by a 150ms setTimeout; wait past all three
    await wait(150 * SAMPLE_RESULTS.length + 100)

    expect(lastFrame()).toMatchSnapshot()
  })

  it('stays visible and does not call onCollapse when autoCollapseMs is 0', async () => {
    const onCollapse = vi.fn()
    const { lastFrame } = render(
      <SoulRecallPanel
        results={SAMPLE_RESULTS}
        retrievalTimeMs={42}
        autoCollapseMs={0}
        onCollapse={onCollapse}
      />
    )

    // Allow all reveal timers to complete
    await wait(150 * SAMPLE_RESULTS.length + 100)
    // Extra wait to confirm no collapse fires
    await wait(500)

    expect(lastFrame()).not.toBeNull()
    expect(onCollapse).not.toHaveBeenCalled()
  })

  it('renders with empty results list showing footer immediately', () => {
    const { lastFrame } = render(
      <SoulRecallPanel
        results={[]}
        retrievalTimeMs={5}
        autoCollapseMs={0}
      />
    )
    // With zero results, revealedCount starts at 0 which equals results.length (0),
    // so the footer renders on the first frame
    expect(lastFrame()).toMatchSnapshot()
  })
})
