import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  readHistory,
  historyPath,
} from '../../../../src/export/state/history.js'
import { runInit } from '../../../../src/export/state/init.js'
import { runApply } from '../../../../src/export/state/apply.js'
import { runReset } from '../../../../src/export/state/reset.js'
import { runRebuild } from '../../../../src/export/state/rebuild.js'
import { runSave } from '../../../../src/export/state/save.js'
import { createFixture, type Fixture } from './helpers/state-fixture.js'

describe('history.log integration', () => {
  let fixture: Fixture | null = null
  afterEach(() => {
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
  })

  it('apply creates history.log with one entry', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    const autoStatePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const hPath = historyPath(autoStatePath)
    const entries = readHistory(hPath)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({ sceneId: 'scene-001', choiceId: 'choice-1' })
  })

  it('consecutive applies append in order', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    runApply(fixture.skillRoot, 'script-001', 'scene-002', 'choice-1')

    const autoStatePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const hPath = historyPath(autoStatePath)
    const entries = readHistory(hPath)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ sceneId: 'scene-001', choiceId: 'choice-1' })
    expect(entries[1]).toEqual({ sceneId: 'scene-002', choiceId: 'choice-1' })
  })

  it('history.log format is scene:choice per line', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    const hPath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/history.log')
    const raw = readFileSync(hPath, 'utf8')

    expect(raw).toBe('scene-001:choice-1\n')
  })

  it('init creates empty history.log', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')

    const hPath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/history.log')
    expect(existsSync(hPath)).toBe(true)

    const autoStatePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const entries = readHistory(historyPath(autoStatePath))
    expect(entries).toEqual([])
  })

  it('save copies history.log to manual save', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')

    const saveResult = runSave(fixture.skillRoot, 'script-001')
    expect(saveResult.ok).toBe(true)
    if (!saveResult.ok) return

    const manualHistoryPath = join(
      fixture.skillRoot,
      'runtime/saves/script-001/manual',
      saveResult.timestamp,
      'history.log'
    )
    expect(existsSync(manualHistoryPath)).toBe(true)
    const content = readFileSync(manualHistoryPath, 'utf8')
    expect(content).toBe('scene-001:choice-1\n')
  })

  it('reset clears history.log', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    runApply(fixture.skillRoot, 'script-001', 'scene-002', 'choice-1')
    runReset(fixture.skillRoot, 'script-001')

    const autoStatePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const entries = readHistory(historyPath(autoStatePath))
    expect(entries).toEqual([])
  })

  it('rebuild does not modify history.log', () => {
    fixture = createFixture()
    runInit(fixture.skillRoot, 'script-001')
    runApply(fixture.skillRoot, 'script-001', 'scene-001', 'choice-1')
    runApply(fixture.skillRoot, 'script-001', 'scene-002', 'choice-1')
    runRebuild(fixture.skillRoot, 'script-001')

    const autoStatePath = join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
    const entries = readHistory(historyPath(autoStatePath))
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ sceneId: 'scene-001', choiceId: 'choice-1' })
    expect(entries[1]).toEqual({ sceneId: 'scene-002', choiceId: 'choice-1' })
  })
})
