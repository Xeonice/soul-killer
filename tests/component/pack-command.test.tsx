import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { PackCommand } from '../../src/cli/commands/export/pack.js'

// Mock the packer module
vi.mock('../../src/pack/packer.js', () => ({
  packSoul: vi.fn().mockResolvedValue({ outputPath: '/tmp/test.soul.pack', size: 1024 }),
  packWorld: vi.fn().mockResolvedValue({ outputPath: '/tmp/test.world.pack', size: 512 }),
}))

function waitForFrame(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('PackCommand', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error when no args provided', async () => {
    const { lastFrame } = render(<PackCommand args="" onComplete={onComplete} />)
    await waitForFrame()
    const output = lastFrame() ?? ''
    expect(output).toContain('/pack')
  })

  it('shows error for invalid subcommand', async () => {
    const { lastFrame } = render(<PackCommand args="invalid test" onComplete={onComplete} />)
    await waitForFrame()
    const output = lastFrame() ?? ''
    expect(output).toContain('invalid')
  })

  it('shows packing state initially for valid args', () => {
    const { lastFrame } = render(<PackCommand args="soul alice" onComplete={onComplete} />)
    const output = lastFrame() ?? ''
    expect(output).toBeTruthy()
  })
})
