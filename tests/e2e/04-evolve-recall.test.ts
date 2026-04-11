import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul, createEvolvedSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Evolve and Recall', () => {
  let home: TestHome
  let term: TestTerminal
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

  it('Scenario 5: /evolve ingest → /recall finds results', async () => {
    home = createTestHome({ mockServerUrl: mockServer.url })
    createDistilledSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'Scenario 5: /evolve → /recall' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Load soul
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // Use the integration test fixtures as markdown source (relative to project root / PTY cwd)
    const fixturesDir = 'tests/integration/fixtures'

    term.send('/evolve')
    // Wait for the data-sources checkbox to appear
    await term.waitFor(/◉.*Web Search|◯.*Markdown/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
    // Data sources checkbox: Web Search is pre-selected (◉), Markdown is not (◯)
    // Space (deselect Web Search) → Down → Space (select Markdown) → Enter
    term.sendKey(' ')
    await term.waitFor(/◯.*Web Search/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('down')
    await term.waitFor(/◯.*Markdown|◉.*Markdown/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey(' ')
    await term.waitFor(/◉.*Markdown/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Enter path for markdown source
    await term.waitFor(/path/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine(fixturesDir)

    // Wait for evolve to complete and prompt to return
    await term.waitFor(PROMPT_RE, { since: 'last', timeout: 30000 })

    // Recall
    term.send('/recall cyberpunk')
    await term.waitFor(/recall|result|chunk/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
  })
})

describe('E2E: Evolve subcommands', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 9: /evolve status shows history', async () => {
    home = createTestHome()
    createEvolvedSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 9: /evolve status' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    term.send('/evolve status')
    await term.waitFor(/history|evolve|chunk|markdown/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
  })

  it('Scenario 9b: /evolve rollback', async () => {
    home = createTestHome()
    createEvolvedSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 9b: /evolve rollback' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    term.send('/evolve rollback')
    // Should show confirmation or "no snapshots" message
    await term.waitFor(/rollback|confirm|Y\/n|snapshot/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
  })
})
