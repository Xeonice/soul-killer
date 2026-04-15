import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runScriptClean } from '../../../../src/export/state/script-builder.js'

let tmp: string

function seedDrafts(scriptId: string, withFinal: boolean): string {
  const skillRoot = fs.mkdtempSync(path.join(tmp, 'skill-'))
  const buildDir = path.join(skillRoot, 'runtime', 'scripts', `.build-${scriptId}`)
  fs.mkdirSync(buildDir, { recursive: true })
  fs.writeFileSync(path.join(buildDir, 'plan.json'), '{}')
  const scenesDir = path.join(buildDir, 'scenes')
  fs.mkdirSync(scenesDir, { recursive: true })
  fs.writeFileSync(path.join(scenesDir, 'scene-1.json'), '{}')
  fs.writeFileSync(path.join(scenesDir, 'scene-2.json'), '{}')
  const endingsDir = path.join(buildDir, 'endings')
  fs.mkdirSync(endingsDir, { recursive: true })
  fs.writeFileSync(path.join(endingsDir, 'ending-1.json'), '{}')

  if (withFinal) {
    const scriptsDir = path.join(skillRoot, 'runtime', 'scripts')
    fs.writeFileSync(path.join(scriptsDir, `script-${scriptId}.json`), '{"final":true}')
  }
  return skillRoot
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'script-clean-')) })
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('runScriptClean', () => {
  it('removes drafts and reports preserved final script', () => {
    const skillRoot = seedDrafts('s1', true)
    const result = runScriptClean(skillRoot, 's1')
    expect(result.draftsRemoved).toBe(4)  // plan + 2 scenes + 1 ending
    expect(result.scriptPreserved).toContain('script-s1.json')
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'scripts', '.build-s1'))).toBe(false)
    expect(fs.existsSync(path.join(skillRoot, 'runtime', 'scripts', 'script-s1.json'))).toBe(true)
  })

  it('removes drafts with no final script (preserved=null)', () => {
    const skillRoot = seedDrafts('s1', false)
    const result = runScriptClean(skillRoot, 's1')
    expect(result.draftsRemoved).toBe(4)
    expect(result.scriptPreserved).toBeNull()
  })

  it('is idempotent: 0 drafts when nothing exists', () => {
    const skillRoot = fs.mkdtempSync(path.join(tmp, 'empty-'))
    fs.mkdirSync(path.join(skillRoot, 'runtime', 'scripts'), { recursive: true })
    const result = runScriptClean(skillRoot, 'nonexistent')
    expect(result.draftsRemoved).toBe(0)
    expect(result.scriptPreserved).toBeNull()
  })

  it('only affects the target script id', () => {
    const skillRoot = seedDrafts('s1', true)
    // seed a second script's build dir
    const otherBuild = path.join(skillRoot, 'runtime', 'scripts', '.build-s2')
    fs.mkdirSync(otherBuild, { recursive: true })
    fs.writeFileSync(path.join(otherBuild, 'plan.json'), '{}')

    runScriptClean(skillRoot, 's1')
    expect(fs.existsSync(otherBuild)).toBe(true)
  })
})
