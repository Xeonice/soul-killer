import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { WorldBindCommand } from '../../src/cli/commands/world-bind.js'

vi.mock('../../src/world/binding.js', async () => {
  const actual = await vi.importActual('../../src/world/binding.js') as Record<string, unknown>
  return {
    ...actual,
    findSoulsBoundToWorld: vi.fn().mockReturnValue(['alice']),
    bindWorld: vi.fn(),
    unbindWorld: vi.fn(),
  }
})

vi.mock('../soul-resolver.js', () => ({
  listLocalSouls: vi.fn().mockReturnValue([
    { name: 'alice', description: 'Alice soul', chunkCount: 10 },
    { name: 'bob', description: 'Bob soul', chunkCount: 5 },
  ]),
  getSoulsDir: vi.fn().mockReturnValue('/tmp/test-souls'),
}))

// Need to mock at the correct path
vi.mock('../../src/cli/soul-resolver.js', () => ({
  listLocalSouls: vi.fn().mockReturnValue([
    { name: 'alice', description: 'Alice soul', chunkCount: 10 },
    { name: 'bob', description: 'Bob soul', chunkCount: 5 },
  ]),
  getSoulsDir: vi.fn().mockReturnValue('/tmp/test-souls'),
}))

describe('WorldBindCommand', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders checkbox list with bound souls checked', () => {
    const { lastFrame } = render(
      <WorldBindCommand worldName="night-city" onComplete={onComplete} />,
    )
    const output = lastFrame() ?? ''

    // Should show both souls
    expect(output).toContain('alice')
    expect(output).toContain('bob')

    // alice should be checked (☑), bob unchecked (☐)
    expect(output).toContain('☑')
    expect(output).toContain('☐')
  })

  it('renders title with world name', () => {
    const { lastFrame } = render(
      <WorldBindCommand worldName="night-city" onComplete={onComplete} />,
    )
    const output = lastFrame() ?? ''
    expect(output).toContain('night-city')
  })
})
