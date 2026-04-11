import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { PathPalette } from '../../../src/cli/components/path-palette.js'
import type { PathItem } from '../../../src/cli/path-resolver.js'

const SAMPLE_ITEMS: PathItem[] = [
  { name: 'notes', fullPath: '/home/user/notes', isDirectory: true },
  { name: 'docs', fullPath: '/home/user/docs', isDirectory: true },
  { name: 'README.md', fullPath: '/home/user/README.md', isDirectory: false },
  { name: 'package.json', fullPath: '/home/user/package.json', isDirectory: false },
]

describe('PathPalette', () => {
  it('renders items with first selected', () => {
    const { lastFrame } = render(
      <PathPalette items={SAMPLE_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toMatchSnapshot()
  })

  it('shows directory with / suffix and file without', () => {
    const { lastFrame } = render(
      <PathPalette items={SAMPLE_ITEMS} selectedIndex={0} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('notes/')
    expect(frame).toContain('README.md')
    expect(frame).not.toContain('README.md/')
  })

  it('renders nothing for empty items', () => {
    const { lastFrame } = render(
      <PathPalette items={[]} selectedIndex={0} />
    )
    expect(lastFrame()).toBe('')
  })

  it('renders with third item selected', () => {
    const { lastFrame } = render(
      <PathPalette items={SAMPLE_ITEMS} selectedIndex={2} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('❯')
    expect(frame).toContain('README.md')
  })

  it('contains PATH title', () => {
    const { lastFrame } = render(
      <PathPalette items={SAMPLE_ITEMS} selectedIndex={0} />
    )
    expect(lastFrame()).toContain('PATH')
  })

  it('shows scroll hint for many items', () => {
    const manyItems: PathItem[] = Array.from({ length: 15 }, (_, i) => ({
      name: `file${i}.txt`,
      fullPath: `/tmp/file${i}.txt`,
      isDirectory: false,
    }))
    const { lastFrame } = render(
      <PathPalette items={manyItems} selectedIndex={0} maxVisible={8} />
    )
    expect(lastFrame()).toContain('15 entries')
  })
})
