import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { PROMPT_RE, DEBUG } from './harness/helpers.js'

describe('E2E: Lifecycle', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 1: cold boot → idle prompt', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 1: cold boot → idle prompt' })
    const result = await term.waitFor(PROMPT_RE, { timeout: 30000 })
    expect(result.matched).toContain('soul://')
  })

  it('Scenario 3: /exit → graceful shutdown', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 3: /exit → graceful shutdown' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })
    term.send('/exit')
    const code = await term.waitForExit()
    expect(code).toBe(0)
  })
})
