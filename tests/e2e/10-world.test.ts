import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'
import path from 'node:path'
import fs from 'node:fs'

describe('E2E: /world create', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 12: /world create wizard → empty world', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 12: /world create' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Start /world
    term.send('/world')
    // Top menu — wait for Create option
    await term.waitFor(/Create|创建/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Select Create (first option, just press Enter)
    await term.sendKeyAfter('enter')

    // Step 1: type-select — wait for world type options
    await term.waitFor(/Existing Fiction|Original World|Real World/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Select first option (Existing Fiction)
    await term.sendKeyAfter('enter')

    // Step 2: name — enter world name
    await term.waitFor(/World name|name/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('test-world')

    // Step 3: display-name
    await term.waitFor(/Display name|display/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('Test World')

    // Step 4: description
    await term.waitFor(/Describe|description/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('A test world for E2E')

    // Step 5: traits — skip (press Enter)
    await term.waitFor(/traits|Enter to skip/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Step 6: confirm — select "Confirm and create"
    await term.waitFor(/Confirm|confirm/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Step 7: data-sources — deselect web-search (pre-selected) then submit empty
    await term.waitFor(/data source|Select data/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Space to deselect web-search, then Enter to submit with nothing selected
    term.sendKey(' ')
    await term.waitFor(/◯/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Empty sources → creates world directly, returns to world menu
    await term.waitFor(/World Management|created|done/i, { since: 'last', timeout: 15000 })

    // Verify world directory exists
    const worldDir = path.join(home.homeDir, '.soulkiller', 'worlds', 'test-world')
    expect(fs.existsSync(worldDir)).toBe(true)
    expect(fs.existsSync(path.join(worldDir, 'world.json'))).toBe(true)
  })
})
