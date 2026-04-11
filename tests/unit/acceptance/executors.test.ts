import { describe, it, expect, vi } from 'vitest'
import { getExecutor, registerExecutor } from '../../../acceptance/executors.js'
import type { ExecutionContext, StepDefinition } from '../../../acceptance/types.js'

// Minimal mock for TestTerminal
function createMockTerminal(opts?: {
  buffer?: string
  waitForResult?: { matched: string; fullBuffer: string; elapsed: number }
  waitForShouldThrow?: boolean
  exitCode?: number
}) {
  const buffer = opts?.buffer ?? ''
  return {
    send: vi.fn(),
    sendKey: vi.fn(),
    getBuffer: vi.fn(() => buffer),
    getScreen: vi.fn(() => buffer),
    getTimeline: vi.fn(() => ''),
    waitFor: vi.fn(async () => {
      if (opts?.waitForShouldThrow) throw new Error('timeout')
      return opts?.waitForResult ?? { matched: 'ok', fullBuffer: buffer, elapsed: 10 }
    }),
    waitForPrompt: vi.fn(async () => {
      if (opts?.waitForShouldThrow) throw new Error('timeout')
      return opts?.waitForResult ?? { matched: 'soul://void>', fullBuffer: buffer, elapsed: 10 }
    }),
    waitForExit: vi.fn(async () => {
      if (opts?.waitForShouldThrow) throw new Error('timeout')
      return opts?.exitCode ?? 0
    }),
    proc: { terminal: { write: vi.fn() } },
    kill: vi.fn(),
  } as unknown as ExecutionContext['terminal']
}

function createCtx(terminal: ExecutionContext['terminal'], mockServer?: ExecutionContext['mockServer']): ExecutionContext {
  return { terminal, mockServer: mockServer ?? null, homeDir: '/tmp/test', globalTimeout: 10_000 }
}

function step(type: string, value?: unknown): StepDefinition {
  return { type, value: value as StepDefinition['value'], raw: { [type]: value } }
}

describe('send executor', () => {
  it('calls terminal.send with text', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const result = await getExecutor('send')!(step('send', '/help'), ctx)
    expect(result.passed).toBe(true)
    expect(term.send).toHaveBeenCalledWith('/help')
  })
})

describe('send-key executor', () => {
  it('calls terminal.sendKey', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const result = await getExecutor('send-key')!(step('send-key', 'enter'), ctx)
    expect(result.passed).toBe(true)
    expect(term.sendKey).toHaveBeenCalledWith('enter')
  })
})

describe('wait executor', () => {
  it('passes when pattern matches', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const result = await getExecutor('wait')!(step('wait', 'hello'), ctx)
    expect(result.passed).toBe(true)
  })

  it('fails on timeout', async () => {
    const term = createMockTerminal({ waitForShouldThrow: true })
    const ctx = createCtx(term)
    const result = await getExecutor('wait')!(step('wait', 'hello'), ctx)
    expect(result.passed).toBe(false)
    expect(result.error).toContain('timed out')
  })
})

describe('wait-prompt executor', () => {
  it('passes when prompt appears', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const result = await getExecutor('wait-prompt')!(step('wait-prompt'), ctx)
    expect(result.passed).toBe(true)
  })
})

describe('wait-exit executor', () => {
  it('passes when exit code matches', async () => {
    const term = createMockTerminal({ exitCode: 0 })
    const ctx = createCtx(term)
    const result = await getExecutor('wait-exit')!(step('wait-exit', 0), ctx)
    expect(result.passed).toBe(true)
  })

  it('fails when exit code differs', async () => {
    const term = createMockTerminal({ exitCode: 1 })
    const ctx = createCtx(term)
    const result = await getExecutor('wait-exit')!(step('wait-exit', 0), ctx)
    expect(result.passed).toBe(false)
    expect(result.error).toContain('expected exit code 0, got 1')
  })
})

describe('expect executor', () => {
  it('passes when pattern matches', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const result = await getExecutor('expect')!(step('expect', 'COMMANDS'), ctx)
    expect(result.passed).toBe(true)
  })

  it('fails on timeout', async () => {
    const term = createMockTerminal({ waitForShouldThrow: true })
    const ctx = createCtx(term)
    const result = await getExecutor('expect')!(step('expect', 'COMMANDS'), ctx)
    expect(result.passed).toBe(false)
    expect(result.error).toContain('expect failed')
  })
})

describe('not-expect executor', () => {
  it('passes when pattern is absent', async () => {
    const term = createMockTerminal({ buffer: 'all good here' })
    const ctx = createCtx(term)
    const result = await getExecutor('not-expect')!(step('not-expect', 'ERROR'), ctx)
    expect(result.passed).toBe(true)
  })

  it('fails when pattern is found', async () => {
    const term = createMockTerminal({ buffer: 'something ERROR happened' })
    const ctx = createCtx(term)
    const result = await getExecutor('not-expect')!(step('not-expect', 'ERROR'), ctx)
    expect(result.passed).toBe(false)
    expect(result.error).toContain('was found in buffer')
  })
})

describe('expect-request executor', () => {
  const mockServer = {
    requests: [
      {
        messages: [
          { role: 'system', content: 'You are...' },
          { role: 'user', content: 'hello' },
        ],
        model: 'test',
        stream: true,
        timestamp: Date.now(),
      },
      {
        messages: [
          { role: 'system', content: 'You are...' },
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
          { role: 'user', content: 'how are you' },
        ],
        model: 'test',
        stream: true,
        timestamp: Date.now(),
      },
    ],
  } as unknown as ExecutionContext['mockServer']

  it('asserts user-messages count', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term, mockServer)
    const result = await getExecutor('expect-request')!(
      step('expect-request', { index: 0, 'user-messages': 1 }),
      ctx,
    )
    expect(result.passed).toBe(true)
  })

  it('asserts user-messages-gte', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term, mockServer)
    const result = await getExecutor('expect-request')!(
      step('expect-request', { index: -1, 'user-messages-gte': 2 }),
      ctx,
    )
    expect(result.passed).toBe(true)
  })

  it('asserts has-system', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term, mockServer)
    const result = await getExecutor('expect-request')!(
      step('expect-request', { index: 0, 'has-system': true }),
      ctx,
    )
    expect(result.passed).toBe(true)
  })

  it('asserts stream flag', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term, mockServer)
    const result = await getExecutor('expect-request')!(
      step('expect-request', { index: 0, stream: true }),
      ctx,
    )
    expect(result.passed).toBe(true)
  })

  it('fails when no mock server', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term, null)
    const result = await getExecutor('expect-request')!(
      step('expect-request', { index: 0 }),
      ctx,
    )
    expect(result.passed).toBe(false)
    expect(result.error).toContain('no mock server')
  })
})

describe('sleep executor', () => {
  it('waits specified ms', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const start = Date.now()
    const result = await getExecutor('sleep')!(step('sleep', 50), ctx)
    expect(result.passed).toBe(true)
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })
})

describe('step-level timeout', () => {
  it('uses step timeout over global', async () => {
    const term = createMockTerminal()
    const ctx = createCtx(term)
    const s = { ...step('wait', 'hello'), timeout: 5000 }
    await getExecutor('wait')!(s, ctx)
    expect(term.waitFor).toHaveBeenCalledWith('hello', { since: 'last', timeout: 5000 })
  })
})

describe('registerExecutor', () => {
  it('allows registering custom executors', async () => {
    const custom = vi.fn(async () => ({ passed: true, elapsed: 0 }))
    registerExecutor('custom-test', custom)
    const executor = getExecutor('custom-test')
    expect(executor).toBe(custom)
  })
})
