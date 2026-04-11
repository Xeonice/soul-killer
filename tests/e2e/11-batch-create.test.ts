import { describe, it, expect, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: Batch create', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 13: /create batch — add 2 souls → soul-list shows both → Continue', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 13: batch create' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Start /create
    term.send('/create')
    // Step 1: type-select — wait for options, select public
    await term.waitFor(/Public Soul|公开/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('down')
    await term.sendKeyAfter('enter')

    // Soul 1: name
    await term.waitFor(/name|名称/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('batch-soul-one')

    // Soul 1: description
    await term.waitFor(/description|描述/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('First batch soul')

    // soul-list — shows 1 soul, select "Add" to add another
    await term.waitFor(/Added Souls|已添加/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // "Add" should be the first option
    await term.sendKeyAfter('enter')

    // Soul 2: name
    await term.waitFor(/name|名称/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('batch-soul-two')

    // Soul 2: description
    await term.waitFor(/description|描述/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine('Second batch soul')

    // soul-list — now shows 2 souls
    await term.waitFor(/Added Souls|已添加/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    const buffer = term.getBuffer()
    expect(buffer).toContain('batch-soul-one')
    expect(buffer).toContain('batch-soul-two')

    // Select "Continue" (should be second option after "Add")
    term.sendKey('down')
    await term.waitFor(/Continue|继续/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendKeyAfter('enter')

    // Batch mode skips tags, goes to data-sources
    await term.waitFor(/data source|Supplement|数据源/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Verified we reached data-sources with 2 souls — batch flow works
  })
})
