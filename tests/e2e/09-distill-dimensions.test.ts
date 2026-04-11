import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'
import path from 'node:path'

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

    // Queue distill agent tool calling responses
    const tc = (id: string, name: string, args: Record<string, unknown>) => ({
      id,
      type: 'function' as const,
      function: { name, arguments: JSON.stringify(args) },
    })

    mockServer.setResponseQueue([
      { type: 'tool_calls', tool_calls: [tc('d1', 'sampleChunks', {})] },
      { type: 'tool_calls', tool_calls: [tc('d2', 'writeIdentity', { content: '## Background\nA test character for dimension testing.' })] },
      { type: 'tool_calls', tool_calls: [tc('d3', 'writeStyle', { content: '## Communication\nDirect and concise.\n\n## Characteristic Expressions\n- "Test quote"' })] },
      { type: 'tool_calls', tool_calls: [tc('d4', 'writeCapabilities', { content: '## Abilities\n- Sword mastery A\n- Magic resistance B' })] },
      { type: 'tool_calls', tool_calls: [tc('d5', 'writeMilestones', { content: '## [Year 1] Birth\nBorn into the world.\n→ Journey begins' })] },
      { type: 'tool_calls', tool_calls: [tc('d6', 'writeBehavior', { name: 'honor-code', content: 'Always keeps promises.' })] },
      { type: 'tool_calls', tool_calls: [tc('d7', 'writeExample', { scenario: 'greeting', messages: [{ role: 'user', content: 'Hello' }, { role: 'character', content: 'Greetings.' }] })] },
      { type: 'tool_calls', tool_calls: [tc('d8', 'reviewSoul', {})] },
      { type: 'tool_calls', tool_calls: [tc('d9', 'finalize', { summary: 'Distillation complete with capabilities and milestones.' })] },
    ])

    // Start evolve with markdown fixture
    const fixturesDir = 'tests/integration/fixtures'
    term.send('/evolve')
    await term.waitFor(/◉.*Web Search|◯.*Markdown/i, { since: 'last', timeout: SOUL_LOAD_TIMEOUT })
    term.sendKey(' ')
    await term.waitFor(/◯.*Web Search/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('down')
    await term.waitFor(/◯.*Markdown|◉.*Markdown/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey(' ')
    await term.waitFor(/◉.*Markdown/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    term.sendKey('enter')

    await term.waitFor(/path/i, { since: 'last', timeout: WIZARD_STEP_TIMEOUT })
    await term.sendLine(fixturesDir)

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
