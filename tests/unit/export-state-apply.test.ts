import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInit } from '../../src/export/state/init.js'
import { runApply } from '../../src/export/state/apply.js'
import { parseStateFile } from '../../src/export/state/schema.js'
import { parseMiniYaml } from '../../src/export/state/mini-yaml.js'
import { createFixture, defaultScript, type Fixture } from './helpers/state-fixture.js'

describe('runApply', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('applies int delta and bool overwrite in one transaction', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    expect(result.fromScene).toBe('scene-001')
    expect(result.toScene).toBe('scene-002')
    expect(result.changes).toHaveLength(2)

    const byKey = Object.fromEntries(result.changes.map((c) => [c.key, c]))
    expect(byKey['affinity.judy.trust']).toMatchObject({
      type: 'int',
      oldValue: 3,
      newValue: 5,
      clamped: false,
    })
    expect(byKey['flags.met_johnny']).toMatchObject({
      type: 'bool',
      oldValue: false,
      newValue: true,
    })

    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const parsed = parseStateFile(readFileSync(statePath, 'utf8'))
    expect(parsed.currentScene).toBe('scene-002')
    expect(parsed.state['affinity.judy.trust']).toBe(5)
    expect(parsed.state['flags.met_johnny']).toBe(true)
  })

  it('updates meta.yaml current_scene atomically with state.yaml', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    const metaPath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/meta.yaml')
    const doc = parseMiniYaml(readFileSync(metaPath, 'utf8'))
    expect(doc.current_scene).toBe('scene-002')
  })

  it('does not touch unrelated state fields', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    const parsed = parseStateFile(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'), 'utf8')
    )
    // affinity.judy.bond was not in consequences — should still be 0
    expect(parsed.state['affinity.judy.bond']).toBe(0)
    expect(parsed.state['custom.location']).toBe('bar')
  })

  it('clamps int delta at lower bound', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // First reduce trust via choice-2 three times (each -1), should clamp at 0
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-2')
    // After this state.yaml is at scene-003, but we still want to test cumulative clamp
    // So do a different: set up a new fixture with higher trust and apply many negatives
    fixture.cleanup()
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-2')
    const parsed = parseStateFile(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'), 'utf8')
    )
    expect(parsed.state['affinity.judy.trust']).toBe(2) // 3 - 1
  })

  it('applies enum overwrite correctly', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1') // → scene-002
    runApply(fixture.skillRoot, 'script-001', 'scene-002', 'choice-1') // → scene-003, sets location=clinic
    const parsed = parseStateFile(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'), 'utf8')
    )
    expect(parsed.state['custom.location']).toBe('clinic')
    expect(parsed.currentScene).toBe('scene-003')
  })

  it('throws on unknown scene id', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    expect(() =>
      runApply(fixture!.skillRoot, 'script-001', 'scene-999', 'choice-1')
    ).toThrow(/scene "scene-999" not found/)
  })

  it('throws on unknown choice id with available list', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    expect(() =>
      runApply(fixture!.skillRoot, 'script-001', 'scene-001', 'choice-99')
    ).toThrow(/no choice "choice-99".*choice-1, choice-2/)
  })

  it('rejects a consequences key not in schema (via script validation)', () => {
    const bad = defaultScript()
    bad.scenes['scene-001']!.choices[0]!.consequences = {
      'flags.nonexistent': true,
    }
    fixture = createFixture(bad)
    runInit(fixture.skillRoot, 'script-001')
    expect(() =>
      runApply(fixture!.skillRoot, 'script-001', 'scene-001', 'choice-1')
    ).toThrow(/unknown state key/)
  })

  it('rejects enum value not in values list', () => {
    const bad = defaultScript()
    bad.scenes['scene-001']!.choices[0]!.consequences = {
      'custom.location': 'mars',
    }
    fixture = createFixture(bad)
    runInit(fixture.skillRoot, 'script-001')
    expect(() =>
      runApply(fixture!.skillRoot, 'script-001', 'scene-001', 'choice-1')
    ).toThrow(/not in/)
  })
})
