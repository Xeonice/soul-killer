import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ConfigCommand } from '../../../../src/cli/commands/system/config.js'
import { setLocale } from '../../../../src/infra/i18n/index.js'
import { AGENT_LOG_DIR } from '../../../../src/infra/utils/agent-logger.js'

const mockConfig = {
  llm: {
    provider: 'openrouter' as const,
    api_key: 'sk-test-1234567890abcdef',
    default_model: 'google/gemini-2.5-flash',
  },
  language: 'zh' as const,
  animation: true,
}

vi.mock('../../../../src/config/loader.js', () => ({
  loadConfig: () => ({ ...mockConfig, llm: { ...mockConfig.llm } }),
  saveConfig: vi.fn(),
}))

describe('ConfigCommand', () => {
  it('renders interactive menu with all config items', () => {
    setLocale('zh')
    const { lastFrame } = render(<ConfigCommand onClose={() => {}} />)
    const output = lastFrame() ?? ''
    expect(output).toContain('gemini-2.5-flash')
    expect(output).toContain('sk-t')
    expect(output).toContain('cdef')
    expect(output).toContain('zh')
    expect(output).toContain('ON')
    // Should NOT contain full api key
    expect(output).not.toContain('sk-test-1234567890abcdef')
  })

  it('shows navigation hints', () => {
    setLocale('zh')
    const { lastFrame } = render(<ConfigCommand onClose={() => {}} />)
    const output = lastFrame() ?? ''
    expect(output).toContain('ESC')
  })

  it('highlights first item by default', () => {
    setLocale('zh')
    const { lastFrame } = render(<ConfigCommand onClose={() => {}} />)
    const output = lastFrame() ?? ''
    expect(output).toContain('❯')
  })

  it('shows Clean Agent Logs menu item', () => {
    setLocale('zh')
    const { lastFrame } = render(<ConfigCommand onClose={() => {}} />)
    const output = lastFrame() ?? ''
    expect(output).toContain('清理日志')
  })

  it('shows Clean Agent Logs in English', () => {
    setLocale('en')
    const { lastFrame } = render(<ConfigCommand onClose={() => {}} />)
    const output = lastFrame() ?? ''
    expect(output).toContain('Clean Logs')
  })
})
