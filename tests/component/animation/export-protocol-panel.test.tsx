import React from 'react'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render } from 'ink-testing-library'
import {
  ExportProtocolPanel,
  createInitialPanelState,
  reducePanelEvent,
} from '../../../src/cli/animation/export-protocol-panel.js'
import { setLocale } from '../../../src/infra/i18n/index.js'

describe('ExportProtocolPanel', () => {
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

  it('renders initiating phase', () => {
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="initiating"
        planningTrail={[]}
        trail={[]}
        activeZone={{ type: 'idle' }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('EXPORT PROTOCOL')
  })

  it('renders tool call progress', () => {
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="selecting"
        planningTrail={[]}
        trail={[]}
        activeZone={{ type: 'tool', tool: 'list_souls' }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('list_souls')
    expect(frame).toContain('🔍')
  })

  it('renders select active zone', () => {
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="selecting"
        planningTrail={[]}
        trail={[{ description: 'list_souls', summary: '3 souls' }]}
        activeZone={{
          type: 'select',
          question: 'select soul',
          options: [
            { label: 'V', description: 'public · v0.3.0' },
            { label: 'Johnny', description: 'public · v0.1.0' },
          ],
          cursor: 0,
        }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('select soul')
    expect(frame).toContain('V')
    expect(frame).toContain('Johnny')
    expect(frame).toContain('❯')
  })

  it('renders packaging progress', () => {
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="packaging"
        planningTrail={[]}
        trail={[
          { description: 'list_souls', summary: '1 souls' },
          { description: 'select soul', summary: 'V' },
        ]}
        activeZone={{
          type: 'packaging',
          steps: [
            { name: 'copy_soul', status: 'done' },
            { name: 'copy_world', status: 'running' },
            { name: 'gen_story_spec', status: 'pending' },
            { name: 'gen_skill', status: 'pending' },
          ],
        }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('✓')
    expect(frame).toContain('○')
  })

  it('renders complete result', () => {
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="complete"
        planningTrail={[]}
        trail={[]}
        activeZone={{
          type: 'complete',
          output_file: '/home/.soulkiller/exports/v-in-cyberpunk-2077.skill',
          file_count: 3,
          size_bytes: 4096,
          skill_name: 'v-in-cyberpunk-2077.skill',
        }}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('export complete')
    expect(frame).toContain('.skill')
    expect(frame).toContain('v-in-cyberpunk-2077')
    expect(frame).toContain('3 files')
  })

  it('renders trail with collapse for 5+ steps', () => {
    const trail = [
      { description: 'step 1', summary: 'done 1' },
      { description: 'step 2', summary: 'done 2' },
      { description: 'step 3', summary: 'done 3' },
      { description: 'step 4', summary: 'done 4' },
      { description: 'step 5', summary: 'done 5' },
    ]
    const { lastFrame } = render(
      <ExportProtocolPanel
        phase="configuring"
        planningTrail={[]}
        trail={trail}
        activeZone={{ type: 'idle' }}
      />
    )
    const frame = lastFrame()!
    // Early steps should be collapsed, recent 2 should be visible
    expect(frame).toContain('step 4')
    expect(frame).toContain('step 5')
  })
})

describe('reducePanelEvent', () => {
  it('transitions through tool_start and tool_end', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, { type: 'tool_start', tool: 'list_souls' })
    expect(state.activeZone.type).toBe('tool')

    state = reducePanelEvent(state, { type: 'tool_end', tool: 'list_souls', result_summary: '3 souls' })
    expect(state.activeZone.type).toBe('idle')
    expect(state.trail).toHaveLength(1)
    expect(state.trail[0]!.summary).toBe('3 souls')
  })

  it('handles ask_user_start with options', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, {
      type: 'ask_user_start',
      question: 'pick one',
      options: [{ label: 'A' }, { label: 'B' }],
    })
    expect(state.activeZone.type).toBe('select')
  })

  it('handles ask_user_start without options (free input)', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, {
      type: 'ask_user_start',
      question: 'describe your idea',
      allow_free_input: true,
    })
    expect(state.activeZone.type).toBe('text_input')
  })

  it('reasoning_progress attaches reasoning info to idle zone', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, {
      type: 'reasoning_progress',
      chars: 1200,
      tokens: 300,
    })

    expect(state.activeZone.type).toBe('idle')
    if (state.activeZone.type === 'idle') {
      expect(state.activeZone.reasoning).toBeDefined()
      expect(state.activeZone.reasoning?.tokens).toBe(300)
      expect(state.activeZone.reasoning?.chars).toBe(1200)
    }
  })

  it('reasoning_progress is dropped when an active tool is running', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, { type: 'tool_start', tool: 'list_souls' })
    expect(state.activeZone.type).toBe('tool')

    state = reducePanelEvent(state, {
      type: 'reasoning_progress',
      chars: 1200,
      tokens: 300,
    })
    // Tool zone preserved — reasoning is irrelevant when concrete progress is showing
    expect(state.activeZone.type).toBe('tool')
  })

  it('tool_end clears reasoning info from idle zone', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, {
      type: 'reasoning_progress',
      chars: 500,
      tokens: 125,
    })
    state = reducePanelEvent(state, { type: 'tool_start', tool: 'list_souls' })
    state = reducePanelEvent(state, { type: 'tool_end', tool: 'list_souls', result_summary: 'done' })

    expect(state.activeZone.type).toBe('idle')
    if (state.activeZone.type === 'idle') {
      expect(state.activeZone.reasoning).toBeUndefined()
    }
  })

  it('handles complete event', () => {
    let state = createInitialPanelState()

    state = reducePanelEvent(state, {
      type: 'complete',
      output_file: '/tmp/test-skill.skill',
      file_count: 5,
      size_bytes: 2048,
      skill_name: 'test-skill.skill',
    })
    expect(state.phase).toBe('complete')
    expect(state.activeZone.type).toBe('complete')
    if (state.activeZone.type === 'complete') {
      expect(state.activeZone.skill_name).toBe('test-skill.skill')
      expect(state.activeZone.output_file).toBe('/tmp/test-skill.skill')
      expect(state.activeZone.file_count).toBe(5)
    }
  })
})
