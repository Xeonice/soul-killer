import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runSaveDelete } from '../../../../src/export/state/save.js'

let tmp: string

function seed(scriptId: string, timestamps: string[]): string {
  const skillRoot = fs.mkdtempSync(path.join(tmp, 'skill-'))
  const saveBase = path.join(skillRoot, 'runtime', 'saves', scriptId)
  for (const ts of timestamps) {
    const dir = path.join(saveBase, 'manual', ts)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'state.yaml'), `current_scene: "scene-${ts}"\nstate: {}\n`)
    fs.writeFileSync(path.join(dir, 'meta.yaml'), `script_ref: "${scriptId}"\ncurrent_scene: "scene-${ts}"\n`)
  }
  // auto
  const autoDir = path.join(saveBase, 'auto')
  fs.mkdirSync(autoDir, { recursive: true })
  fs.writeFileSync(path.join(autoDir, 'state.yaml'), `current_scene: "scene-auto"\nstate: {}\n`)
  return skillRoot
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'save-del-'))
})
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('runSaveDelete', () => {
  it('deletes the target manual save and leaves others intact', () => {
    const skillRoot = seed('s1', ['111', '222', '333'])
    const result = runSaveDelete(skillRoot, 's1', '222')
    expect(result.ok).toBe(true)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'manual', '222'))).toBe(false)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'manual', '111'))).toBe(true)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'manual', '333'))).toBe(true)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto'))).toBe(true)
  })

  it('returns MANUAL_NOT_FOUND when target missing', () => {
    const skillRoot = seed('s1', ['111'])
    const result = runSaveDelete(skillRoot, 's1', 'nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MANUAL_NOT_FOUND')
  })

  it('does not affect auto save', () => {
    const skillRoot = seed('s1', ['111'])
    runSaveDelete(skillRoot, 's1', '111')
    const autoState = fs.readFileSync(path.join(skillRoot, 'runtime', 'saves', 's1', 'auto', 'state.yaml'), 'utf8')
    expect(autoState).toContain('scene-auto')
  })
})
