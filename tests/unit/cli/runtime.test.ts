import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRuntime } from '../../../src/cli/runtime.js'

const TMP = join(tmpdir(), `soulkiller-runtime-test-${process.pid}`)

function setupMockSkill(): string {
  const skillDir = join(TMP, 'mock-skill')
  const libDir = join(skillDir, 'runtime', 'lib')
  mkdirSync(libDir, { recursive: true })
  // Write a trivial main.ts that just prints help
  writeFileSync(
    join(libDir, 'main.ts'),
    'process.stdout.write("MOCK_MAIN_OK\\n"); process.exit(0)',
  )
  return skillDir
}

describe('runRuntime', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
    delete process.env.CLAUDE_SKILL_DIR
  })

  it('returns 1 when CLAUDE_SKILL_DIR is not set and no --root', async () => {
    delete process.env.CLAUDE_SKILL_DIR
    const code = await runRuntime(['doctor'])
    expect(code).toBe(1)
  })

  it('returns 1 when runtime/lib/main.ts is missing', async () => {
    const emptyDir = join(TMP, 'empty-skill')
    mkdirSync(emptyDir, { recursive: true })
    const code = await runRuntime(['--root', emptyDir, 'doctor'])
    expect(code).toBe(1)
  })

  it('--root overrides CLAUDE_SKILL_DIR', async () => {
    const skillDir = setupMockSkill()
    // Set CLAUDE_SKILL_DIR to a non-existent path
    process.env.CLAUDE_SKILL_DIR = '/nonexistent'
    const code = await runRuntime(['--root', skillDir, 'doctor'])
    // Should use --root path, not the env var
    expect(code).toBe(0)
  })

  it('uses CLAUDE_SKILL_DIR when --root is not provided', async () => {
    const skillDir = setupMockSkill()
    process.env.CLAUDE_SKILL_DIR = skillDir
    const code = await runRuntime(['doctor'])
    expect(code).toBe(0)
  })

  it('passes arguments through to main.ts', async () => {
    const skillDir = join(TMP, 'args-skill')
    const libDir = join(skillDir, 'runtime', 'lib')
    mkdirSync(libDir, { recursive: true })
    // main.ts that checks for specific args
    writeFileSync(
      join(libDir, 'main.ts'),
      `
      const args = process.argv.slice(2)
      if (args[0] === 'apply' && args[1] === 'test-script') {
        process.stdout.write('ARGS_OK\\n')
        process.exit(0)
      }
      process.exit(42)
      `,
    )
    const code = await runRuntime(['--root', skillDir, 'apply', 'test-script'])
    expect(code).toBe(0)
  })
})
