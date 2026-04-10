import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { runInit } from '../../src/export/state/init.js'
import { parseStateFile } from '../../src/export/state/schema.js'
import { parseMiniYaml } from '../../src/export/state/mini-yaml.js'
import { createFixture, defaultScript, type Fixture } from './helpers/state-fixture.js'

describe('runInit', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('creates state.yaml with field set equal to schema field set', () => {
    fixture = createFixture()
    const result = runInit(fixture.skillRoot, 'script-001')
    expect(result.scriptId).toBe('script-001')
    expect(result.firstScene).toBe('scene-001')
    expect(result.fieldCount).toBe(4)

    const statePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    expect(existsSync(statePath)).toBe(true)
    const parsed = parseStateFile(readFileSync(statePath, 'utf8'))
    expect(parsed.currentScene).toBe('scene-001')
    expect(Object.keys(parsed.state).sort()).toEqual([
      'affinity.judy.bond',
      'affinity.judy.trust',
      'custom.location',
      'flags.met_johnny',
    ])
    expect(parsed.state['affinity.judy.trust']).toBe(3)
    expect(parsed.state['flags.met_johnny']).toBe(false)
    expect(parsed.state['custom.location']).toBe('bar')
  })

  it('writes meta.yaml with correct script_ref and current_scene', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const metaPath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/meta.yaml')
    const doc = parseMiniYaml(readFileSync(metaPath, 'utf8'))
    expect(doc.script_ref).toBe('script-001')
    expect(doc.current_scene).toBe('scene-001')
    expect(typeof doc.last_played_at).toBe('string')
  })

  it('accepts script id with or without script- prefix and .json extension', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, '001')
    expect(
      existsSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'))
    ).toBe(true)

    // Second call with .json extension — writes to same auto/ dir (overwrites)
    runInit(fixture.skillRoot, 'script-001.json')
    expect(
      existsSync(join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'))
    ).toBe(true)
  })

  it('rejects a script whose initial_state is missing a schema key', () => {
    const bad = defaultScript()
    delete bad.initial_state['affinity.judy.trust']
    fixture = createFixture(bad)
    expect(() => runInit(fixture!.skillRoot, 'script-001')).toThrow(
      /missing field "affinity\.judy\.trust"/
    )
  })

  it('rejects a script whose initial_state has extra key', () => {
    const bad = defaultScript()
    bad.initial_state['custom.ghost'] = 'x'
    fixture = createFixture(bad)
    expect(() => runInit(fixture!.skillRoot, 'script-001')).toThrow(
      /extra field "custom\.ghost"/
    )
  })

  it('throws on unknown script id', () => {
    fixture = createFixture()
    expect(() => runInit(fixture!.skillRoot, 'script-999')).toThrow(
      /cannot read script/
    )
  })
})
