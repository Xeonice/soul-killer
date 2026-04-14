import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { SetupWizard } from '../../src/config/setup-wizard.js'
import type { SoulkillerConfig } from '../../src/config/schema.js'

const DELAY = 80
const ENTER = '\r'
const ESC = '\u001B'

// Mock external side effects: disk writes, LLM validation, Docker probe
vi.mock('../../src/config/loader.js', () => ({ saveConfig: vi.fn() }))

const validateMock = vi.fn()
vi.mock('../../src/infra/llm/client.js', () => ({
  validateApiKey: (...args: unknown[]) => validateMock(...args),
}))

function makeConfig(overrides: Partial<SoulkillerConfig> = {}): SoulkillerConfig {
  return {
    llm: { provider: 'openrouter', api_key: 'sk-existing', default_model: 'google/gemini-2.5-flash' },
    language: 'zh',
    animation: true,
    search: { provider: 'tavily', tavily_api_key: 'tv-key' },
    ...overrides,
  }
}

beforeEach(() => {
  validateMock.mockReset()
})

describe('SetupWizard initialConfig re-run', () => {
  it('first-run (no initialConfig) skips confirm step and shows language', () => {
    const { lastFrame } = render(
      <SetupWizard onComplete={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('Select Language')
    expect(frame).not.toContain('confirm')
  })

  it('re-run shows confirm step first with defaultYes=false', () => {
    const { lastFrame } = render(
      <SetupWizard initialConfig={makeConfig()} onComplete={() => {}} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('(y/N)') // default-no confirm
  })

  it('confirm Esc fires onCancel without onComplete', async () => {
    const onComplete = vi.fn()
    const onCancel = vi.fn()
    const { stdin } = render(
      <SetupWizard
        initialConfig={makeConfig()}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    )
    stdin.write(ESC)
    await new Promise((r) => setTimeout(r, DELAY))
    expect(onCancel).toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('unchanged api_key skips validateApiKey and advances to model_select', async () => {
    const cfg = makeConfig()
    const { stdin, lastFrame } = render(
      <SetupWizard initialConfig={cfg} onComplete={() => {}} />
    )
    // Confirm → language → intro(api_key prefilled)
    stdin.write('y')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER) // language
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write(ENTER) // submit prefilled api_key unchanged
    await new Promise((r) => setTimeout(r, DELAY))

    expect(validateMock).not.toHaveBeenCalled()
    // Model-select step renders recommended models
    expect(lastFrame()).toMatch(/select model|选择默认模型|モデル/i)
  })
})
