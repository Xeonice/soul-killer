import { describe, it, expect } from 'vitest'
import { parseScript, ScriptLoadError } from '../../../../src/export/state/script.js'

function minimalScript(scenes: Record<string, unknown>): string {
  return JSON.stringify({
    id: 'test-001',
    state_schema: { 'flags.a': { type: 'bool', desc: 'a', default: false } },
    initial_state: { 'flags.a': false },
    scenes,
    endings: [],
  })
}

describe('parseScript — affinity_gate handling', () => {
  it('gate scene without choices does not throw', () => {
    const script = minimalScript({
      'scene-gate': {
        type: 'affinity_gate',
        text: 'Gate narration',
        routing: [
          { route_id: 'route-a', condition: { all_of: [] }, next: 'scene-a01' },
          { route_id: 'route-b', condition: 'default', next: 'scene-b01' },
        ],
      },
    })
    const parsed = parseScript(script)
    const gate = parsed.scenes.get('scene-gate')!
    expect(gate).toBeDefined()
    expect(gate.choices).toEqual([])
    expect(gate.type).toBe('affinity_gate')
    expect(gate.routing).toHaveLength(2)
    expect(gate.routing![0]!.route_id).toBe('route-a')
    expect(gate.routing![1]!.next).toBe('scene-b01')
  })

  it('gate scene with empty choices array is valid', () => {
    const script = minimalScript({
      'scene-gate': {
        type: 'affinity_gate',
        text: '',
        choices: [],
        routing: [
          { route_id: 'r', condition: 'default', next: 'scene-x' },
        ],
      },
    })
    const parsed = parseScript(script)
    const gate = parsed.scenes.get('scene-gate')!
    expect(gate.choices).toEqual([])
    expect(gate.routing).toHaveLength(1)
  })

  it('gate scene without routing has routing undefined', () => {
    const script = minimalScript({
      'scene-gate': {
        type: 'affinity_gate',
        text: 'No routing',
      },
    })
    const parsed = parseScript(script)
    const gate = parsed.scenes.get('scene-gate')!
    expect(gate.choices).toEqual([])
    expect(gate.routing).toBeUndefined()
  })

  it('gate scene preserves route field', () => {
    const script = minimalScript({
      'scene-a01': {
        text: 'Route scene',
        choices: [],
        route: 'route-kiritsugu',
      },
    })
    const parsed = parseScript(script)
    const scene = parsed.scenes.get('scene-a01')!
    expect(scene.route).toBe('route-kiritsugu')
  })

  it('normal scene without choices still throws', () => {
    const script = minimalScript({
      'scene-001': {
        text: 'Normal scene',
      },
    })
    expect(() => parseScript(script)).toThrow(ScriptLoadError)
    expect(() => parseScript(script)).toThrow('scene "scene-001".choices must be an array')
  })

  it('normal scene with non-array choices still throws', () => {
    const script = minimalScript({
      'scene-001': {
        text: 'Normal scene',
        choices: 'not-an-array',
      },
    })
    expect(() => parseScript(script)).toThrow('scene "scene-001".choices must be an array')
  })
})
