import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInit } from '../../../../src/export/state/init.js'
import { runApply } from '../../../../src/export/state/apply.js'
import { runList } from '../../../../src/export/state/list.js'
import { runSave, MANUAL_SAVE_LIMIT } from '../../../../src/export/state/save.js'
import { createFixture, type Fixture } from './helpers/state-fixture.js'

describe('runList', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('returns null auto and empty manual when no saves exist', () => {
    fixture = createFixture()
    const result = runList(fixture.skillRoot, 'script-001')
    expect(result.scriptId).toBe('script-001')
    expect(result.auto).toBeNull()
    expect(result.manual).toEqual([])
  })

  it('returns auto save after init', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runList(fixture.skillRoot, 'script-001')
    expect(result.auto).not.toBeNull()
    expect(result.auto!.currentScene).toBe('scene-001')
    expect(typeof result.auto!.lastPlayedAt).toBe('string')
    expect(result.manual).toEqual([])
  })

  it('lists manual saves in chronological order', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')

    // Create manual saves with known timestamps
    const manualDir = join(fixture.skillRoot, 'runtime/saves/script-001/manual')
    for (const ts of ['1712345600', '1712345700', '1712345500']) {
      const dir = join(manualDir, ts)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'meta.yaml'),
        `script_ref: script-001\ncurrent_scene: scene-001\nlast_played_at: 2026-04-10T12:00:00Z\n`,
        'utf8'
      )
      writeFileSync(join(dir, 'state.yaml'), 'current_scene: scene-001\nstate:\n', 'utf8')
    }

    const result = runList(fixture.skillRoot, 'script-001')
    expect(result.manual).toHaveLength(3)
    // Should be sorted chronologically (lexicographic = chronological for timestamps)
    expect(result.manual[0]!.timestamp).toBe('1712345500')
    expect(result.manual[1]!.timestamp).toBe('1712345600')
    expect(result.manual[2]!.timestamp).toBe('1712345700')
  })

  it('skips corrupted manual saves', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')

    const manualDir = join(fixture.skillRoot, 'runtime/saves/script-001/manual')
    // Good save
    const goodDir = join(manualDir, '1712345600')
    mkdirSync(goodDir, { recursive: true })
    writeFileSync(
      join(goodDir, 'meta.yaml'),
      'script_ref: script-001\ncurrent_scene: scene-001\n',
      'utf8'
    )
    writeFileSync(join(goodDir, 'state.yaml'), 'current_scene: scene-001\nstate:\n', 'utf8')

    // Corrupted save (missing meta.yaml)
    const badDir = join(manualDir, '1712345700')
    mkdirSync(badDir, { recursive: true })
    writeFileSync(join(badDir, 'state.yaml'), 'current_scene: scene-001\nstate:\n', 'utf8')

    const result = runList(fixture.skillRoot, 'script-001')
    expect(result.manual).toHaveLength(1)
    expect(result.manual[0]!.timestamp).toBe('1712345600')
  })
})

describe('runSave', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('creates a manual save from auto save', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    const result = runSave(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scriptId).toBe('script-001')
    expect(result.currentScene).toBe('scene-001')
    expect(typeof result.timestamp).toBe('string')

    // Verify manual save directory was created
    const manualDir = join(fixture.skillRoot, 'runtime/saves/script-001/manual', result.timestamp)
    expect(existsSync(join(manualDir, 'state.yaml'))).toBe(true)
    expect(existsSync(join(manualDir, 'meta.yaml'))).toBe(true)
  })

  it('returns NO_AUTO_SAVE when no auto save exists', () => {
    fixture = createFixture()
    const result = runSave(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('NO_AUTO_SAVE')
  })

  it('returns MANUAL_SAVE_LIMIT_REACHED when at capacity', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')

    // Pre-create 3 manual saves
    const manualDir = join(fixture.skillRoot, 'runtime/saves/script-001/manual')
    for (const ts of ['1712345500', '1712345600', '1712345700']) {
      const dir = join(manualDir, ts)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'meta.yaml'), 'script_ref: script-001\ncurrent_scene: scene-001\n', 'utf8')
      writeFileSync(join(dir, 'state.yaml'), 'current_scene: scene-001\nstate:\n', 'utf8')
    }

    const result = runSave(fixture.skillRoot, 'script-001')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('MANUAL_SAVE_LIMIT_REACHED')
    expect((result as { existing: string[] }).existing).toHaveLength(3)
  })

  it('overwrites a specified manual save', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    // Pre-create 3 manual saves
    const manualDir = join(fixture.skillRoot, 'runtime/saves/script-001/manual')
    for (const ts of ['1712345500', '1712345600', '1712345700']) {
      const dir = join(manualDir, ts)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'meta.yaml'), 'script_ref: script-001\ncurrent_scene: scene-001\n', 'utf8')
      writeFileSync(join(dir, 'state.yaml'), 'current_scene: scene-001\nstate:\n', 'utf8')
    }

    // Overwrite the oldest one
    const result = runSave(fixture.skillRoot, 'script-001', '1712345500')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Old save should be gone
    expect(existsSync(join(manualDir, '1712345500'))).toBe(false)

    // New save should exist with current state (scene-002 after apply)
    const newDir = join(manualDir, result.timestamp)
    expect(existsSync(join(newDir, 'state.yaml'))).toBe(true)

    // Total manual saves should still be 3
    const dirs = readdirSync(manualDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    expect(dirs).toHaveLength(3)
  })

  it('does not affect auto save when creating manual save', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    const autoStateBefore = require('node:fs').readFileSync(
      join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'),
      'utf8'
    )

    runSave(fixture.skillRoot, 'script-001')

    const autoStateAfter = require('node:fs').readFileSync(
      join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml'),
      'utf8'
    )
    expect(autoStateAfter).toBe(autoStateBefore)
  })

  it('copies history.log to manual save', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    const saveResult = runSave(fixture.skillRoot, 'script-001')
    expect(saveResult.ok).toBe(true)
    if (!saveResult.ok) return
    const manualHistoryPath = join(fixture.skillRoot, 'runtime/saves/script-001/manual', saveResult.timestamp, 'history.log')
    expect(existsSync(manualHistoryPath)).toBe(true)
    const content = readFileSync(manualHistoryPath, 'utf8')
    expect(content).toBe('scene-001:choice-1\n')
  })

  it('manual save limit is 3', () => {
    expect(MANUAL_SAVE_LIMIT).toBe(3)
  })
})
