import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runInit } from '../../../../src/export/state/init.js'
import { runApply } from '../../../../src/export/state/apply.js'
import { runSave } from '../../../../src/export/state/save.js'
import { runLoad } from '../../../../src/export/state/load.js'
import { readStateFile, readMetaFile } from '../../../../src/export/state/io.js'

/**
 * Regression test for the Phase -1 "Load a Save" data-consistency hole.
 *
 * Before skill-binary-contract:
 *   apply always read/wrote auto/. Loading a manual save just pointed the
 *   LLM at manual/ state; any subsequent apply silently overwrote auto's
 *   stale state — fork between LLM's rendering and disk's persistence.
 *
 * After this change: `runLoad(manual:X)` copies manual→auto first. Apply
 * then bases its next step on the manual's snapshot as intended.
 */

let tmp: string

function seedScript(skillRoot: string, scriptId: string): void {
  const scriptsDir = path.join(skillRoot, 'runtime', 'scripts')
  fs.mkdirSync(scriptsDir, { recursive: true })
  fs.mkdirSync(path.join(skillRoot, 'runtime', 'saves', scriptId), { recursive: true })

  const scriptJson = {
    id: scriptId,
    initial_scene: 'scene-1',
    state_schema: {
      'affinity.judy.trust': { desc: 'trust', type: 'int', range: [0, 10], default: 5 },
    },
    initial_state: { 'affinity.judy.trust': 5 },
    scenes: {
      'scene-1': {
        id: 'scene-1',
        choices: [
          { id: 'go', text: 'go', next: 'scene-2', consequences: { 'affinity.judy.trust': 2 } },
        ],
      },
      'scene-2': {
        id: 'scene-2',
        choices: [
          { id: 'talk', text: 'talk', next: 'scene-3', consequences: { 'affinity.judy.trust': 1 } },
        ],
      },
      'scene-3': {
        id: 'scene-3',
        choices: [
          { id: 'leave', text: 'leave', next: 'scene-4', consequences: { 'affinity.judy.trust': -3 } },
        ],
      },
      'scene-4': { id: 'scene-4', choices: [] },
    },
    endings: [],
  }
  fs.writeFileSync(path.join(scriptsDir, `script-${scriptId}.json`), JSON.stringify(scriptJson))
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'load-apply-')) })
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('integration: load then apply resumes from the loaded save', () => {
  it('closes the timeline-divergence hole', () => {
    const skillRoot = tmp
    seedScript(skillRoot, 's1')

    // Step 1: init → auto = initial_state (trust=5, scene-1)
    runInit(skillRoot, 's1')

    // Step 2: apply first choice → auto = trust=7, scene-2
    runApply(skillRoot, 's1', 'scene-1', 'go')

    // Step 3: save a manual snapshot of this state
    const saveResult = runSave(skillRoot, 's1', undefined)
    if (!saveResult.ok) throw new Error('save failed')
    const manualTs = saveResult.timestamp

    // Step 4: apply further to diverge auto → scene-3, trust=8
    runApply(skillRoot, 's1', 'scene-2', 'talk')

    // Verify auto is at scene-3 trust=8
    const autoPaths = path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml')
    const divergedState = readStateFile(autoPaths)
    expect(divergedState.currentScene).toBe('scene-3')
    expect(divergedState.state['affinity.judy.trust']).toBe(8)

    // Step 5: load the manual snapshot back to auto
    const loadResult = runLoad(skillRoot, 's1', { manual: manualTs })
    expect(loadResult.autoOverwritten).toBe(true)

    // Verify auto is now at the saved scene-2 trust=7 state
    const restoredState = readStateFile(autoPaths)
    expect(restoredState.currentScene).toBe('scene-2')
    expect(restoredState.state['affinity.judy.trust']).toBe(7)

    // Step 6: apply from the restored auto → should go to scene-3 trust=8, NOT scene-4
    runApply(skillRoot, 's1', 'scene-2', 'talk')
    const resumedState = readStateFile(autoPaths)
    expect(resumedState.currentScene).toBe('scene-3')
    // 7 + 1 = 8 — resumed from manual's 7, not from the diverged 8 that was at scene-3 pre-load
    expect(resumedState.state['affinity.judy.trust']).toBe(8)

    const meta = readMetaFile(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'meta.yaml'))
    expect(meta.currentScene).toBe('scene-3')
  })
})
