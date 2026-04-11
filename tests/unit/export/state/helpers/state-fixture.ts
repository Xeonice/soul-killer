/**
 * Test helper: build a throwaway skill root directory on disk with a
 * minimal script.json for state command tests.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface FixtureScript {
  id: string
  state_schema: Record<string, unknown>
  initial_state: Record<string, number | boolean | string>
  scenes: Record<
    string,
    {
      text?: string
      choices: Array<{
        id: string
        text?: string
        consequences?: Record<string, number | boolean | string>
        next?: string
      }>
    }
  >
  endings?: unknown[]
}

export interface Fixture {
  skillRoot: string
  scriptPath: string
  cleanup: () => void
}

export function defaultScript(): FixtureScript {
  return {
    id: 'script-001',
    state_schema: {
      'affinity.judy.bond': {
        type: 'int',
        desc: 'bond with judy',
        default: 0,
        range: [0, 10],
      },
      'affinity.judy.trust': {
        type: 'int',
        desc: 'trust with judy',
        default: 3,
        range: [0, 10],
      },
      'flags.met_johnny': {
        type: 'bool',
        desc: 'has met johnny',
        default: false,
      },
      'custom.location': {
        type: 'enum',
        desc: 'current location',
        default: 'bar',
        values: ['bar', 'clinic', 'afterlife'],
      },
    },
    initial_state: {
      'affinity.judy.bond': 0,
      'affinity.judy.trust': 3,
      'flags.met_johnny': false,
      'custom.location': 'bar',
    },
    scenes: {
      'scene-001': {
        text: 'opening',
        choices: [
          {
            id: 'choice-1',
            text: 'greet judy',
            consequences: {
              'affinity.judy.trust': 2,
              'flags.met_johnny': true,
            },
            next: 'scene-002',
          },
          {
            id: 'choice-2',
            text: 'walk away',
            consequences: {
              'affinity.judy.trust': -1,
            },
            next: 'scene-003',
          },
        ],
      },
      'scene-002': {
        text: 'second',
        choices: [
          {
            id: 'choice-1',
            text: 'move on',
            consequences: {
              'custom.location': 'clinic',
            },
            next: 'scene-003',
          },
        ],
      },
      'scene-003': {
        text: 'end',
        choices: [
          {
            id: 'choice-1',
            text: 'finish',
            consequences: {},
          },
        ],
      },
    },
  }
}

export function createFixture(script: FixtureScript = defaultScript()): Fixture {
  const skillRoot = mkdtempSync(join(tmpdir(), 'soulkiller-state-'))
  mkdirSync(join(skillRoot, 'runtime', 'scripts'), { recursive: true })
  mkdirSync(join(skillRoot, 'runtime', 'saves'), { recursive: true })

  const scriptPath = join(skillRoot, 'runtime', 'scripts', `${script.id}.json`)
  writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8')

  return {
    skillRoot,
    scriptPath,
    cleanup: () => {
      rmSync(skillRoot, { recursive: true, force: true })
    },
  }
}
