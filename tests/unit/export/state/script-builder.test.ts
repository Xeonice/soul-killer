import { describe, it, expect, afterEach } from 'vitest'
import {
  runScriptPlan,
  runScriptScene,
  runScriptEnding,
  runScriptBuild,
  topologicalSort,
} from '../../../../src/export/state/script-builder.js'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── Test environment helpers ─────────────────────────────────────

function createTestEnv() {
  const skillRoot = mkdtempSync(join(tmpdir(), 'sk-builder-'))
  return {
    skillRoot,
    cleanup: () => rmSync(skillRoot, { recursive: true, force: true }),
    writePlan: (id: string, plan: object) => {
      const dir = join(skillRoot, 'runtime', 'scripts', `.build-${id}`)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8')
    },
    writeDraft: (id: string, name: string, data: object) => {
      const dir = join(skillRoot, 'runtime', 'scripts', `.build-${id}`, 'draft')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(data, null, 2), 'utf8')
    },
    readPlan: (id: string) => {
      return JSON.parse(
        readFileSync(join(skillRoot, 'runtime', 'scripts', `.build-${id}`, 'plan.json'), 'utf8'),
      )
    },
  }
}

function minimalPlan() {
  return {
    id: 'test-001',
    state_schema: {
      'affinity.char-a.bond': { type: 'int', desc: 'bond', default: 5, range: [0, 10] },
      'flags.met': { type: 'bool', desc: 'met', default: false },
    },
    initial_state: { 'affinity.char-a.bond': 5, 'flags.met': false },
    narrative: {
      arc: 'test arc',
      acts: [
        {
          act: 1,
          title: 'Act 1',
          theme: 'test',
          scenes: ['scene-001', 'scene-002', 'scene-003'],
        },
      ],
    },
    scenes: {
      'scene-001': {
        act: 1,
        title: 'Start',
        outline: 'opening scene',
        choices: [
          { id: 'c1', text: 'go A', intent: 'path A', next: 'scene-002' },
          { id: 'c2', text: 'go B', intent: 'path B', next: 'scene-003' },
        ],
      },
      'scene-002': {
        act: 1,
        title: 'Path A',
        outline: 'path A scene',
        choices: [{ id: 'c1', text: 'continue', intent: 'merge', next: 'scene-003' }],
      },
      'scene-003': {
        act: 1,
        title: 'End',
        outline: 'final scene',
        choices: [{ id: 'c1', text: 'finish', intent: 'end', next: '' }],
        context_refs: ['scene-001'],
      },
    },
    endings: [
      {
        id: 'ending-A',
        title: 'Good',
        condition: { key: 'affinity.char-a.bond', op: '>=', value: 7 },
        intent: 'good ending',
      },
      { id: 'ending-default', title: 'Default', condition: 'default', intent: 'default ending' },
    ],
  }
}

// ── runScriptPlan ────────────────────────────────────────────────

