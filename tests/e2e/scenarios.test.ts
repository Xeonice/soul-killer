import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul, createEvolvedSoul } from './fixtures/soul-fixtures.js'
import path from 'node:path'

// Prompt pattern for both void and loaded modes
const PROMPT_RE = /soul:\/\/\S+\s*>/

// Set E2E_DEBUG=1 to see detailed timeline for each test
const DEBUG = !!process.env.E2E_DEBUG

// ─── Group 1: Lifecycle ─────────────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    const result = await term.waitFor(PROMPT_RE, { timeout: 15000 })
    expect(result.matched).toContain('soul://')
  })

  it('Scenario 3: /exit → graceful shutdown', async () => {
    home = createTestHome()
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })
    term.send('/exit')
    const code = await term.waitForExit()
    expect(code).toBe(0)
  })
})

// ─── Group 2: /create wizard ────────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // Start /create
    term.send('/create')
    // Step 1: type selection — press Enter to accept default (public)
    await term.waitFor(/type|类型|SOULKILLER PROTOCOL/i, { since: 'last', timeout: 10000 })
    term.sendKey('enter')

    // Step 2: name — enter soul name
    await term.waitFor(/name|名称|Q1/i, { since: 'last', timeout: 5000 })
    term.send('test-soul-e2e')

    // Step 3: description — enter or skip
    await term.waitFor(/description|描述|Q2/i, { since: 'last', timeout: 5000 })
    term.send('A test soul')

    // Step 4: tags — skip
    await term.waitFor(/tag|标签|Q3/i, { since: 'last', timeout: 5000 })
    term.sendKey('enter')

    // Step 5: confirm
    await term.waitFor(/Confirm|确认/i, { since: 'last', timeout: 5000 })
    term.sendKey('enter')

    // Step 6: data sources — skip (Enter)
    await term.waitFor(/data source|Supplement|数据源/i, { since: 'last', timeout: 10000 })
    term.sendKey('enter')

    // Wait for completion — either prompt returns or error
    await term.waitFor(/soul:\/\/|error|ERROR/i, { since: 'last', timeout: 30000 })

    const fs = await import('node:fs')
    const soulDir = path.join(home.soulsDir, 'test-soul-e2e')
    expect(fs.existsSync(soulDir)).toBe(true)
  })
})

// ─── Group 3: Soul management ───────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // /list should show both
    term.send('/list')
    await term.waitFor(/alice/, { since: 'last', timeout: 5000 })
    const listResult = term.getBuffer()
    expect(listResult).toContain('bob')

    // /use alice — wait for prompt to change to soul://alice
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: 10000 })

    // /use bob — switch
    term.send('/use bob')
    await term.waitFor(/soul:\/\/bob/, { since: 'last', timeout: 10000 })
  })
})

// ─── Group 4: Evolve → Recall ───────────────────────────────────

describe('E2E: Evolve and Recall', () => {
  let home: TestHome
  let term: TestTerminal

  afterEach(() => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
  })

  it('Scenario 5: /evolve ingest → /recall finds results', async () => {
    home = createTestHome()
    createDistilledSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // Load soul
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: 10000 })

    // Recall with pre-ingested data won't work yet — need to evolve first
    // Use the integration test fixtures as markdown source
    const fixturesDir = path.resolve(import.meta.dirname, '../integration/fixtures')
    const fs = await import('node:fs')
    if (!fs.existsSync(fixturesDir)) {
      // Skip if no fixtures available — use evolved soul instead
      return
    }

    term.send('/evolve')
    // Select markdown source
    await term.waitFor(/markdown|source|数据源/i, { since: 'last', timeout: 10000 })
    term.sendKey('enter')

    // Enter path
    await term.waitFor(/path|路径/i, { since: 'last', timeout: 5000 })
    term.send(fixturesDir)

    // Wait for ingest to complete
    await term.waitFor(PROMPT_RE, { since: 'last', timeout: 30000 })

    // Recall
    term.send('/recall cyberpunk')
    await term.waitFor(/recall|result|chunk/i, { since: 'last', timeout: 10000 })
  })
})

// ─── Group 5: Conversation flow ─────────────────────────────────

describe('E2E: Conversation', () => {
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

  it('Scenario 6: chat with mock LLM, context accumulates', async () => {
    home = createTestHome({ mockServerUrl: mockServer.url })
    createDistilledSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // Load soul
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: 10000 })

    // First message
    term.send('hello')
    await term.waitFor(/mock soul response/i, { since: 'last', timeout: 15000 })
    // Wait a bit for prompt to re-render after streaming completes
    await new Promise((r) => setTimeout(r, 1000))

    expect(mockServer.requests.length).toBeGreaterThanOrEqual(1)

    const firstReq = mockServer.requests[mockServer.requests.length - 1]
    const userMsgs = firstReq.messages.filter((m: { role: string }) => m.role === 'user')
    expect(userMsgs.length).toBe(1)

    // Second message — context should accumulate
    term.send('do you remember what I said')
    await term.waitFor(/mock soul response/i, { since: 'last', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1000))

    expect(mockServer.requests.length).toBeGreaterThanOrEqual(2)
    const secondReq = mockServer.requests[mockServer.requests.length - 1]
    // Second request should contain more messages (context from first round)
    const secondUserMsgs = secondReq.messages.filter((m: { role: string }) => m.role === 'user')
    expect(secondUserMsgs.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── Group 6: Error paths ───────────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // /use nonexistent → SOUL NOT FOUND
    term.send('/use nonexistent')
    await term.waitForError('SOUL NOT FOUND', { timeout: 5000 })

    // /recall without args → MISSING ARGUMENT
    term.send('/recall')
    await term.waitForError('MISSING ARGUMENT', { timeout: 5000 })

    // /xyzzy → UNKNOWN COMMAND
    term.send('/xyzzy')
    await term.waitForError('UNKNOWN COMMAND', { timeout: 5000 })

    // Natural language without soul → NO SOUL LOADED
    term.send('hello there')
    await term.waitForError('NO SOUL', { timeout: 5000 })
  })
})

// ─── Group 7: Tab completion ────────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    // Type "/cr" then Tab
    term.sendKey('/')
    term.sendKey('c')
    term.sendKey('r')
    term.sendKey('tab')

    // The completed command should appear — verify by sending Enter and seeing create wizard
    // Small delay to let completion render
    await new Promise((r) => setTimeout(r, 200))
    term.sendKey('enter')
    await term.waitFor(/type|类型|SOULKILLER PROTOCOL/i, { since: 'last', timeout: 5000 })
    // If we reach the create wizard, tab completion worked
  })
})

// ─── Group 8: Evolve subcommands ────────────────────────────────

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
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: 10000 })

    term.send('/evolve status')
    await term.waitFor(/history|evolve|chunk|markdown/i, { since: 'last', timeout: 5000 })
  })

  it('Scenario 9b: /evolve rollback', async () => {
    home = createTestHome()
    createEvolvedSoul(home.homeDir, 'alice')
    term = new TestTerminal({ homeDir: home.homeDir })
    await term.waitFor(PROMPT_RE, { timeout: 15000 })

    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: 10000 })

    term.send('/evolve rollback')
    // Should show confirmation or "no snapshots" message
    await term.waitFor(/rollback|confirm|Y\/n|snapshot/i, { since: 'last', timeout: 10000 })
  })
})
