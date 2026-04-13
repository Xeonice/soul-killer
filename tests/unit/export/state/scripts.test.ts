import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runScripts } from '../../../../src/export/state/scripts.js'

function makeTempSkillRoot(): { skillRoot: string; scriptsDir: string; cleanup: () => void } {
  const skillRoot = mkdtempSync(join(tmpdir(), 'soulkiller-scripts-'))
  const scriptsDir = join(skillRoot, 'runtime', 'scripts')
  mkdirSync(scriptsDir, { recursive: true })
  return {
    skillRoot,
    scriptsDir,
    cleanup: () => rmSync(skillRoot, { recursive: true, force: true }),
  }
}

describe('runScripts', () => {
  let cleanup: (() => void) | null = null
  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  it('returns empty list when no scripts exist', () => {
    const tmp = makeTempSkillRoot()
    cleanup = tmp.cleanup
    const result = runScripts(tmp.skillRoot)
    expect(result.count).toBe(0)
    expect(result.scripts).toEqual([])
  })

  it('returns empty list when runtime/scripts/ dir does not exist', () => {
    const skillRoot = mkdtempSync(join(tmpdir(), 'soulkiller-scripts-'))
    cleanup = () => rmSync(skillRoot, { recursive: true, force: true })
    const result = runScripts(skillRoot)
    expect(result.count).toBe(0)
    expect(result.scripts).toEqual([])
  })

  it('lists multiple scripts with metadata', () => {
    const tmp = makeTempSkillRoot()
    cleanup = tmp.cleanup

    writeFileSync(
      join(tmp.scriptsDir, 'script-aaa11111.json'),
      JSON.stringify({
        id: 'aaa11111',
        title: 'First Story',
        generated_at: '2026-04-13T10:00:00Z',
        scenes: { 'scene-1': {} },
      }),
      'utf8'
    )
    writeFileSync(
      join(tmp.scriptsDir, 'script-bbb22222.json'),
      JSON.stringify({
        id: 'bbb22222',
        title: 'Second Story',
        generated_at: '2026-04-13T11:00:00Z',
        scenes: { 'scene-1': {} },
      }),
      'utf8'
    )

    const result = runScripts(tmp.skillRoot)
    expect(result.count).toBe(2)
    expect(result.scripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'aaa11111', title: 'First Story', file: 'script-aaa11111.json' }),
        expect.objectContaining({ id: 'bbb22222', title: 'Second Story', file: 'script-bbb22222.json' }),
      ])
    )
  })

  it('handles corrupted JSON gracefully', () => {
    const tmp = makeTempSkillRoot()
    cleanup = tmp.cleanup

    writeFileSync(join(tmp.scriptsDir, 'script-bad.json'), '{invalid json!!!', 'utf8')
    writeFileSync(
      join(tmp.scriptsDir, 'script-good.json'),
      JSON.stringify({ id: 'good', title: 'Good Story', generated_at: '2026-04-13T10:00:00Z' }),
      'utf8'
    )

    const result = runScripts(tmp.skillRoot)
    expect(result.count).toBe(2)

    const good = result.scripts.find((s) => s.id === 'good')
    expect(good).toBeDefined()
    expect(good!.error).toBeUndefined()

    const bad = result.scripts.find((s) => s.file === 'script-bad.json')
    expect(bad).toBeDefined()
    expect(bad!.error).toBeDefined()
    expect(bad!.id).toBe('bad')
  })

  it('ignores non-script files (.gitkeep, .build dirs)', () => {
    const tmp = makeTempSkillRoot()
    cleanup = tmp.cleanup

    writeFileSync(join(tmp.scriptsDir, '.gitkeep'), '', 'utf8')
    mkdirSync(join(tmp.scriptsDir, '.build-abc12345'))
    writeFileSync(join(tmp.scriptsDir, '.build-abc12345', 'plan.json'), '{}', 'utf8')
    writeFileSync(
      join(tmp.scriptsDir, 'script-only.json'),
      JSON.stringify({ id: 'only', title: 'Only Script', generated_at: '2026-04-13T10:00:00Z' }),
      'utf8'
    )

    const result = runScripts(tmp.skillRoot)
    expect(result.count).toBe(1)
    expect(result.scripts[0].id).toBe('only')
  })
})