describe('runScriptPlan', () => {
  let env: ReturnType<typeof createTestEnv>

  afterEach(() => {
    env?.cleanup()
  })

  it('validates and enriches a valid plan', () => {
    env = createTestEnv()
    env.writePlan('test-001', minimalPlan())

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.scenes).toBe(3)
    expect(result.fields).toBe(2)

    const plan = env.readPlan('test-001')
    expect(plan.scenes['scene-001'].predecessors).toBeDefined()
    expect(plan.scenes['scene-003'].is_convergence).toBeDefined()
    expect(Array.isArray(plan.generation_order)).toBe(true)
  })

  it('computes predecessors correctly', () => {
    env = createTestEnv()
    env.writePlan('test-001', minimalPlan())
    runScriptPlan(env.skillRoot, 'test-001')

    const plan = env.readPlan('test-001')

    expect(plan.scenes['scene-001'].predecessors).toEqual([])
    expect(plan.scenes['scene-003'].predecessors).toContain('scene-001')
    expect(plan.scenes['scene-003'].predecessors).toContain('scene-002')
    expect(plan.scenes['scene-003'].is_convergence).toBe(true)
  })

  it('generation_order is topological', () => {
    env = createTestEnv()
    env.writePlan('test-001', minimalPlan())
    runScriptPlan(env.skillRoot, 'test-001')

    const plan = env.readPlan('test-001')
    const order: string[] = plan.generation_order

    const idx = (id: string) => order.indexOf(id)
    expect(idx('scene-001')).toBeLessThan(idx('scene-002'))
    expect(idx('scene-001')).toBeLessThan(idx('scene-003'))
    expect(idx('scene-002')).toBeLessThan(idx('scene-003'))
  })

  it('rejects choices > 3', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    plan.scenes['scene-001'].choices = [
      { id: 'c1', text: 'A', intent: 'A', next: 'scene-002' },
      { id: 'c2', text: 'B', intent: 'B', next: 'scene-003' },
      { id: 'c3', text: 'C', intent: 'C', next: 'scene-003' },
      { id: 'c4', text: 'D', intent: 'D', next: 'scene-003' },
    ]
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('max 3')
  })

  it('rejects dangling next', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    plan.scenes['scene-001'].choices[0]!.next = 'nonexistent'
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('does not exist')
  })

  it('rejects invalid context_refs', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // @ts-expect-error — testing invalid data
    plan.scenes['scene-001'].context_refs = ['nonexistent']
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
  })

  it('detects cycles', () => {
    env = createTestEnv()
    const cyclePlan = {
      id: 'cycle-test',
      state_schema: {
        'flags.visited': { type: 'bool', desc: 'visited', default: false },
      },
      initial_state: { 'flags.visited': false },
      narrative: {
        arc: 'cycle',
        acts: [{ act: 1, title: 'Act 1', theme: 'test', scenes: ['scene-A', 'scene-B'] }],
      },
      scenes: {
        'scene-A': {
          act: 1,
          title: 'A',
          outline: 'scene A',
          choices: [{ id: 'c1', text: 'go B', intent: 'go', next: 'scene-B' }],
        },
        'scene-B': {
          act: 1,
          title: 'B',
          outline: 'scene B',
          choices: [{ id: 'c1', text: 'go A', intent: 'go', next: 'scene-A' }],
        },
      },
      endings: [{ id: 'ending-default', title: 'Default', condition: 'default', intent: 'fallback' }],
    }
    env.writePlan('cycle-test', cyclePlan)

    const result = runScriptPlan(env.skillRoot, 'cycle-test')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('cycle')
  })

  it('rejects mismatched initial_state', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // @ts-expect-error — testing invalid data
    plan.initial_state['extra.field'] = 'bad'
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
  })

  it('validates gate scene routing', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // Replace scene-002 with a gate scene that has a default routing entry
    plan.scenes['scene-002'] = {
      act: 1,
      title: 'Gate',
      outline: 'affinity gate scene',
      // @ts-expect-error — gate scenes use routing not choices
      type: 'affinity_gate',
      routing: [
        {
          route_id: 'route-a',
          condition: { key: 'affinity.char-a.bond', op: '>=', value: 8 },
          next: 'scene-003',
        },
        {
          route_id: 'route-default',
          condition: 'default',
          next: 'scene-003',
        },
      ],
      choices: [],
    }
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(true)
  })

  it('rejects gate without default routing', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // Gate scene where last routing entry is NOT condition: "default"
    plan.scenes['scene-002'] = {
      act: 1,
      title: 'Gate No Default',
      outline: 'gate without default',
      // @ts-expect-error — gate scenes use routing not choices
      type: 'affinity_gate',
      routing: [
        {
          route_id: 'route-a',
          condition: { key: 'affinity.char-a.bond', op: '>=', value: 8 },
          next: 'scene-003',
        },
        {
          route_id: 'route-b',
          condition: { key: 'affinity.char-a.bond', op: '<', value: 8 },
          next: 'scene-003',
        },
      ],
      choices: [],
    }
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('default')
  })

  it('rejects route with no endings', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // Add a routes field but clear endings — plan has routes defined but endings array is empty
    // @ts-expect-error — adding routes to test plan
    plan.routes = [
      { id: 'route-a', focus_character: 'char-a', name: 'Route A', theme: 'trust', scenes: ['scene-002'] },
    ]
    plan.endings = []
    env.writePlan('test-001', plan)

    const result = runScriptPlan(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
  })
})

// ── runScriptScene ───────────────────────────────────────────────

