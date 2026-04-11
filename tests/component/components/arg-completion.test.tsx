import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { CommandPalette } from '../../../src/cli/components/command-palette.js'
import type { CommandDef } from '../../../src/cli/command-registry.js'

const SOUL_ITEMS: CommandDef[] = [
  { name: '强尼银手', description: '4,777 chunks', group: 'souls' },
  { name: 'douglastang', description: '前端工程师', group: 'souls' },
  { name: 'test-soul', description: '50 chunks', group: 'souls' },
]

describe('CommandPalette with custom title (soul completion)', () => {
  it('renders with SOULS title instead of COMMANDS', () => {
    const { lastFrame } = render(
      <CommandPalette items={SOUL_ITEMS} selectedIndex={0} title="SOULS" showSlash={false} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('SOULS')
    expect(frame).not.toContain('COMMANDS')
  })

  it('renders soul names without / prefix', () => {
    const { lastFrame } = render(
      <CommandPalette items={SOUL_ITEMS} selectedIndex={0} title="SOULS" showSlash={false} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('强尼银手')
    expect(frame).toContain('douglastang')
    expect(frame).not.toContain('/强尼银手')
    expect(frame).not.toContain('/douglastang')
  })

  it('shows description alongside soul name', () => {
    const { lastFrame } = render(
      <CommandPalette items={SOUL_ITEMS} selectedIndex={1} title="SOULS" showSlash={false} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('前端工程师')
    expect(frame).toContain('4,777 chunks')
  })

  it('highlights selected soul with ❯', () => {
    const { lastFrame } = render(
      <CommandPalette items={SOUL_ITEMS} selectedIndex={2} title="SOULS" showSlash={false} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('❯')
    // test-soul should be near the ❯
    const lines = frame.split('\n')
    const selectedLine = lines.find((l) => l.includes('❯'))
    expect(selectedLine).toContain('test-soul')
  })

  it('renders nothing for empty soul list', () => {
    const { lastFrame } = render(
      <CommandPalette items={[]} selectedIndex={0} title="SOULS" showSlash={false} />
    )
    expect(lastFrame()).toBe('')
  })

  it('snapshot: full soul list with first selected', () => {
    const { lastFrame } = render(
      <CommandPalette items={SOUL_ITEMS} selectedIndex={0} title="SOULS" showSlash={false} />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('snapshot: filtered single soul', () => {
    const filtered = SOUL_ITEMS.filter((s) => s.name.startsWith('强'))
    const { lastFrame } = render(
      <CommandPalette items={filtered} selectedIndex={0} title="SOULS" showSlash={false} />
    )
    expect(lastFrame()).toMatchSnapshot()
  })
})

describe('CommandPalette preserves default behavior', () => {
  const CMD_ITEMS: CommandDef[] = [
    { name: 'create', description: '创建分身', group: '创建' },
    { name: 'help', description: '帮助', group: '其他' },
  ]

  it('default title is COMMANDS', () => {
    const { lastFrame } = render(
      <CommandPalette items={CMD_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toContain('COMMANDS')
  })

  it('default shows / prefix on command names', () => {
    const { lastFrame } = render(
      <CommandPalette items={CMD_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toContain('/create')
    expect(lastFrame()).toContain('/help')
  })
})
