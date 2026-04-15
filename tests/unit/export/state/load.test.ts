import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runLoad, LoadError } from '../../../../src/export/state/load.js'

let tmp: string

function seedScript(scriptId: string, state: Record<string, unknown>, scene: string): { skillRoot: string } {
  const skillRoot = fs.mkdtempSync(path.join(tmp, 'skill-'))
  // Minimal script.json so meta.script_ref can resolve
  const scriptsDir = path.join(skillRoot, 'runtime', 'scripts')
  fs.mkdirSync(scriptsDir, { recursive: true })
  fs.writeFileSync(
    path.join(scriptsDir, `script-${scriptId}.json`),
    JSON.stringify({ id: scriptId, initial_scene: scene, state_schema: {}, initial_state: state, scenes: {}, endings: [] }),
  )
  return { skillRoot }
}

function writeSave(skillRoot: string, scriptId: string, type: 'auto' | string, state: Record<string, unknown>, scene: string, opts: { lastPlayedAt?: string; scriptRef?: string; history?: string } = {}): void {
  const subdir = type === 'auto' ? 'auto' : `manual/${type}`
  const dir = path.join(skillRoot, 'runtime', 'saves', scriptId, subdir)
  fs.mkdirSync(dir, { recursive: true })
  const fields = Object.entries(state).map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `"${v}"` : v}`).join('\n')
  fs.writeFileSync(
    path.join(dir, 'state.yaml'),
    `current_scene: "${scene}"\nstate:\n${fields}\n`,
  )
  fs.writeFileSync(
    path.join(dir, 'meta.yaml'),
    `script_ref: "${opts.scriptRef ?? scriptId}"\ncurrent_scene: "${scene}"\nlast_played_at: "${opts.lastPlayedAt ?? '2026-01-01T00:00:00Z'}"\n`,
  )
  if (opts.history !== undefined) {
    fs.writeFileSync(path.join(dir, 'history.log'), opts.history)
  }
}

function readYaml(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'load-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('runLoad', () => {
  it('copies manual save to auto (state + meta + history)', () => {
    const { skillRoot } = seedScript('s1', { 'affinity.judy.trust': 5 }, 'scene-1')
    writeSave(skillRoot, 's1', '1728123456', { 'affinity.judy.trust': 8 }, 'scene-5', {
      history: 'scene-1:go\nscene-3:talk\n',
    })
    // auto has a different, stale state
    writeSave(skillRoot, 's1', 'auto', { 'affinity.judy.trust': 2 }, 'scene-2')

    const result = runLoad(skillRoot, 's1', { manual: '1728123456' })
    expect(result.source).toBe('manual:1728123456')
    expect(result.target).toBe('auto')
    expect(result.fieldCount).toBe(1)
    expect(result.autoOverwritten).toBe(true)

    const autoState = readYaml(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'))
    expect(autoState).toContain('scene-5')
    expect(autoState).toMatch(/affinity\.judy\.trust["]?: 8/)

    const autoMeta = readYaml(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'meta.yaml'))
    expect(autoMeta).toMatch(/current_scene: ["]?scene-5["]?/)
    // lastPlayedAt refreshed to now (not the fixture 2026-01-01)
    expect(autoMeta).not.toContain('2026-01-01')

    const autoHistory = readYaml(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'history.log'))
    expect(autoHistory).toBe('scene-1:go\nscene-3:talk\n')
  })

  it('manual save not found → LoadError(MANUAL_NOT_FOUND)', () => {
    const { skillRoot } = seedScript('s1', {}, 'scene-1')
    expect(() => runLoad(skillRoot, 's1', { manual: 'never-existed' })).toThrow(LoadError)
    try {
      runLoad(skillRoot, 's1', { manual: 'never-existed' })
    } catch (e) {
      expect((e as LoadError).code).toBe('MANUAL_NOT_FOUND')
    }
  })

  it('rejects save-type "auto" with INVALID_SAVE_TYPE', () => {
    const { skillRoot } = seedScript('s1', {}, 'scene-1')
    try {
      runLoad(skillRoot, 's1', 'auto')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(LoadError)
      expect((e as LoadError).code).toBe('INVALID_SAVE_TYPE')
    }
  })

  it('works when auto does not yet exist (autoOverwritten=false)', () => {
    const { skillRoot } = seedScript('s1', {}, 'scene-1')
    writeSave(skillRoot, 's1', '123', { 'affinity.judy.trust': 7 }, 'scene-3')
    const result = runLoad(skillRoot, 's1', { manual: '123' })
    expect(result.autoOverwritten).toBe(false)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'))).toBe(true)
  })

  it('is idempotent (second call produces identical auto)', () => {
    const { skillRoot } = seedScript('s1', {}, 'scene-1')
    writeSave(skillRoot, 's1', '123', { 'affinity.judy.trust': 7 }, 'scene-3', { history: 'a\n' })
    runLoad(skillRoot, 's1', { manual: '123' })
    const firstState = readYaml(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'))
    runLoad(skillRoot, 's1', { manual: '123' })
    const secondState = readYaml(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'))
    expect(firstState).toBe(secondState)
  })
})