describe('runScriptScene', () => {
  let env: ReturnType<typeof createTestEnv>

  afterEach(() => {
    env?.cleanup()
  })

  function setupEnrichedPlan(id = 'test-001') {
    env.writePlan(id, minimalPlan())
    runScriptPlan(env.skillRoot, id)
  }

  function validScene001Draft() {
    return {
      text: 'You stand at the crossroads.',
      choices: [
        { id: 'c1', text: 'go A', consequences: { 'affinity.char-a.bond': 1 }, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    }
  }

  function validScene002Draft() {
    return {
      text: 'You take path A.',
      choices: [{ id: 'c1', text: 'continue', consequences: {}, next: 'scene-003' }],
    }
  }

  it('validates and promotes a valid scene', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'scene-001', validScene001Draft())

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sceneId).toBe('scene-001')

    // Draft is gone, promoted file exists
    expect(
      existsSync(
        join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'draft', 'scene-001.json'),
      ),
    ).toBe(false)
    expect(
      existsSync(
        join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'scenes', 'scene-001.json'),
      ),
    ).toBe(true)
  })

  it('rejects scene not in plan', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'scene-999', { text: 'ghost', choices: [] })

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-999')

    expect(result.ok).toBe(false)
  })

  it('rejects invalid consequence key', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'scene-001', {
      text: 'some text',
      choices: [
        {
          id: 'c1',
          text: 'go A',
          consequences: { 'nonexistent.key': 1 },
          next: 'scene-002',
        },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('nonexistent.key')
  })

  it('rejects when predecessor not ready', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    // scene-003 needs scene-001 and scene-002 done first
    env.writeDraft('test-001', 'scene-003', {
      text: 'final scene',
      choices: [{ id: 'c1', text: 'finish', consequences: {}, next: '' }],
    })

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-003')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('predecessor')
  })

  it('rejects JSON syntax error in draft', () => {
    env = createTestEnv()
    setupEnrichedPlan()

    // Write raw invalid JSON to draft file
    const draftDir = join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'draft')
    mkdirSync(draftDir, { recursive: true })
    writeFileSync(join(draftDir, 'scene-001.json'), '{ this is: not valid json }', 'utf8')

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    expect(result.ok).toBe(false)
  })

  it('gate scene: auto-completes type, routing, choices from plan', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // Add gate scene
    plan.scenes['scene-002'] = {
      act: 1,
      title: 'Gate',
      outline: 'affinity gate',
      // @ts-expect-error — gate scenes
      type: 'affinity_gate',
      routing: [
        { route_id: 'route-a', condition: { key: 'affinity.char-a.bond', op: '>=', value: 8 }, next: 'scene-003' },
        { route_id: 'route-default', condition: 'default', next: 'scene-003' },
      ],
      choices: [],
    }
    env.writePlan('test-001', plan)
    runScriptPlan(env.skillRoot, 'test-001')

    // Submit scene-001 first (predecessor)
    env.writeDraft('test-001', 'scene-001', {
      text: 'Opening.',
      choices: [
        { id: 'c1', text: 'go A', consequences: {}, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })
    runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    // Gate draft only has text — no type, no routing, no choices
    env.writeDraft('test-001', 'scene-002', { text: 'The gate awaits.' })

    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-002')
    expect(result.ok).toBe(true)

    // Verify the promoted file has type, routing, choices
    const scenePath = join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'scenes', 'scene-002.json')
    const promoted = JSON.parse(readFileSync(scenePath, 'utf8'))
    expect(promoted.type).toBe('affinity_gate')
    expect(promoted.choices).toEqual([])
    expect(promoted.routing).toHaveLength(2)
    expect(promoted.routing[0].route_id).toBe('route-a')
    expect(promoted.text).toBe('The gate awaits.')
  })

  it('route scene: auto-injects route label from plan.routes', () => {
    env = createTestEnv()
    const plan = minimalPlan()
    // @ts-expect-error — adding routes to plan
    plan.routes = [
      { id: 'route-kiritsugu', focus_character: 'char-a', name: 'Kiritsugu', theme: 'justice', scenes: ['scene-002'] },
    ]
    env.writePlan('test-001', plan)
    runScriptPlan(env.skillRoot, 'test-001')

    env.writeDraft('test-001', 'scene-001', {
      text: 'Opening.',
      choices: [
        { id: 'c1', text: 'go A', consequences: {}, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })
    runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    env.writeDraft('test-001', 'scene-002', {
      text: 'Route scene.',
      choices: [{ id: 'c1', text: 'continue', consequences: {}, next: 'scene-003' }],
    })
    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-002')
    expect(result.ok).toBe(true)

    const scenePath = join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'scenes', 'scene-002.json')
    const promoted = JSON.parse(readFileSync(scenePath, 'utf8'))
    expect(promoted.route).toBe('route-kiritsugu')
  })

  it('scene without routes in plan: no route label injected', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'scene-001', {
      text: 'Opening.',
      choices: [
        { id: 'c1', text: 'go A', consequences: {}, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })
    const result = runScriptScene(env.skillRoot, 'test-001', 'scene-001')
    expect(result.ok).toBe(true)

    const scenePath = join(env.skillRoot, 'runtime', 'scripts', '.build-test-001', 'scenes', 'scene-001.json')
    const promoted = JSON.parse(readFileSync(scenePath, 'utf8'))
    expect(promoted.route).toBeUndefined()
  })
})

