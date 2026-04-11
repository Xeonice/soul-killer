import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'
import path from 'node:path'
import fs from 'node:fs'

describe('E2E: /pack and /unpack', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 14: /pack soul → /unpack restores', async () => {
    home = createTestHome()
    createDistilledSoul(home.homeDir, 'pack-test')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 14: pack/unpack' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Pack the soul
    term.send('/pack soul pack-test')
    await term.waitFor(/Pack complete|pack.*success/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })

    // Extract pack file path from output (Output: <path>)
    const buffer = term.getBuffer()
    const pathMatch = buffer.match(/Output:\s*(\S+\.pack)/)
    expect(pathMatch).not.toBeNull()
    const packPath = pathMatch![1]
    expect(fs.existsSync(packPath)).toBe(true)

    // Wait for prompt to return — pack output and prompt may be in the same frame,
    // so wait a bit then check the full buffer
    await term.waitFor(PROMPT_RE, { since: 'start', timeout: SOUL_LOAD_TIMEOUT })

    // Delete the original soul directory
    const soulDir = path.join(home.homeDir, '.soulkiller', 'souls', 'pack-test')
    fs.rmSync(soulDir, { recursive: true })
    expect(fs.existsSync(soulDir)).toBe(false)

    // Unpack — should restore without conflicts
    term.send(`/unpack ${packPath}`)
    await term.waitFor(/Unpack complete|unpack.*success/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })

    // Verify soul was restored
    expect(fs.existsSync(soulDir)).toBe(true)
    expect(fs.existsSync(path.join(soulDir, 'manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(soulDir, 'soul', 'identity.md'))).toBe(true)
  })
})
