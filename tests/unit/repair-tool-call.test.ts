import { describe, it, expect } from 'vitest'
import { createArrayArgRepair } from '../../src/infra/utils/repair-tool-call.js'
import { NoSuchToolError } from 'ai'

const repair = createArrayArgRepair()

function makeToolCall(input: Record<string, unknown>) {
  return {
    toolCallId: 'test-id',
    toolName: 'test_tool',
    input: JSON.stringify(input),
  }
}

describe('createArrayArgRepair', () => {
  it('returns null for NoSuchToolError', async () => {
    const error = new NoSuchToolError({ toolName: 'nonexistent', availableToolNames: ['a'] })
    const result = await repair({
      toolCall: makeToolCall({ x: '1' }),
      error,
    })
    expect(result).toBeNull()
  })

  it('returns null when no string-encoded arrays found', async () => {
    const result = await repair({
      toolCall: makeToolCall({ name: 'hello', count: 3 }),
      error: new Error('validation failed'),
    })
    expect(result).toBeNull()
  })

  it('fixes a valid JSON-encoded string array', async () => {
    const result = await repair({
      toolCall: makeToolCall({
        flags: '["flag_a", "flag_b", "flag_c"]',
        name: 'test',
      }),
      error: new Error('validation failed'),
    })
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!.input)
    expect(parsed.flags).toEqual(['flag_a', 'flag_b', 'flag_c'])
    expect(parsed.name).toBe('test') // untouched
  })

  it('fixes a JSON-encoded string array with leading/trailing whitespace', async () => {
    const result = await repair({
      toolCall: makeToolCall({
        ip_specific: '\n["rule one", "rule two", "rule three"]\n',
      }),
      error: new Error('validation failed'),
    })
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!.input)
    expect(parsed.ip_specific).toEqual(['rule one', 'rule two', 'rule three'])
  })

  it('fixes a broken JSON array with unescaped inner quotes via regex', async () => {
    // Model sends: ["术语：使用"贼"称呼", "称呼规则", "意象约束"]
    // JSON.parse would fail due to unescaped inner quotes
    const brokenJson = '["术语：使用"贼"称呼", "称呼规则", "意象约束"]'
    const result = await repair({
      toolCall: makeToolCall({ ip_specific: brokenJson }),
      error: new Error('validation failed'),
    })
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!.input)
    expect(Array.isArray(parsed.ip_specific)).toBe(true)
    expect(parsed.ip_specific.length).toBeGreaterThanOrEqual(2)
  })

  it('fixes a JSON-encoded object array', async () => {
    const result = await repair({
      toolCall: makeToolCall({
        options: '[{"label":"Option A"},{"label":"Option B"}]',
      }),
      error: new Error('validation failed'),
    })
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!.input)
    expect(parsed.options).toEqual([{ label: 'Option A' }, { label: 'Option B' }])
  })

  it('does not touch non-array strings', async () => {
    const result = await repair({
      toolCall: makeToolCall({
        name: 'hello world',
        description: 'This is a test',
      }),
      error: new Error('validation failed'),
    })
    expect(result).toBeNull()
  })

  it('returns null for malformed tool call input', async () => {
    const result = await repair({
      toolCall: { toolCallId: 'x', toolName: 'y', input: 'not json at all' },
      error: new Error('validation failed'),
    })
    expect(result).toBeNull()
  })

  it('preserves toolCallId and toolName', async () => {
    const result = await repair({
      toolCall: {
        toolCallId: 'call-123',
        toolName: 'my_tool',
        input: JSON.stringify({ arr: '["a", "b"]' }),
      },
      error: new Error('validation failed'),
    })
    expect(result).not.toBeNull()
    expect(result!.toolCallId).toBe('call-123')
    expect(result!.toolName).toBe('my_tool')
  })
})