// ── runScriptEnding ──────────────────────────────────────────────

describe('runScriptEnding', () => {
  let env: ReturnType<typeof createTestEnv>

  afterEach(() => {
    env?.cleanup()
  })

  function setupEnrichedPlan(id = 'test-001') {
    env.writePlan(id, minimalPlan())
    runScriptPlan(env.skillRoot, id)
  }

  it('validates and promotes a valid ending', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'ending-A', {
      id: 'ending-A',
      title: 'Good',
      condition: { key: 'affinity.char-a.bond', op: '>=', value: 7 },
      body: 'You achieved the good ending. Congratulations!',
    })

    const result = runScriptEnding(env.skillRoot, 'test-001', 'ending-A')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.endingId).toBe('ending-A')

    // Promoted file exists
    expect(
      existsSync(
        join(
          env.skillRoot,
          'runtime',
          'scripts',
          '.build-test-001',
          'endings',
          'ending-A.json',
        ),
      ),
    ).toBe(true)
    // Draft is gone
    expect(
      existsSync(
        join(
          env.skillRoot,
          'runtime',
          'scripts',
          '.build-test-001',
          'draft',
          'ending-A.json',
        ),
      ),
    ).toBe(false)
  })

  it('rejects empty body', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'ending-A', {
      id: 'ending-A',
      title: 'Good',
      condition: { key: 'affinity.char-a.bond', op: '>=', value: 7 },
      body: '',
    })

    const result = runScriptEnding(env.skillRoot, 'test-001', 'ending-A')

    expect(result.ok).toBe(false)
  })

  it('rejects ending not in plan', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    env.writeDraft('test-001', 'ending-Z', {
      id: 'ending-Z',
      title: 'Ghost',
      condition: 'default',
      body: 'This ending does not exist in the plan.',
    })

    const result = runScriptEnding(env.skillRoot, 'test-001', 'ending-Z')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('ending-Z')
  })
})

// ── runScriptBuild ───────────────────────────────────────────────

