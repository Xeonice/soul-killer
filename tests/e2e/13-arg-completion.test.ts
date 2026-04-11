import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Arg completion', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 15: /use <space> shows soul arg palette', async () => {
    home = createTestHome()
    createDistilledSoul(home.homeDir, 'alpha')
    createDistilledSoul(home.homeDir, 'beta')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 15: arg completion' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Type "/use " (with space) to trigger arg palette
    term.sendKey('/')
    term.sendKey('u')
    term.sendKey('s')
    term.sendKey('e')
    term.sendKey(' ')

    // Wait for arg palette to show SOULS title and soul names
    await term.waitFor(/SOULS/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })

    // Verify both souls appear in the palette
    const buffer = term.getBuffer()
    expect(buffer).toContain('alpha')
    expect(buffer).toContain('beta')

    // Tab to select first soul, then verify input updated
    term.sendKey('tab')
    await term.waitFor(/\/use (alpha|beta)/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
  })
})
