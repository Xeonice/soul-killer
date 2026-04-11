import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'
import path from 'node:path'

describe('E2E: /create flow', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 2: complete create wizard', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 2: complete create wizard' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Start /create (use send for slash commands that trigger interactive mode)
    term.send('/create')
    // Step 1: type selection — wait for full UI to render (Public Soul is last option)
    await term.waitFor(/Public Soul|公开/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Accept default (personal) — sendKeyAfter gives ink a render cycle
    await term.sendKeyAfter('enter')

    // Step 2: name — enter soul name
    await term.waitFor(/name|名称/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('test-soul-e2e')

    // Step 3: description — enter or skip
    await term.waitFor(/description|描述/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('A test soul')

    // Step 3.5: soul-list — select "continue" (down arrow + enter)
    await term.waitFor(/Added Souls|已添加/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('down')
    await term.waitFor(/Continue|继续/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Step 4: tags — skip
    await term.waitFor(/tag|标签/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Step 5: confirm
    await term.waitFor(/Confirm|确认/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Step 6: data sources — skip (Enter)
    await term.waitFor(/data source|Supplement|数据源/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Wait for completion — either prompt returns or error
    await term.waitFor(/soul:\/\/|error|ERROR/i, { since: 'last', timeout: 30000 })

    const fs = await import('node:fs')
    const soulDir = path.join(home.soulsDir, 'test-soul-e2e')
    expect(fs.existsSync(soulDir)).toBe(true)
  })
})
