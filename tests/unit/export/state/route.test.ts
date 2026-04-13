import { describe, it, expect, afterEach } from 'vitest'
import { evaluateCondition, runRoute } from '../../../../src/export/state/route.js'
import { runInit } from '../../../../src/export/state/init.js'
import { runApply } from '../../../../src/export/state/apply.js'
import { readMetaFile, resolveSavePaths } from '../../../../src/export/state/io.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── Helpers ──────────────────────────────────────────────────────

function createRouteFixture() {
  const skillRoot = mkdtempSync(join(tmpdir(), 'soulkiller-route-'))
  mkdirSync(join(skillRoot, 'runtime', 'scripts'), { recursive: true })
  mkdirSync(join(skillRoot, 'runtime', 'saves'), { recursive: true })

  const script = {
    id: 'test-route',
    state_schema: {
      'affinity.a.bond': { type: 'int', desc: 'bond a', default: 5, range: [0, 10] },
      'affinity.b.bond': { type: 'int', desc: 'bond b', default: 3, range: [0, 10] },
      'flags.chose_a': { type: 'bool', desc: 'chose a', default: false },
    },
    initial_state: { 'affinity.a.bond': 5, 'affinity.b.bond': 3, 'flags.chose_a': false },
    scenes: {
      'scene-001': {
        text: 'common',
        choices: [
          {
            id: 'c1',
            text: 'favor A',
            consequences: { 'affinity.a.bond': 3, 'flags.chose_a': true },
            next: 'scene-gate',
          },
          {
            id: 'c2',
            text: 'favor B',
            consequences: { 'affinity.b.bond': 5 },
            next: 'scene-gate',
          },
        ],
      },
      'scene-gate': {
        type: 'affinity_gate',
        text: '',
        routing: [
          {
            route_id: 'route-a',
            condition: {
              all_of: [
                { key: 'affinity.a.bond', op: '>=', value: 7 },
                { key: 'flags.chose_a', op: '==', value: true },
              ],
            },
            next: 'scene-a01',
          },
          {
            route_id: 'route-b',
            condition: { key: 'affinity.b.bond', op: '>=', value: 7 },
            next: 'scene-b01',
          },
          {
            route_id: 'route-a',
            condition: 'default',
            next: 'scene-a01',
          },
        ],
        choices: [],
      },
      'scene-a01': {
        text: 'route a',
        choices: [{ id: 'c1', text: 'end', consequences: {} }],
      },
      'scene-b01': {
        text: 'route b',
        choices: [{ id: 'c1', text: 'end', consequences: {} }],
      },
    },
    endings: [],
  }

  const scriptPath = join(skillRoot, 'runtime', 'scripts', 'script-test-route.json')
  writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8')

  return {
    skillRoot,
    cleanup: () => rmSync(skillRoot, { recursive: true, force: true }),
  }
}

// ── evaluateCondition ─────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('"default" always returns true', () => {
    expect(evaluateCondition('default', {})).toBe(true)
    expect(evaluateCondition('default', { 'affinity.a.bond': 0 })).toBe(true)
  })

  it('comparison >= with matching value', () => {
    const state = { 'affinity.a.bond': 8 }
    expect(evaluateCondition({ key: 'affinity.a.bond', op: '>=', value: 7 }, state)).toBe(true)
  })

  it('comparison >= with non-matching value', () => {
    const state = { 'affinity.a.bond': 5 }
    expect(evaluateCondition({ key: 'affinity.a.bond', op: '>=', value: 7 }, state)).toBe(false)
  })

  it('all_of: both conditions must match', () => {
    const matchingState = { 'affinity.a.bond': 8, 'flags.chose_a': true }
    const partialState = { 'affinity.a.bond': 8, 'flags.chose_a': false }
    const emptyState = { 'affinity.a.bond': 5, 'flags.chose_a': false }

    const condition = {
      all_of: [
        { key: 'affinity.a.bond', op: '>=', value: 7 },
        { key: 'flags.chose_a', op: '==', value: true },
      ],
    }

    expect(evaluateCondition(condition, matchingState)).toBe(true)
    expect(evaluateCondition(condition, partialState)).toBe(false)
    expect(evaluateCondition(condition, emptyState)).toBe(false)
  })

  it('any_of: one condition suffices', () => {
    const bothMatch = { 'affinity.a.bond': 8, 'affinity.b.bond': 8 }
    const oneMatch = { 'affinity.a.bond': 8, 'affinity.b.bond': 3 }
    const noneMatch = { 'affinity.a.bond': 4, 'affinity.b.bond': 4 }

    const condition = {
      any_of: [
        { key: 'affinity.a.bond', op: '>=', value: 7 },
        { key: 'affinity.b.bond', op: '>=', value: 7 },
      ],
    }

    expect(evaluateCondition(condition, bothMatch)).toBe(true)
    expect(evaluateCondition(condition, oneMatch)).toBe(true)
    expect(evaluateCondition(condition, noneMatch)).toBe(false)
  })
})

// ── runRoute ──────────────────────────────────────────────────────

describe('runRoute', () => {
  let fixture: ReturnType<typeof createRouteFixture> | null = null

  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('routes to route-a when condition matches', () => {
    fixture = createRouteFixture()
    // init then apply c1: bond.a goes from 5 + 3 = 8, chose_a = true
    runInit(fixture.skillRoot, 'test-route')
    runApply(fixture.skillRoot, 'test-route', 'scene-001', 'c1')

    const result = runRoute(fixture.skillRoot, 'test-route', 'scene-gate')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routeId).toBe('route-a')
    expect(result.nextScene).toBe('scene-a01')
  })

  it('routes to route-b when b condition matches', () => {
    fixture = createRouteFixture()
    // init then apply c2: bond.b goes from 3 + 5 = 8
    runInit(fixture.skillRoot, 'test-route')
    runApply(fixture.skillRoot, 'test-route', 'scene-001', 'c2')

    const result = runRoute(fixture.skillRoot, 'test-route', 'scene-gate')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routeId).toBe('route-b')
    expect(result.nextScene).toBe('scene-b01')
  })

  it('falls to default when no condition matches', () => {
    fixture = createRouteFixture()
    // init only — bond.a=5 (< 7), bond.b=3 (< 7), chose_a=false → no explicit route matches
    runInit(fixture.skillRoot, 'test-route')

    const result = runRoute(fixture.skillRoot, 'test-route', 'scene-gate')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routeId).toBe('route-a')
    expect(result.nextScene).toBe('scene-a01')
  })

  it('writes current_route to meta.yaml', () => {
    fixture = createRouteFixture()
    runInit(fixture.skillRoot, 'test-route')
    runApply(fixture.skillRoot, 'test-route', 'scene-001', 'c1')
    runRoute(fixture.skillRoot, 'test-route', 'scene-gate')

    const paths = resolveSavePaths(fixture.skillRoot, 'test-route', 'auto')
    const meta = readMetaFile(paths.metaYamlPath)

    expect(meta.currentRoute).toBeDefined()
    expect(typeof meta.currentRoute).toBe('string')
  })
})
