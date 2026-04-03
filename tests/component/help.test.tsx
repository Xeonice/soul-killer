import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { HelpCommand } from '../../src/cli/commands/help.js'

describe('HelpCommand', () => {
  it('renders full help output', () => {
    const { lastFrame } = render(<HelpCommand />)
    expect(lastFrame()).toMatchSnapshot()
  })

  it('includes all command groups', () => {
    const { lastFrame } = render(<HelpCommand />)
    const output = lastFrame() ?? ''

    // Verify every command group title is present
    expect(output).toContain('创建 & 数据')
    expect(output).toContain('分身管理')
    expect(output).toContain('消费')
    expect(output).toContain('设置')
    expect(output).toContain('其他')
  })

  it('includes key commands', () => {
    const { lastFrame } = render(<HelpCommand />)
    const output = lastFrame() ?? ''

    expect(output).toContain('/create')
    expect(output).toContain('/evolve')
    expect(output).toContain('/status')
    expect(output).toContain('/list')
    expect(output).toContain('/use')
    expect(output).toContain('/config')
    expect(output).toContain('/help')
    expect(output).toContain('/exit')
  })
})
