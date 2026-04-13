import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { runInit } from '../../../../src/export/state/init.js'
import { runApply } from '../../../../src/export/state/apply.js'
import { runReset } from '../../../../src/export/state/reset.js'
import { runRebuild } from '../../../../src/export/state/rebuild.js'
import { parseStateFile } from '../../../../src/export/state/schema.js'
import { parseMiniYaml } from '../../../../src/export/state/mini-yaml.js'
import { createFixture, type Fixture } from './helpers/state-fixture.js'

describe('runReset', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('restores all fields to defaults and resets current_scene', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // Mutate some state via apply
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1') // → scene-002, trust +2, met_johnny true
    runApply(fixture.skillRoot, 'script-001', 'scene-002', 'choice-1') // → scene-003, location=clinic

    // Verify we actually mutated state before resetting
    const before = parseStateFile(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'), 'utf8')
    )
    expect(before.state['affinity.judy.trust']).toBe(5)
    expect(before.state['custom.location']).toBe('clinic')

    const result = runReset(fixture.skillRoot, 'script-001')
    expect(result.firstScene).toBe('scene-001')
    expect(result.fieldCount).toBe(4)

    const parsed = parseStateFile(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'), 'utf8')
    )
    expect(parsed.currentScene).toBe('scene-001')
    expect(parsed.state['affinity.judy.trust']).toBe(3)
    expect(parsed.state['flags.met_johnny']).toBe(false)
    expect(parsed.state['custom.location']).toBe('bar')
  })

  it('clears history.log on reset', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    runReset(fixture.skillRoot, 'script-001')
    const hPath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/history.log')
    const content = readFileSync(hPath, 'utf8')
    expect(content).toBe('')
  })

  it('updates meta.yaml current_scene back to first scene', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    runReset(fixture.skillRoot, 'script-001')
    const meta = parseMiniYaml(
      readFileSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/meta.yaml'), 'utf8')
    )
    expect(meta.current_scene).toBe('scene-001')
    expect(meta.script_ref).toBe('script-001')
  })
})

describe('runRebuild', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('keeps valid existing fields and defaults missing ones', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // Apply some changes that should be preserved
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    // Now corrupt state.yaml: drop custom.location
    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    writeFileSync(
      statePath,
      'current_scene: scene-002\n' +
        'state:\n' +
        '  "affinity.judy.bond": 0\n' +
        '  "affinity.judy.trust": 5\n' +
        '  "flags.met_johnny": true\n',
      'utf8'
    )

    const result = runRebuild(fixture.skillRoot, 'script-001')
    expect(result.keptFields.sort()).toEqual([
      'affinity.judy.bond',
      'affinity.judy.trust',
      'flags.met_johnny',
    ])
    expect(result.defaultedFields).toEqual(['custom.location'])
    expect(result.droppedFields).toEqual([])

    const parsed = parseStateFile(readFileSync(statePath, 'utf8'))
    expect(parsed.state['affinity.judy.trust']).toBe(5) // preserved
    expect(parsed.state['flags.met_johnny']).toBe(true) // preserved
    expect(parsed.state['custom.location']).toBe('bar') // defaulted
    expect(parsed.currentScene).toBe('scene-002') // preserved
  })

  it('drops extra fields not in schema', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    writeFileSync(
      statePath,
      'current_scene: scene-001\n' +
        'state:\n' +
        '  "affinity.judy.bond": 0\n' +
        '  "affinity.judy.trust": 3\n' +
        '  "flags.met_johnny": false\n' +
        '  "custom.location": bar\n' +
        '  "custom.ghost": nope\n',
      'utf8'
    )
    const result = runRebuild(fixture.skillRoot, 'script-001')
    expect(result.droppedFields).toEqual(['custom.ghost'])
    const parsed = parseStateFile(readFileSync(statePath, 'utf8'))
    expect(Object.keys(parsed.state).sort()).toEqual([
      'affinity.judy.bond',
      'affinity.judy.trust',
      'custom.location',
      'flags.met_johnny',
    ])
  })

  it('defaults fields with wrong type', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    writeFileSync(
      statePath,
      'current_scene: scene-001\n' +
        'state:\n' +
        '  "affinity.judy.bond": 0\n' +
        '  "affinity.judy.trust": oops\n' +
        '  "flags.met_johnny": false\n' +
        '  "custom.location": bar\n',
      'utf8'
    )
    const result = runRebuild(fixture.skillRoot, 'script-001')
    expect(result.defaultedFields).toEqual(['affinity.judy.trust'])
    const parsed = parseStateFile(readFileSync(statePath, 'utf8'))
    expect(parsed.state['affinity.judy.trust']).toBe(3) // schema default
  })
})
