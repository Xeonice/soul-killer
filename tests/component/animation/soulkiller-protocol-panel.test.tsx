import React from 'react'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render } from 'ink-testing-library'
import { SoulkillerProtocolPanel } from '../../../src/cli/animation/soulkiller-protocol-panel.js'
import { setLocale } from '../../../src/infra/i18n/index.js'

describe('SoulkillerProtocolPanel', () => {
  const originalSeed = process.env.SOULKILLER_SEED

  beforeAll(() => {
    process.env.SOULKILLER_SEED = '42'
    setLocale('en')
  })

  afterAll(() => {
    if (originalSeed !== undefined) {
      process.env.SOULKILLER_SEED = originalSeed
    } else {
      delete process.env.SOULKILLER_SEED
    }
    setLocale('zh')
  })

  it('renders initiating phase with glitch text', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="强尼银手"
        toolCalls={[]}
        phase="initiating"
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('SOULKILLER PROTOCOL')
    expect(frame).toContain('▓')
  })

  it('renders searching phase with tool calls', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="强尼银手"
        classification="DIGITAL_CONSTRUCT"
        origin="Cyberpunk 2077"
        toolCalls={[
          { tool: 'search', query: '强尼银手 是谁', status: 'done', resultCount: 5 },
          { tool: 'wikipedia', query: 'Johnny Silverhand', status: 'running' },
        ]}
        phase="searching"
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('SOULKILLER PROTOCOL')
    expect(frame).toContain('✓') // initiating done
    expect(frame).toContain('DIGITAL CONSTRUCT')
    expect(frame).toContain('5 results')
    expect(frame).toContain('Johnny Silverhand')
  })

  it('renders complete phase with fragment count', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="强尼银手"
        classification="DIGITAL_CONSTRUCT"
        origin="Cyberpunk 2077"
        toolCalls={[
          { tool: 'search', query: '强尼银手 是谁', status: 'done', resultCount: 5 },
          { tool: 'wikipedia', query: 'Johnny Silverhand', status: 'done', resultCount: 2 },
          { tool: 'search', query: '强尼银手 台词', status: 'done', resultCount: 4 },
        ]}
        totalFragments={47}
        elapsedTime={12300}
        phase="complete"
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('47')
    expect(frame).toContain('12.3s')
  })

  it('renders unknown entity malfunction panel', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="RandomPerson123"
        classification="UNKNOWN_ENTITY"
        toolCalls={[]}
        phase="unknown"
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('MANUAL EXTRACTION REQUIRED')
    expect(frame).toContain('UNKNOWN ENTITY')
    expect(frame).toContain('INSUFFICIENT')
    expect(frame).toContain('RandomPerson123')
  })

  it('snapshot: complete phase', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="Linus Torvalds"
        classification="PUBLIC_ENTITY"
        origin="Linux Foundation"
        toolCalls={[
          { tool: 'search', query: 'Linus Torvalds who is', status: 'done', resultCount: 5 },
          { tool: 'wikipedia', query: 'Linus Torvalds', status: 'done', resultCount: 2 },
          { tool: 'search', query: 'Linus Torvalds interview opinions', status: 'done', resultCount: 4 },
          { tool: 'search', query: 'Linus Torvalds personality MBTI', status: 'done', resultCount: 3 },
        ]}
        totalFragments={32}
        elapsedTime={8500}
        phase="complete"
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('snapshot: unknown entity', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        targetName="NoOneKnows"
        classification="UNKNOWN_ENTITY"
        toolCalls={[]}
        phase="unknown"
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('renders world mode with WORLDFORGE PROTOCOL title', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        mode="world"
        targetName="Night City"
        toolCalls={[]}
        phase="initiating"
        classificationLabels={{
          FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE',
          REAL_SETTING: 'REAL SETTING',
          UNKNOWN_SETTING: 'UNKNOWN SETTING',
        }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('WORLDFORGE PROTOCOL')
    expect(frame).not.toContain('SOULKILLER PROTOCOL')
  })

  it('snapshot: world mode complete', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        mode="world"
        targetName="Night City"
        classification="FICTIONAL_UNIVERSE"
        classificationLabels={{
          FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE',
          REAL_SETTING: 'REAL SETTING',
          UNKNOWN_SETTING: 'UNKNOWN SETTING',
        }}
        origin="Cyberpunk 2077"
        toolCalls={[
          { tool: 'search', query: 'Night City wiki', status: 'done', resultCount: 8 },
          { tool: 'search', query: 'Night City districts', status: 'done', resultCount: 5 },
        ]}
        totalFragments={24}
        elapsedTime={12000}
        phase="complete"
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('snapshot: world mode unknown setting', () => {
    const { lastFrame } = render(
      <SoulkillerProtocolPanel
        mode="world"
        targetName="MyOriginalWorld"
        classification="UNKNOWN_SETTING"
        classificationLabels={{
          FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE',
          REAL_SETTING: 'REAL SETTING',
          UNKNOWN_SETTING: 'UNKNOWN SETTING',
        }}
        toolCalls={[]}
        phase="unknown"
      />
    )
    expect(lastFrame()).toMatchSnapshot()
  })
})
