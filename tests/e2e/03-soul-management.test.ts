import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Soul management', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 4: /list shows multiple souls, /use switches', async () => {
    home = createTestHome()
    createDistilledSoul(home.homeDir, 'alice')
    createDistilledSoul(home.homeDir, 'bob')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 4: /list + /use' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // /list should show both souls in the interactive list
    term.send('/list')
    // Wait for the ScrollableList to render with soul names
    await term.waitFor(/alice.*chunks|bob.*chunks/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Both souls render in the same frame, so check buffer directly
    const listBuffer = term.getBuffer()
    expect(listBuffer).toContain('bob')

    // Exit the interactive list with Esc
    term.sendKey('escape')
    await term.waitFor(PROMPT_RE, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // /use alice — wait for prompt to change to soul://alice
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // /use bob — switch
    term.send('/use bob')
    await term.waitFor(/soul:\/\/bob/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
  })
})
