import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { TestTerminal } from './harness/test-terminal.js'
import { MockLLMServer } from './harness/mock-llm-server.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { createDistilledSoul } from './fixtures/soul-fixtures.js'
import { PROMPT_RE, SOUL_LOAD_TIMEOUT, DEBUG } from './harness/helpers.js'

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
    // Wait for streaming to start (prompt changes to STREAMING)
    await term.waitFor(/STREAMING/, { since: 'last', timeout: 30000 })
    // Wait for streaming to end (prompt returns to RELIC)
    await term.waitFor(/\[RELIC\]/, { since: 'last', timeout: 30000 })

    expect(mockServer.requests.length).toBeGreaterThanOrEqual(1)

    const firstReq = mockServer.requests[mockServer.requests.length - 1]
    const userMsgs = firstReq.messages.filter((m: { role: string }) => m.role === 'user')
    expect(userMsgs.length).toBe(1)

    // Second message — context should accumulate
    term.send('do you remember what I said')
    await term.waitFor(/STREAMING/, { since: 'last', timeout: 30000 })
    await term.waitFor(/\[RELIC\]/, { since: 'last', timeout: 30000 })

    expect(mockServer.requests.length).toBeGreaterThanOrEqual(2)
    const secondReq = mockServer.requests[mockServer.requests.length - 1]
    // Second request should contain more messages (context from first round)
    const secondUserMsgs = secondReq.messages.filter((m: { role: string }) => m.role === 'user')
    expect(secondUserMsgs.length).toBeGreaterThanOrEqual(2)
  })
})
