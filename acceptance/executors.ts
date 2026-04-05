import fs from 'node:fs'
import path from 'node:path'
import stripAnsi from 'strip-ansi'
import type { StepExecutor, StepDefinition, ExecutionContext, StepResult, DiagnosticContext } from './types.js'

function getDiagnostics(ctx: ExecutionContext): DiagnosticContext {
  return {
    screen: ctx.terminal.getScreen(15),
    timeline: ctx.terminal.getTimeline(),
    bufferTail: stripAnsi(ctx.terminal.getBuffer()).slice(-500),
  }
}

function resolveTimeout(step: StepDefinition, ctx: ExecutionContext): number {
  return step.timeout ?? ctx.globalTimeout
}

function ok(start: number): StepResult {
  return { passed: true, elapsed: Date.now() - start }
}

function fail(start: number, error: string, ctx: ExecutionContext): StepResult {
  return { passed: false, elapsed: Date.now() - start, error, diagnostics: getDiagnostics(ctx) }
}

// ── Interaction executors ──

const sendExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  ctx.terminal.send(step.value as string)
  return ok(start)
}

const sendKeyExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  ctx.terminal.sendKey(step.value as string)
  return ok(start)
}

const sendRawExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const text = step.value as string
  // Access the underlying PTY to write without appending Enter
  const terminal = ctx.terminal as unknown as { proc: { terminal: { write(data: string): void } } }
  for (const char of text) {
    terminal.proc.terminal.write(char)
    await new Promise((r) => setTimeout(r, 10))
  }
  return ok(start)
}

const waitExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const timeout = resolveTimeout(step, ctx)
  try {
    await ctx.terminal.waitFor(step.value as string, { since: 'last', timeout })
    return ok(start)
  } catch (err) {
    return fail(start, `wait timed out for pattern: ${step.value}`, ctx)
  }
}

const waitPromptExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const timeout = resolveTimeout(step, ctx)
  try {
    await ctx.terminal.waitForPrompt({ timeout })
    return ok(start)
  } catch (err) {
    return fail(start, 'wait-prompt timed out', ctx)
  }
}

const waitExitExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const expectedCode = step.value as number
  const timeout = resolveTimeout(step, ctx)
  try {
    const code = await ctx.terminal.waitForExit(timeout)
    if (code !== expectedCode) {
      return fail(start, `expected exit code ${expectedCode}, got ${code}`, ctx)
    }
    return ok(start)
  } catch (err) {
    return fail(start, `wait-exit timed out (expected code ${expectedCode})`, ctx)
  }
}

const sleepExecutor: StepExecutor = async (step) => {
  const start = Date.now()
  const ms = step.value as number
  await new Promise((r) => setTimeout(r, ms))
  return { passed: true, elapsed: Date.now() - start }
}

// ── Assertion executors ──

const expectExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const timeout = resolveTimeout(step, ctx)
  try {
    await ctx.terminal.waitFor(step.value as string, { since: 'last', timeout })
    return ok(start)
  } catch (err) {
    return fail(start, `expect failed: pattern "${step.value}" not found`, ctx)
  }
}

const notExpectExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const pattern = new RegExp(step.value as string)
  const buffer = stripAnsi(ctx.terminal.getBuffer())
  if (pattern.test(buffer)) {
    return fail(start, `not-expect failed: pattern "${step.value}" was found in buffer`, ctx)
  }
  return ok(start)
}

const expectFileExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  const opts = step.value as Record<string, unknown>
  const filePath = path.join(ctx.homeDir, opts.path as string)

  if (opts.exists === false) {
    if (fs.existsSync(filePath)) {
      return fail(start, `expect-file: "${opts.path}" should not exist but does`, ctx)
    }
    return ok(start)
  }

  // exists: true (default)
  if (!fs.existsSync(filePath)) {
    return fail(start, `expect-file: "${opts.path}" does not exist`, ctx)
  }

  if (opts.contains != null) {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.includes(opts.contains as string)) {
      return fail(start, `expect-file: "${opts.path}" does not contain "${opts.contains}"`, ctx)
    }
  }

  return ok(start)
}

const expectRequestExecutor: StepExecutor = async (step, ctx) => {
  const start = Date.now()
  if (!ctx.mockServer) {
    return fail(start, 'expect-request: no mock server configured', ctx)
  }

  const opts = step.value as Record<string, unknown>
  const requests = ctx.mockServer.requests
  const index = (opts.index as number) ?? -1
  const resolvedIndex = index < 0 ? requests.length + index : index

  if (resolvedIndex < 0 || resolvedIndex >= requests.length) {
    return fail(start, `expect-request: request index ${index} out of range (${requests.length} requests)`, ctx)
  }

  const req = requests[resolvedIndex]!
  const userMessages = req.messages.filter((m) => m.role === 'user')

  if (opts['user-messages'] != null) {
    const expected = opts['user-messages'] as number
    if (userMessages.length !== expected) {
      return fail(start, `expect-request: expected ${expected} user messages, got ${userMessages.length}`, ctx)
    }
  }

  if (opts['user-messages-gte'] != null) {
    const min = opts['user-messages-gte'] as number
    if (userMessages.length < min) {
      return fail(start, `expect-request: expected >= ${min} user messages, got ${userMessages.length}`, ctx)
    }
  }

  if (opts['has-system'] === true) {
    if (!req.messages.some((m) => m.role === 'system')) {
      return fail(start, 'expect-request: expected system message but none found', ctx)
    }
  }

  if (opts.stream != null) {
    if (req.stream !== opts.stream) {
      return fail(start, `expect-request: expected stream=${opts.stream}, got stream=${req.stream}`, ctx)
    }
  }

  return ok(start)
}

// ── Registry ──

const executors = new Map<string, StepExecutor>()

executors.set('send', sendExecutor)
executors.set('send-key', sendKeyExecutor)
executors.set('send-raw', sendRawExecutor)
executors.set('wait', waitExecutor)
executors.set('wait-prompt', waitPromptExecutor)
executors.set('wait-exit', waitExitExecutor)
executors.set('sleep', sleepExecutor)
executors.set('expect', expectExecutor)
executors.set('not-expect', notExpectExecutor)
executors.set('expect-file', expectFileExecutor)
executors.set('expect-request', expectRequestExecutor)

export function getExecutor(type: string): StepExecutor | undefined {
  return executors.get(type)
}

export function registerExecutor(type: string, executor: StepExecutor): void {
  executors.set(type, executor)
}
