import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { CommandPalette } from '../../../src/cli/components/command-palette.js'
import type { CommandDef } from '../../../src/cli/command-registry.js'

const SAMPLE_ITEMS: CommandDef[] = [
  { name: 'create', description: '交互式创建分身', group: '创建 & 数据' },
  { name: 'evolve', description: '导入数据并重新蒸馏分身', group: '创建 & 数据' },
  { name: 'status', description: '当前分身状态', group: '分身管理' },
  { name: 'help', description: '帮助', group: '其他' },
]

describe('CommandPalette', () => {
  it('renders all items with first selected', () => {
    const { lastFrame } = render(
      <CommandPalette items={SAMPLE_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('renders with third item selected', () => {
    const { lastFrame } = render(
      <CommandPalette items={SAMPLE_ITEMS} selectedIndex={2} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('❯')
    expect(frame).toContain('/status')
  })

  it('renders nothing for empty items', () => {
    const { lastFrame } = render(
      <CommandPalette items={[]} selectedIndex={0} />
    )
    expect(lastFrame()).toBe('')
  })

  it('renders filtered single item', () => {
    const filtered = [SAMPLE_ITEMS[0]!]
    const { lastFrame } = render(
      <CommandPalette items={filtered} selectedIndex={0} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('/create')
    expect(frame).not.toContain('/evolve')
  })

  it('shows scroll hint when items exceed maxVisible', () => {
    const manyItems: CommandDef[] = Array.from({ length: 15 }, (_, i) => ({
      name: `cmd${i}`,
      description: `Command ${i}`,
      group: 'test',
    }))
    const { lastFrame } = render(
      <CommandPalette items={manyItems} selectedIndex={0} maxVisible={8} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('15 commands')
    expect(frame).toContain('scroll')
  })

  it('contains COMMANDS title in magenta', () => {
    const { lastFrame } = render(
      <CommandPalette items={SAMPLE_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toContain('COMMANDS')
  })
})
