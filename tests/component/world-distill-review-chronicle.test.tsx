import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { WorldDistillReview } from '../../src/cli/commands/world/world-distill-review.js'
import type { GeneratedEntry } from '../../src/world/distill.js'

const noop = () => {}

function timelineEntry(opts: { sortKeyInferred?: boolean }): GeneratedEntry {
  return {
    meta: {
      name: '208-battle-of-chibi',
      keywords: ['chibi'],
      priority: 950,
      mode: 'always',
      scope: 'chronicle',
      sort_key: 208,
      display_time: '208 年',
      ...(opts.sortKeyInferred === false ? { sort_key_inferred: false } : {}),
    },
    content: '208 年 · 赤壁之战，三国格局奠定',
    chronicleType: 'timeline',
  }
}

describe('WorldDistillReview chronicle markers', () => {
  it('renders the chronicle header for chronicle entries', () => {
    const { lastFrame } = render(
      <WorldDistillReview
        entries={[timelineEntry({})]}
        onComplete={noop}
        onCancel={noop}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Chronicle')
    expect(frame).toContain('timeline')
    expect(frame).toContain('208 年')
    expect(frame).toContain('208')
  })

  it('shows the unreliable-time warning when sort_key_inferred is false', () => {
    const { lastFrame } = render(
      <WorldDistillReview
        entries={[timelineEntry({ sortKeyInferred: false })]}
        onComplete={noop}
        onCancel={noop}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('时间不可靠')
    expect(frame).toContain('启发式推断')
  })

  it('does not show the unreliable warning when sort_key is trustworthy', () => {
    const { lastFrame } = render(
      <WorldDistillReview
        entries={[timelineEntry({})]}
        onComplete={noop}
        onCancel={noop}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).not.toContain('时间不可靠')
  })

  it('does not show chronicle header for normal entries', () => {
    const normal: GeneratedEntry = {
      meta: {
        name: 'plain-bg',
        keywords: [],
        priority: 100,
        mode: 'always',
        scope: 'background',
      },
      content: 'plain content',
    }
    const { lastFrame } = render(
      <WorldDistillReview
        entries={[normal]}
        onComplete={noop}
        onCancel={noop}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).not.toContain('Chronicle')
    expect(frame).not.toContain('时间不可靠')
  })
})
