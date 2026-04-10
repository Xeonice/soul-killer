/**
 * Tests for the export planning phase: validatePlan + plan_ready/plan_confirmed
 * event handling in reducePanelEvent.
 */
import { describe, it, expect } from 'vitest'
import {
  __TEST_ONLY_validatePlan as validatePlan,
  type ExportPlan,
} from '../../src/export/agent/index.js'
import {
  createInitialPanelState,
  reducePanelEvent,
} from '../../src/cli/animation/export-protocol-panel.js'

// --- validatePlan tests ---

describe('validatePlan', () => {
  const preSelectedSouls = ['阿尔托莉雅·潘德拉贡', '远坂凛', '間桐桜']

  function validPlan(): ExportPlan {
    return {
      genre_direction: '魔术战争 / 心理剧',
      tone_direction: '理想与现实的碰撞',
      shared_axes: ['trust', 'corruption'],
      flags: ['saber_trust_established', 'truth_revealed'],
      prose_direction: 'type-moon 系日翻中视觉小说风格',
      characters: [
        { name: '阿尔托莉雅·潘德拉贡', role: 'protagonist', specific_axes_direction: ['荣誉感'], needs_voice_summary: false },
        { name: '远坂凛', role: 'deuteragonist', specific_axes_direction: ['傲娇程度'], needs_voice_summary: false },
        { name: '間桐桜', role: 'deuteragonist', specific_axes_direction: ['黑化程度'], needs_voice_summary: true },
      ],
    }
  }

  it('returns null for a valid plan', () => {
    expect(validatePlan(validPlan(), preSelectedSouls)).toBeNull()
  })

  it('rejects empty genre_direction', () => {
    const plan = validPlan()
    plan.genre_direction = ''
    expect(validatePlan(plan, preSelectedSouls)).toContain('genre_direction')
  })

  it('rejects empty tone_direction', () => {
    const plan = validPlan()
    plan.tone_direction = '   '
    expect(validatePlan(plan, preSelectedSouls)).toContain('tone_direction')
  })

  it('rejects empty prose_direction', () => {
    const plan = validPlan()
    plan.prose_direction = ''
    expect(validatePlan(plan, preSelectedSouls)).toContain('prose_direction')
  })

  it('rejects shared_axes with wrong count', () => {
    const plan = validPlan()
    ;(plan as any).shared_axes = ['trust']
    expect(validatePlan(plan, preSelectedSouls)).toContain('2')
  })

  it('rejects non-snake_case shared_axes', () => {
    const plan = validPlan()
    plan.shared_axes = ['Trust', 'corruption']
    expect(validatePlan(plan, preSelectedSouls)).toContain('snake_case')
  })

  it('rejects duplicate shared_axes', () => {
    const plan = validPlan()
    plan.shared_axes = ['trust', 'trust']
    expect(validatePlan(plan, preSelectedSouls)).toContain('different')
  })

  it('rejects empty flags', () => {
    const plan = validPlan()
    plan.flags = []
    expect(validatePlan(plan, preSelectedSouls)).toContain('flags')
  })

  it('rejects non-snake_case flags', () => {
    const plan = validPlan()
    plan.flags = ['saber_trust', 'BadFlag']
    expect(validatePlan(plan, preSelectedSouls)).toContain('snake_case')
  })

  it('rejects missing characters', () => {
    const plan = validPlan()
    plan.characters = plan.characters.slice(0, 2) // remove 間桐桜
    expect(validatePlan(plan, preSelectedSouls)).toContain('間桐桜')
  })

  it('rejects extra characters not in preSelected', () => {
    const plan = validPlan()
    plan.characters.push({ name: '幻想角色', role: 'antagonist', specific_axes_direction: [], needs_voice_summary: false })
    expect(validatePlan(plan, preSelectedSouls)).toContain('幻想角色')
  })

  it('rejects plan without protagonist', () => {
    const plan = validPlan()
    plan.characters[0]!.role = 'deuteragonist'
    expect(validatePlan(plan, preSelectedSouls)).toContain('protagonist')
  })

  it('rejects character with > 2 specific_axes_direction', () => {
    const plan = validPlan()
    plan.characters[0]!.specific_axes_direction = ['a', 'b', 'c']
    expect(validatePlan(plan, preSelectedSouls)).toContain('2')
  })
})

// --- reducePanelEvent plan events ---

describe('reducePanelEvent plan events', () => {
  it('handles plan_ready → plan_review zone', () => {
    let state = createInitialPanelState()
    const plan: ExportPlan = {
      genre_direction: '奇幻',
      tone_direction: '黑暗',
      shared_axes: ['trust', 'rivalry'],
      flags: ['flag_a'],
      prose_direction: '日系风格',
      characters: [
        { name: 'A', role: 'protagonist', specific_axes_direction: [], needs_voice_summary: false },
      ],
    }

    state = reducePanelEvent(state, { type: 'plan_ready', plan })
    expect(state.phase).toBe('plan_review')
    expect(state.activeZone.type).toBe('plan_review')
    if (state.activeZone.type === 'plan_review') {
      expect(state.activeZone.plan.characters).toHaveLength(1)
    }
  })

  it('handles plan_confirmed → moves plan to planningTrail', () => {
    let state = createInitialPanelState()
    const plan: ExportPlan = {
      genre_direction: '奇幻',
      tone_direction: '黑暗',
      shared_axes: ['trust', 'rivalry'],
      flags: ['flag_a'],
      prose_direction: '日系风格',
      characters: [
        { name: 'A', role: 'protagonist', specific_axes_direction: [], needs_voice_summary: false },
      ],
    }

    state = reducePanelEvent(state, { type: 'plan_ready', plan })
    state = reducePanelEvent(state, { type: 'plan_confirmed' })
    expect(state.activeZone.type).toBe('idle')
    expect(state.planningTrail.length).toBeGreaterThan(0)
  })

  it('tool_end during planning phase goes to planningTrail', () => {
    let state = createInitialPanelState()
    state = reducePanelEvent(state, { type: 'phase', phase: 'planning' })
    state = reducePanelEvent(state, { type: 'tool_end', tool: 'submit_plan', result_summary: '3 chars' })
    expect(state.planningTrail).toHaveLength(1)
    expect(state.trail).toHaveLength(0)
  })

  it('character grouping merges add_character + set_character_axes', () => {
    let state = createInitialPanelState()
    state = reducePanelEvent(state, { type: 'phase', phase: 'analyzing' })

    // add_character → pending
    state = reducePanelEvent(state, {
      type: 'tool_end',
      tool: 'add_character',
      result_summary: 'Character 1/3 added: Saber (protagonist)',
    })
    expect(state.trail).toHaveLength(0) // not yet in trail
    expect(state._pendingCharacter).toBeDefined()

    // set_character_axes → merged into trail
    state = reducePanelEvent(state, {
      type: 'tool_end',
      tool: 'set_character_axes',
      result_summary: 'Axes set for Saber: specific=[荣誉感]',
    })
    expect(state.trail).toHaveLength(1)
    expect(state.trail[0]!.description).toBe('Saber')
    expect(state.trail[0]!.summary).toContain('protagonist')
    expect(state.trail[0]!.summary).toContain('荣誉感')
    expect(state._pendingCharacter).toBeUndefined()
  })
})
