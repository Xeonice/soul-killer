import { describe, it, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, INSTANT_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Error paths', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 7: error messages for invalid operations', async () => {
    home = createTestHome()
    createDistilledSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 7: error paths' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // /use nonexistent → SOUL NOT FOUND
    term.send('/use nonexistent')
    await term.waitForError('SOUL NOT FOUND', { timeout: INSTANT_TIMEOUT })

    // /recall without args → MISSING ARGUMENT
    term.send('/recall')
    await term.waitForError('MISSING ARGUMENT', { timeout: INSTANT_TIMEOUT })

    // /xyzzy → UNKNOWN COMMAND
    term.send('/xyzzy')
    await term.waitForError('UNKNOWN COMMAND', { timeout: INSTANT_TIMEOUT })

    // Natural language without soul → NO SOUL LOADED
    await term.sendLine('hello there')
    await term.waitForError('NO SOUL', { timeout: INSTANT_TIMEOUT })
  })
})
