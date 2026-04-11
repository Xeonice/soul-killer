import { describe, it, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Tab completion', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 8: /cr + Tab → /create', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 8: tab completion' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Type "/cr" — wait for palette to show matching commands before Tab
    term.sendKey('/')
    term.sendKey('c')
    term.sendKey('r')
    // Wait for palette to show /create as a suggestion
    await term.waitFor(/\/create/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('tab')

    // Tab should complete to "/create " — wait for the space after create
    await term.waitFor(/\/create /, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')
    await term.waitFor(/Public Soul|Personal Soul|公开|个人/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // If we reach the create wizard, tab completion worked
  })
})