describe('runScriptBuild', () => {
  let env: ReturnType<typeof createTestEnv>

  afterEach(() => {
    env?.cleanup()
  })

  function setupEnrichedPlan(id = 'test-001') {
    env.writePlan(id, minimalPlan())
    runScriptPlan(env.skillRoot, id)
  }

  function submitAllScenes(id = 'test-001') {
    // Submit in topological order: scene-001, scene-002, then scene-003
    env.writeDraft(id, 'scene-001', {
      text: 'You stand at the crossroads.',
      choices: [
        { id: 'c1', text: 'go A', consequences: {}, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })
    runScriptScene(env.skillRoot, id, 'scene-001')

    env.writeDraft(id, 'scene-002', {
      text: 'Path A unfolds.',
      choices: [{ id: 'c1', text: 'continue', consequences: {}, next: 'scene-003' }],
    })
    runScriptScene(env.skillRoot, id, 'scene-002')

    env.writeDraft(id, 'scene-003', {
      text: 'The final moment arrives.',
      choices: [{ id: 'c1', text: 'finish', consequences: {}, next: '' }],
    })
    runScriptScene(env.skillRoot, id, 'scene-003')
  }

  function submitAllEndings(id = 'test-001') {
    env.writeDraft(id, 'ending-A', {
      id: 'ending-A',
      title: 'Good',
      condition: { key: 'affinity.char-a.bond', op: '>=', value: 7 },
      body: 'You achieved the good ending.',
    })
    runScriptEnding(env.skillRoot, id, 'ending-A')

    env.writeDraft(id, 'ending-default', {
      id: 'ending-default',
      title: 'Default',
      condition: 'default',
      body: 'The default ending plays out.',
    })
    runScriptEnding(env.skillRoot, id, 'ending-default')
  }

  it('merges plan+scenes+endings into final script', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    submitAllScenes()
    submitAllEndings()

    const result = runScriptBuild(env.skillRoot, 'test-001')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Final script file exists
    const scriptPath = join(env.skillRoot, 'runtime', 'scripts', 'script-test-001.json')
    expect(existsSync(scriptPath)).toBe(true)

    // Parse and verify structure
    const script = JSON.parse(readFileSync(scriptPath, 'utf8'))
    expect(script.scenes).toBeDefined()
    expect(Object.keys(script.scenes)).toHaveLength(3)
    expect(Array.isArray(script.endings)).toBe(true)
    expect(script.endings).toHaveLength(2)

    // Build dir is gone
    expect(
      existsSync(join(env.skillRoot, 'runtime', 'scripts', '.build-test-001')),
    ).toBe(false)
  })

  it('rejects when scenes missing', () => {
    env = createTestEnv()
    setupEnrichedPlan()

    // Submit only scene-001 and scene-002, not scene-003
    env.writeDraft('test-001', 'scene-001', {
      text: 'opening',
      choices: [
        { id: 'c1', text: 'go A', consequences: {}, next: 'scene-002' },
        { id: 'c2', text: 'go B', consequences: {}, next: 'scene-003' },
      ],
    })
    runScriptScene(env.skillRoot, 'test-001', 'scene-001')

    env.writeDraft('test-001', 'scene-002', {
      text: 'path A',
      choices: [{ id: 'c1', text: 'continue', consequences: {}, next: 'scene-003' }],
    })
    runScriptScene(env.skillRoot, 'test-001', 'scene-002')

    submitAllEndings()

    const result = runScriptBuild(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('scene-003')
  })

  it('rejects when endings missing', () => {
    env = createTestEnv()
    setupEnrichedPlan()
    submitAllScenes()

    // Only submit one of the two endings
    env.writeDraft('test-001', 'ending-A', {
      id: 'ending-A',
      title: 'Good',
      condition: { key: 'affinity.char-a.bond', op: '>=', value: 7 },
      body: 'Good ending.',
    })
    runScriptEnding(env.skillRoot, 'test-001', 'ending-A')

    const result = runScriptBuild(env.skillRoot, 'test-001')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('ending-default')
  })
})

// ── topologicalSort ──────────────────────────────────────────────

describe('topologicalSort', () => {
  it('sorts a simple chain A→B→C', () => {
    const scenes = {
      A: { act: 1, title: 'A', outline: 'a', choices: [{ id: 'c1', text: 'next', intent: '', next: 'B' }] },
      B: { act: 1, title: 'B', outline: 'b', choices: [{ id: 'c1', text: 'next', intent: '', next: 'C' }] },
      C: { act: 1, title: 'C', outline: 'c', choices: [{ id: 'c1', text: 'done', intent: '', next: '' }] },
    }

    const result = topologicalSort(scenes)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order).toEqual(['A', 'B', 'C'])
  })

  it('sorts a diamond (A→B, A→C, B→D, C→D)', () => {
    const scenes = {
      A: { act: 1, title: 'A', outline: 'a', choices: [{ id: 'c1', text: 'b', intent: '', next: 'B' }, { id: 'c2', text: 'c', intent: '', next: 'C' }] },
      B: { act: 1, title: 'B', outline: 'b', choices: [{ id: 'c1', text: 'd', intent: '', next: 'D' }] },
      C: { act: 1, title: 'C', outline: 'c', choices: [{ id: 'c1', text: 'd', intent: '', next: 'D' }] },
      D: { act: 1, title: 'D', outline: 'd', choices: [{ id: 'c1', text: 'done', intent: '', next: '' }] },
    }

    const result = topologicalSort(scenes)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const order = result.order
    const idx = (id: string) => order.indexOf(id)

    // D must come after both B and C
    expect(idx('B')).toBeLessThan(idx('D'))
    expect(idx('C')).toBeLessThan(idx('D'))
    // A must come before B and C
    expect(idx('A')).toBeLessThan(idx('B'))
    expect(idx('A')).toBeLessThan(idx('C'))
  })

  it('detects a cycle (A→B, B→A)', () => {
    const scenes = {
      A: { act: 1, title: 'A', outline: 'a', choices: [{ id: 'c1', text: 'b', intent: '', next: 'B' }] },
      B: { act: 1, title: 'B', outline: 'b', choices: [{ id: 'c1', text: 'a', intent: '', next: 'A' }] },
    }

    const result = topologicalSort(scenes)

    expect(result.ok).toBe(false)
  })
})
