import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnCli } from './harness/spawn-cli.js'

/**
 * Verifies the binary exposes `soulkiller runtime load` correctly and that
 * the Phase -1 Load-a-Save data-consistency hole is closed end-to-end.
 *
 * Each scenario seeds a minimal skill (script.json + saves) under a temp HOME
 * via SKILL_ROOT, then drives the CLI directly.
 */

let homeDir: string

function mkSkillRoot(): string {
  const root = fs.mkdtempSync(path.join(homeDir, 'skill-'))
  fs.mkdirSync(path.join(root, 'runtime', 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'runtime', 'saves'), { recursive: true })
  return root
}

function seedScript(root: string, scriptId: string): void {
  const script = {
    id: scriptId,
    initial_scene: 'scene-1',
    state_schema: { 'affinity.judy.trust': { desc: 'trust', type: 'int', range: [0, 10], default: 5 } },
    initial_state: { 'affinity.judy.trust': 5 },
    scenes: {
      'scene-1': { id: 'scene-1', choices: [{ id: 'go', text: 'go', next: 'scene-2', consequences: { 'affinity.judy.trust': 2 } }] },
      'scene-2': { id: 'scene-2', choices: [] },
    },
    endings: [],
  }
  fs.writeFileSync(path.join(root, 'runtime', 'scripts', `script-${scriptId}.json`), JSON.stringify(script))
}

function seedManual(root: string, scriptId: string, ts: string, scene: string, fields: Record<string, number>): void {
  const dir = path.join(root, 'runtime', 'saves', scriptId, 'manual', ts)
  fs.mkdirSync(dir, { recursive: true })
  const stateLines = Object.entries(fields).map(([k, v]) => `  ${JSON.stringify(k)}: ${v}`).join('\n')
  fs.writeFileSync(path.join(dir, 'state.yaml'), `current_scene: ${JSON.stringify(scene)}\nstate:\n${stateLines}\n`)
  fs.writeFileSync(path.join(dir, 'meta.yaml'), `script_ref: ${JSON.stringify(scriptId)}\ncurrent_scene: ${JSON.stringify(scene)}\nlast_played_at: "2026-01-01T00:00:00Z"\n`)
}

beforeEach(() => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-e2e-load-'))
})

afterEach(() => {
  fs.rmSync(homeDir, { recursive: true, force: true })
})

describe('E2E: soulkiller runtime load', () => {
  it('loads a manual save back to auto', async () => {
    const skillRoot = mkSkillRoot()
    seedScript(skillRoot, 's1')
    seedManual(skillRoot, 's1', '111', 'scene-2', { 'affinity.judy.trust': 9 })

    const result = await spawnCli({
      args: ['runtime', '--root', skillRoot, 'load', 's1', 'manual:111'],
      homeDir,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('LOADED')
    expect(result.stdout).toContain('source: manual:111')

    const autoState = fs.readFileSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'), 'utf8')
    expect(autoState).toContain('scene-2')
    expect(autoState).toMatch(/affinity\.judy\.trust["]?: 9/)
  })

  it('rejects load auto with exit code 2', async () => {
    const skillRoot = mkSkillRoot()
    seedScript(skillRoot, 's1')
    const result = await spawnCli({
      args: ['runtime', '--root', skillRoot, 'load', 's1', 'auto'],
      homeDir,
    })
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('load only applies to manual saves')
  })

  it('manual not found → exit code 1', async () => {
    const skillRoot = mkSkillRoot()
    seedScript(skillRoot, 's1')
    const result = await spawnCli({
      args: ['runtime', '--root', skillRoot, 'load', 's1', 'manual:does-not-exist'],
      homeDir,
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('not found')
  })
})
