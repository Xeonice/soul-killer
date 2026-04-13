import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRuntime } from '../../../src/cli/runtime.js'
import { createFixture } from '../export/state/helpers/state-fixture.js'

const TMP = join(tmpdir(), `soulkiller-runtime-test-${process.pid}`)

describe('runRuntime', () => {
  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
    delete process.env.CLAUDE_SKILL_DIR
    delete process.env.SKILL_ROOT
  })

  it('returns 1 when CLAUDE_SKILL_DIR is not set and no --root', async () => {
    delete process.env.CLAUDE_SKILL_DIR
    const code = await runRuntime(['doctor'])
    expect(code).toBe(1)
  })

  it('--root sets SKILL_ROOT for runCli', async () => {
    const fixture = createFixture()
    try {
      const code = await runRuntime(['--root', fixture.skillRoot, 'doctor'])
      expect(code).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it('uses CLAUDE_SKILL_DIR when --root is not provided', async () => {
    const fixture = createFixture()
    try {
      process.env.CLAUDE_SKILL_DIR = fixture.skillRoot
      const code = await runRuntime(['doctor'])
      expect(code).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it('--root overrides CLAUDE_SKILL_DIR', async () => {
    const fixture = createFixture()
    try {
      process.env.CLAUDE_SKILL_DIR = '/nonexistent'
      const code = await runRuntime(['--root', fixture.skillRoot, 'doctor'])
      expect(code).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it('passes subcommand and args to runCli', async () => {
    const fixture = createFixture()
    try {
      const code = await runRuntime(['--root', fixture.skillRoot, 'scripts'])
      expect(code).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })
})
