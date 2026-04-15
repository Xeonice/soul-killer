import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul, createTestWorld, bindWorldToSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'
import { getSkillBaseName } from '../../src/export/packager.js'

/**
 * Focused E2E tests for the /export wizard's `entering-version` step.
 * The agent is never invoked — we stop at the version prompt, inspect the
 * pre-filled default, and either submit or check the empty-value error.
 */

const STORY_NAME = 'Test Story'
const WORLD_NAME = 'night-city'
const BASE_NAME = getSkillBaseName(STORY_NAME, WORLD_NAME)

describe('E2E: /export author-version step', () => {
  let home: TestHome
  let term: TestTerminal | undefined
  let mockServer: MockLLMServer

  beforeAll(async () => {
    mockServer = new MockLLMServer()
    await mockServer.start()
  })

  afterAll(async () => {
    await mockServer.stop()
  })

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  function setupFixtures(): string {
    home = createTestHome({ mockServerUrl: mockServer.url })
    const { soulDir } = createDistilledSoul(home.homeDir, 'v-export', {
      identity: '# V-Export Identity\n\nA cyberpunk netrunner who survived the Soulkiller protocol. Expert in ICE breaking and neural interface hacking. Known for cold precision under pressure.',
    })
    fs.writeFileSync(path.join(soulDir, 'soul', 'capabilities.md'), '# Capabilities\nSandevistan, Mantis Blades')
    fs.writeFileSync(path.join(soulDir, 'soul', 'milestones.md'), '# Milestones\n## [2077] Relic implant')
    createTestWorld(home.homeDir, WORLD_NAME, {
      displayName: 'Night City',
      description: 'A cyberpunk megalopolis',
    })
    bindWorldToSoul(soulDir, WORLD_NAME)
    return soulDir
  }

  async function walkToVersionStep(term: TestTerminal): Promise<void> {
    await term.waitFor(PROMPT_RE, { timeout: 30000 })
    term.send('/export')

    // Character selection: space toggles, enter confirms
    await term.waitFor(/Select characters|Space to toggle/i, { timeout: SOUL_LOAD_TIMEOUT })
    term.sendKey(' ')
    await term.waitFor(/\[x\]|◉|✓/, { timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // World selection
    await term.waitFor(/Select world|Night City/i, { timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Story name
    await term.waitFor(/Story name|story.*name/i, { timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine(STORY_NAME)

    // Story direction (optional) — skip with empty enter
    await term.waitFor(/direction|方向|optional|可选/i, { timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Language — accept default zh (first option)
    await term.waitFor(/language|语言|言語|zh/i, { timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Output — accept default (.soulkiller/exports)
    await term.waitFor(/output|输出|exports/i, { timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Version step
    await term.waitFor(/Skill 版本号|Skill version|バージョン/i, { timeout: WIZARD_STEP_TIMEOUT })
  }

  it('first-time export defaults to 0.1.0', async () => {
    setupFixtures()
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'version-first' })
    await walkToVersionStep(term)
    const buffer = term.getBuffer()
    expect(buffer).toMatch(/0\.1\.0/)
  }, 60000)

  it('re-export reads previous version and bumps patch', async () => {
    setupFixtures()
    // Pre-seed the target path with a prior export's soulkiller.json
    const outputBaseDir = path.join(home.homeDir, '.soulkiller', 'exports')
    const priorDir = path.join(outputBaseDir, BASE_NAME)
    fs.mkdirSync(priorDir, { recursive: true })
    fs.writeFileSync(
      path.join(priorDir, 'soulkiller.json'),
      JSON.stringify({ version: '1.0.3', engine_version: 2, skill_id: BASE_NAME }, null, 2),
    )

    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'version-bump' })
    await walkToVersionStep(term)
    const buffer = term.getBuffer()
    expect(buffer).toMatch(/1\.0\.4/)
    // Must NOT suggest 0.1.0 (the first-export default)
    expect(buffer).not.toMatch(/❯ 0\.1\.0/)
  }, 60000)

  it('empty submit shows required-value error', async () => {
    setupFixtures()
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'version-empty' })
    await walkToVersionStep(term)

    // Delete the 5 chars of "0.1.0" default via Backspace (KEY_MAP 'backspace')
    for (let i = 0; i < 5; i++) {
      term.sendKey('backspace')
      await new Promise((r) => setTimeout(r, 20))
    }
    term.sendKey('enter')
    await term.waitFor(/不能为空|cannot be empty|空にできません/i, { timeout: WIZARD_STEP_TIMEOUT })
  }, 60000)
})
