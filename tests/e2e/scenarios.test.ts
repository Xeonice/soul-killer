import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul, createEvolvedSoul, createTestWorld, bindWorldToSoul } from './fixtures/soul-fixtures.js'
import path from 'node:path'

// Prompt pattern for both void and loaded modes
const PROMPT_RE = /soul:\/\/\S+.*>/

// Set E2E_DEBUG=1 to see detailed timeline for each test
const DEBUG = !!process.env.E2E_DEBUG

// CI-friendly timeout constants
// In CI, PTY I/O and ink rendering can be 3-5x slower than local due to
// resource contention, virtualized I/O, and lack of GPU-accelerated TTY.
// These values are deliberately generous — a slow pass beats a flaky fail.
const SOUL_LOAD_TIMEOUT = 20000
const WIZARD_STEP_TIMEOUT = 10000
const INSTANT_TIMEOUT = 8000

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
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 2: complete create wizard' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Start /create
    term.send('/create')
    // Step 1: type selection — press Enter to accept default (public)
    await term.waitFor(/type|类型|SOULKILLER PROTOCOL/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Step 2: name — enter soul name
    await term.waitFor(/name|名称|Q1/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.send('test-soul-e2e')

    // Step 3: description — enter or skip
    await term.waitFor(/description|描述|Q2/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.send('A test soul')

    // Step 3.5: soul-list — select "continue" (down arrow + enter)
    await term.waitFor(/Added Souls|已添加/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('down')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey('enter')

    // Step 4: tags — skip
    await term.waitFor(/tag|标签|Q3/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Step 5: confirm
    await term.waitFor(/Confirm|确认/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    // Step 6: data sources — skip (Enter)
    await term.waitFor(/data source|Supplement|数据源/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
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
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 4: /list + /use' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // /list should show both souls in the interactive list
    term.send('/list')
    await term.waitFor(/alice/, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    // Both souls render in the same frame, so check buffer directly
    const listBuffer = term.getBuffer()
    expect(listBuffer).toContain('bob')

    // Exit the interactive list with Esc
    await new Promise((r) => setTimeout(r, 200))
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

// ─── Group 4: Evolve → Recall ───────────────────────────────────

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
    // Wait for the data-sources checkbox to appear (not the autocomplete menu)
    // The checkbox renders ◉ (selected) or ◯ (unselected) markers
    await term.waitFor(/◉.*Web Search|◯.*Markdown/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
    // Data sources checkbox: Web Search is pre-selected (◉), Markdown is not (◯)
    // Space (deselect Web Search) → Down → Space (select Markdown) → Enter
    // Add delays for ink to process each keypress
    term.sendKey(' ')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey('down')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey(' ')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey('enter')

    // Enter path for markdown source
    await term.waitFor(/path/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.send(fixturesDir)

    // Wait for evolve to complete and prompt to return
    await term.waitFor(PROMPT_RE, { since: 'last', timeout: 30000 })

    // Recall
    term.send('/recall cyberpunk')
    await term.waitFor(/recall|result|chunk/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
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
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'Scenario 6: chat + context' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Load soul
    term.send('/use alice')
    await term.waitFor(/soul:\/\/alice/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // First message
    term.send('hello')
    await term.waitFor(/mock soul response/i, { since: 'last', timeout: 30000 })
    // Wait a bit for prompt to re-render after streaming completes
    await new Promise((r) => setTimeout(r, 1000))

    expect(mockServer.requests.length).toBeGreaterThanOrEqual(1)

    const firstReq = mockServer.requests[mockServer.requests.length - 1]
    const userMsgs = firstReq.messages.filter((m: { role: string }) => m.role === 'user')
    expect(userMsgs.length).toBe(1)

    // Second message — context should accumulate
    term.send('do you remember what I said')
    await term.waitFor(/mock soul response/i, { since: 'last', timeout: 30000 })
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
    term.send('hello there')
    await term.waitForError('NO SOUL', { timeout: INSTANT_TIMEOUT })
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
    term = new TestTerminal({ homeDir: home.homeDir, label: 'Scenario 8: tab completion' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Type "/cr" then Tab
    term.sendKey('/')
    term.sendKey('c')
    term.sendKey('r')
    term.sendKey('tab')

    // The completed command should appear — verify by sending Enter and seeing create wizard
    // Small delay to let completion render
    await new Promise((r) => setTimeout(r, 200))
    term.sendKey('enter')
    await term.waitFor(/type|类型|SOULKILLER PROTOCOL/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
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

// ─── Group 9: /export flow ─────────────────────────────────────

describe('E2E: /export flow', () => {
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

  it('Scenario 10: /export triggers Export Protocol panel', async () => {
    home = createTestHome({ mockServerUrl: mockServer.url })
    // Create soul + world + binding so export has something to work with
    const { soulDir } = createDistilledSoul(home.homeDir, 'v-export')
    // Add capabilities and milestones files
    const nodeFs = await import('node:fs')
    nodeFs.writeFileSync(path.join(soulDir, 'soul', 'capabilities.md'), '# Capabilities\nSandevistan, Mantis Blades')
    nodeFs.writeFileSync(path.join(soulDir, 'soul', 'milestones.md'), '# Milestones\n## [2077] Relic implant')
    createTestWorld(home.homeDir, 'night-city', {
      displayName: 'Night City',
      description: 'A cyberpunk megalopolis',
    })
    bindWorldToSoul(soulDir, 'night-city')

    // Queue tool calling responses for the Export Agent:
    // Step 1: Agent calls list_souls
    // Step 2: Agent calls list_worlds (only 1 soul, skip selection)
    // Step 3: Agent calls read_soul + read_world
    // Step 4: Agent calls ask_user for tone selection
    // Step 5: Agent calls ask_user for structure confirmation
    // Step 6: Agent calls package_skill
    const tc = (id: string, name: string, args: Record<string, unknown>) => ({
      id,
      type: 'function' as const,
      function: { name, arguments: JSON.stringify(args) },
    })

    mockServer.setResponseQueue([
      // Step 1: call list_souls
      { type: 'tool_calls', tool_calls: [tc('tc1', 'list_souls', {})] },
      // Step 2: only 1 soul, call list_worlds with bound_to_soul
      { type: 'tool_calls', tool_calls: [tc('tc2', 'list_worlds', { bound_to_soul: 'v-export' })] },
      // Step 3: only 1 world, call read_soul + read_world
      { type: 'tool_calls', tool_calls: [
        tc('tc3a', 'read_soul', { name: 'v-export' }),
        tc('tc3b', 'read_world', { name: 'night-city' }),
      ]},
      // Step 4: ask user for tone
      { type: 'tool_calls', tool_calls: [tc('tc4', 'ask_user', {
        question: 'Select story tone',
        options: [
          { label: 'Neon Noir', description: 'Dark alleys and conspiracies' },
          { label: 'Street Survival', description: 'Every day is a fight' },
        ],
      })] },
      // Step 5: ask user for structure confirmation
      { type: 'tool_calls', tool_calls: [tc('tc5', 'ask_user', {
        question: 'Confirm structure',
        options: [
          { label: 'Use recommended (3 acts, 3 endings)' },
          { label: 'Customize' },
        ],
      })] },
      // Step 6: package
      { type: 'tool_calls', tool_calls: [tc('tc6', 'package_skill', {
        soul_name: 'v-export',
        world_name: 'night-city',
        story_spec: {
          genre: 'Neon Noir',
          tone: 'Dark alleys and conspiracies',
          acts: 3,
          endings_min: 3,
          rounds: '8-12',
          constraints: [],
        },
      })] },
      // Step 7: agent wraps up with text
      { type: 'text', content: 'Export complete.' },
    ])

    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'Scenario 10: /export' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Start export
    term.send('/export')

    // Should see the Export Protocol panel
    await term.waitFor(/EXPORT PROTOCOL/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // Agent will call list_souls, list_worlds, read_soul, read_world
    // Then present tone selection — wait for the select UI
    await term.waitFor(/Neon Noir|Select|tone/i, { since: 'last', timeout: 20000 })

    // Select first option (Neon Noir)
    term.sendKey('enter')

    // Wait for structure confirmation — use specific text to avoid matching status bar "confirm"
    await term.waitFor(/Confirm structure|Use recommended/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // Confirm with Enter
    term.sendKey('enter')

    // Wait for export to complete — look for the result panel output
    await term.waitFor(/export complete|SKILL\.md|\.claude\/skills|story-spec\.md/i, { since: 'last', timeout: 20000 })

    // Verify the export directory was created
    const fs = await import('node:fs')
    const exportDir = path.join(home.homeDir, '.soulkiller', 'exports', 'soulkiller:v-export-in-night-city')
    expect(fs.existsSync(exportDir)).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'story-spec.md'))).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'soul', 'identity.md'))).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'soul', 'capabilities.md'))).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'soul', 'milestones.md'))).toBe(true)
    expect(fs.existsSync(path.join(exportDir, 'world', 'world.json'))).toBe(true)
  })
})

// ─── Group 10: /create distill produces capabilities + milestones ──

describe('E2E: Distill with new dimensions', () => {
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

  it('Scenario 11: /evolve distill writes capabilities.md and milestones.md', async () => {
    home = createTestHome({ mockServerUrl: mockServer.url })
    createDistilledSoul(home.homeDir, 'dim-test')
    term = new TestTerminal({ homeDir: home.homeDir, mockServerUrl: mockServer.url, label: 'Scenario 11: distill new dimensions' })
    await term.waitFor(PROMPT_RE, { timeout: 30000 })

    // Load soul
    term.send('/use dim-test')
    await term.waitFor(/soul:\/\/dim-test/, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })

    // Queue distill agent tool calling responses:
    // The evolve flow: ingest markdown → distill agent runs
    // Distill agent will call LLM multiple times, each time we return a tool_call
    const tc = (id: string, name: string, args: Record<string, unknown>) => ({
      id,
      type: 'function' as const,
      function: { name, arguments: JSON.stringify(args) },
    })

    mockServer.setResponseQueue([
      // Step 1: sampleChunks (overview)
      { type: 'tool_calls', tool_calls: [tc('d1', 'sampleChunks', {})] },
      // Step 2: writeIdentity
      { type: 'tool_calls', tool_calls: [tc('d2', 'writeIdentity', { content: '## Background\nA test character for dimension testing.' })] },
      // Step 3: writeStyle
      { type: 'tool_calls', tool_calls: [tc('d3', 'writeStyle', { content: '## Communication\nDirect and concise.\n\n## Characteristic Expressions\n- "Test quote"' })] },
      // Step 4: writeCapabilities
      { type: 'tool_calls', tool_calls: [tc('d4', 'writeCapabilities', { content: '## Abilities\n- Sword mastery A\n- Magic resistance B' })] },
      // Step 5: writeMilestones
      { type: 'tool_calls', tool_calls: [tc('d5', 'writeMilestones', { content: '## [Year 1] Birth\nBorn into the world.\n→ Journey begins' })] },
      // Step 6: writeBehavior
      { type: 'tool_calls', tool_calls: [tc('d6', 'writeBehavior', { name: 'honor-code', content: 'Always keeps promises.' })] },
      // Step 7: writeExample
      { type: 'tool_calls', tool_calls: [tc('d7', 'writeExample', { scenario: 'greeting', messages: [{ role: 'user', content: 'Hello' }, { role: 'character', content: 'Greetings.' }] })] },
      // Step 8: reviewSoul
      { type: 'tool_calls', tool_calls: [tc('d8', 'reviewSoul', {})] },
      // Step 9: finalize
      { type: 'tool_calls', tool_calls: [tc('d9', 'finalize', { summary: 'Distillation complete with capabilities and milestones.' })] },
    ])

    // Start evolve with markdown fixture
    const fixturesDir = 'tests/integration/fixtures'
    term.send('/evolve')
    await term.waitFor(/◉.*Web Search|◯.*Markdown/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
    term.sendKey(' ')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey('down')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey(' ')
    await new Promise((r) => setTimeout(r, 100))
    term.sendKey('enter')

    await term.waitFor(/path/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.send(fixturesDir)

    // Wait for distill to complete
    await term.waitFor(PROMPT_RE, { since: 'last', timeout: 30000 })

    // Verify capabilities.md and milestones.md were created
    const nodeFs = await import('node:fs')
    const soulDir = path.join(home.homeDir, '.soulkiller', 'souls', 'dim-test', 'soul')
    expect(nodeFs.existsSync(path.join(soulDir, 'capabilities.md'))).toBe(true)
    expect(nodeFs.existsSync(path.join(soulDir, 'milestones.md'))).toBe(true)

    // Verify content
    const capContent = nodeFs.readFileSync(path.join(soulDir, 'capabilities.md'), 'utf-8')
    expect(capContent).toContain('Sword mastery')

    const milContent = nodeFs.readFileSync(path.join(soulDir, 'milestones.md'), 'utf-8')
    expect(milContent).toContain('Year 1')
  })
})
