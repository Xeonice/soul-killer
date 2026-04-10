import { describe, it, expect, afterEach } from 'vitest'
import { unlinkSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInit } from '../../src/export/state/init.js'
import { runValidate } from '../../src/export/state/validate.js'
import { createFixture, defaultScript, type Fixture } from './helpers/state-fixture.js'

describe('runValidate — core checks', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('returns ok on a fresh init', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runValidate(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('detects dangling script_ref', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // Remove the script file to simulate a dangling ref
    unlinkSync(fixture.scriptPath)
    const result = runValidate(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('DANGLING_SCRIPT_REF')
  })

  it('detects STATE_SCHEMA_MISSING', () => {
    const bad = defaultScript()
    delete (bad as unknown as Record<string, unknown>).state_schema
    fixture = createFixture()
    // Re-write script without state_schema
    writeFileSync(fixture.scriptPath, JSON.stringify(bad, null, 2), 'utf8')
    // Manually create meta.yaml pointing to the (now-broken) script
    runInitIntoBrokenScript(fixture)
    const result = runValidate(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('STATE_SCHEMA_MISSING')
  })

  it('detects INITIAL_STATE_MISMATCH when initial_state is missing a key', () => {
    const bad = defaultScript()
    delete bad.initial_state['affinity.judy.bond']
    bad.initial_state['custom.extra'] = 'x'
    fixture = createFixture(defaultScript())
    writeFileSync(fixture.scriptPath, JSON.stringify(bad, null, 2), 'utf8')
    runInitIntoBrokenScript(fixture)
    const result = runValidate(fixture.skillRoot, 'script-001')
    const codes = result.errors.map((e) => e.code)
    expect(codes).toContain('INITIAL_STATE_MISMATCH')
  })

  it('detects CONSEQUENCES_UNKNOWN_KEY', () => {
    const bad = defaultScript()
    bad.scenes['scene-001']!.choices[0]!.consequences = {
      'flags.ghost': true,
    }
    fixture = createFixture(bad)
    runInitIntoBrokenScript(fixture)
    const result = runValidate(fixture.skillRoot, 'script-001')
    const errors = result.errors.filter((e) => e.code === 'CONSEQUENCES_UNKNOWN_KEY')
    expect(errors).toHaveLength(1)
    expect(errors[0]?.field).toBe('flags.ghost')
  })

  it('detects SHARED_AXES_INCOMPLETE when sharedAxes option provided', () => {
    // Default fixture only has judy.bond + judy.trust — missing judy.rivalry
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', {
      sharedAxes: ['trust', 'rivalry'],
    })
    const errors = result.errors.filter((e) => e.code === 'SHARED_AXES_INCOMPLETE')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.map((e) => e.field)).toContain('affinity.judy.rivalry')
  })

  it('detects FLAGS_SET_MISMATCH in both directions', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // storyFlags has "other" that script doesn't have, and script has "met_johnny" which is not in storyFlags
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', {
      storyFlags: ['other'],
    })
    const codes = result.errors
      .filter((e) => e.code === 'FLAGS_SET_MISMATCH')
      .map((e) => e.field)
    expect(codes).toContain('flags.other') // missing from script
    expect(codes).toContain('flags.met_johnny') // extra in script
  })
})

describe('runValidate — continue game', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('accepts a well-formed continue game', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', { continueGame: true })
    expect(result.ok).toBe(true)
  })

  it('detects FIELD_MISSING when state.yaml lacks a schema field', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    // Overwrite state.yaml with a missing field
    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    writeFileSync(
      statePath,
      'current_scene: scene-001\nstate:\n  "affinity.judy.bond": 0\n  "flags.met_johnny": false\n  "custom.location": bar\n',
      'utf8'
    )
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', { continueGame: true })
    const missing = result.errors.filter((e) => e.code === 'FIELD_MISSING')
    expect(missing.length).toBe(1)
    expect(missing[0]?.field).toBe('affinity.judy.trust')
  })

  it('detects FIELD_EXTRA when state.yaml has a field not in schema', () => {
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
        '  "custom.ghost": bar\n',
      'utf8'
    )
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', { continueGame: true })
    const extra = result.errors.filter((e) => e.code === 'FIELD_EXTRA')
    expect(extra.length).toBe(1)
    expect(extra[0]?.field).toBe('custom.ghost')
  })

  it('never modifies state.yaml or meta.yaml (read-only contract)', () => {
    fixture = createFixture()
    runInit(fixture!.skillRoot, 'script-001')
    const statePath = join(fixture!.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const metaPath = join(fixture!.skillRoot, 'runtime/saves/script-001/auto/meta.yaml')
    const badStateContent =
      'current_scene: scene-001\n' +
      'state:\n' +
      '  "affinity.judy.bond": 0\n' +
      '  "affinity.judy.trust": oops\n' +
      '  "flags.met_johnny": false\n' +
      '  "custom.location": bar\n' +
      '  "custom.ghost": nope\n'
    writeFileSync(statePath, badStateContent, 'utf8')

    const stateBytesBefore = readFileSync(statePath)
    const metaBytesBefore = readFileSync(metaPath)

    const result = runValidate(fixture!.skillRoot, 'script-001', 'auto', { continueGame: true })
    expect(result.ok).toBe(false)

    const stateBytesAfter = readFileSync(statePath)
    const metaBytesAfter = readFileSync(metaPath)
    expect(stateBytesAfter.equals(stateBytesBefore)).toBe(true)
    expect(metaBytesAfter.equals(metaBytesBefore)).toBe(true)
  })

  it('detects FIELD_TYPE_MISMATCH', () => {
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
    const result = runValidate(fixture.skillRoot, 'script-001', 'auto', { continueGame: true })
    const typeErrs = result.errors.filter((e) => e.code === 'FIELD_TYPE_MISMATCH')
    expect(typeErrs.length).toBe(1)
    expect(typeErrs[0]?.field).toBe('affinity.judy.trust')
  })
})

/**
 * Helper: write a meta.yaml pointing at the broken script without going
 * through runInit (which would fail on the broken script).
 */
function runInitIntoBrokenScript(fixture: Fixture): void {
  const saveDir = join(fixture.skillRoot, 'runtime/saves/script-001/auto')
  require('node:fs').mkdirSync(saveDir, { recursive: true })
  writeFileSync(
    join(saveDir, 'meta.yaml'),
    'script_ref: script-001\ncurrent_scene: scene-001\n',
    'utf8'
  )
  writeFileSync(
    join(saveDir, 'state.yaml'),
    'current_scene: scene-001\nstate:\n',
    'utf8'
  )
}
