import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { TextInput } from '../../../src/cli/components/text-input.js'

/**
 * Tests that the prompt string is rendered inline with the text input cursor,
 * not on a separate line. Regression test for the bug where SoulPrompt
 * and TextInput were rendered as separate components causing the cursor
 * to appear above the prompt line.
 */
describe('Prompt inline with TextInput', () => {
  it('void prompt and cursor appear on the same line', () => {
    const { lastFrame } = render(
      <TextInput prompt="◈ soul://void >" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    // The prompt and cursor (█) must be on the same line
    const lines = frame.split('\n').filter((l) => l.trim())
    const promptLine = lines.find((l) => l.includes('soul://void'))
    expect(promptLine).toBeDefined()
    expect(promptLine).toContain('█')
  })

  it('loaded soul prompt and cursor appear on the same line', () => {
    const { lastFrame } = render(
      <TextInput prompt="◈ soul://强尼银手 >" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    const lines = frame.split('\n').filter((l) => l.trim())
    const promptLine = lines.find((l) => l.includes('soul://强尼银手'))
    expect(promptLine).toBeDefined()
    expect(promptLine).toContain('█')
  })

  it('relic prompt with status tag and cursor on the same line', () => {
    const { lastFrame } = render(
      <TextInput prompt="◈ soul://douglastang [RELIC] >" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    const lines = frame.split('\n').filter((l) => l.trim())
    const promptLine = lines.find((l) => l.includes('[RELIC]'))
    expect(promptLine).toBeDefined()
    expect(promptLine).toContain('█')
  })

  it('prompt with CJK characters renders correctly inline', () => {
    const { lastFrame } = render(
      <TextInput prompt="◈ soul://测试用户 >" onSubmit={() => {}} />
    )
    const frame = lastFrame()!
    const lines = frame.split('\n').filter((l) => l.trim())
    const promptLine = lines.find((l) => l.includes('soul://测试用户'))
    expect(promptLine).toBeDefined()
    expect(promptLine).toContain('█')
    // Must be exactly one content line (prompt + cursor together)
    expect(lines.length).toBe(1)
  })
})
