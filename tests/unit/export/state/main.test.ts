import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { runCli } from '../../../../src/export/state/main.js'
import { createFixture, type Fixture } from './helpers/state-fixture.js'

describe('runCli — CLI dispatcher', () => {
  let fixture: Fixture | null = null
  let stdoutBuf = ''
  let stderrBuf = ''
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutBuf = ''
    stderrBuf = ''
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutBuf += typeof chunk === 'string' ? chunk : chunk instanceof Buffer ? chunk.toString('utf8') : ''
      return true
    })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrBuf += typeof chunk === 'string' ? chunk : chunk instanceof Buffer ? chunk.toString('utf8') : ''
      return true
    })
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
    if (fixture) {
      fixture.cleanup()
      fixture = null
    }
    delete process.env.SKILL_ROOT
  })

  describe('--help and unknown subcommands', () => {
    it('prints help on --help with exit 0', async () => {
      const code = await runCli(['--help'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('state — Skill runtime state management CLI')
      expect(stdoutBuf).toContain('doctor')
      expect(stdoutBuf).toContain('init')
      expect(stdoutBuf).toContain('apply')
      expect(stdoutBuf).toContain('validate')
      expect(stdoutBuf).toContain('rebuild')
      expect(stdoutBuf).toContain('reset')
      expect(stdoutBuf).toContain('save')
      expect(stdoutBuf).toContain('list')
    })

    it('prints help on -h', async () => {
      const code = await runCli(['-h'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('Usage:')
    })

    it('prints help on no args', async () => {
      const code = await runCli([])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('Usage:')
    })

    it('help text does NOT contain get/set subcommands', async () => {
      await runCli(['--help'])
      // Literal subcommand descriptions must not appear
      expect(stdoutBuf).not.toMatch(/^\s{2}get\s+/m)
      expect(stdoutBuf).not.toMatch(/^\s{2}set\s+/m)
      // But the explanatory note about them intentionally NOT existing must appear
      expect(stdoutBuf).toContain('intentionally not provided')
    })

    it('rejects "set" subcommand with exit 2 + explicit error', async () => {
      const code = await runCli(['set', 'affinity.judy.trust', '10'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('unknown subcommand "set"')
      expect(stderrBuf).toContain('init/apply/reset/rebuild')
      expect(stderrBuf).toContain('no get/set')
    })

    it('rejects "get" subcommand with exit 2', async () => {
      const code = await runCli(['get', 'affinity.judy.trust'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('unknown subcommand "get"')
    })

    it('rejects any other unknown subcommand', async () => {
      const code = await runCli(['nuke', 'script-001'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('unknown subcommand "nuke"')
    })
  })

  describe('doctor (trivial case when bun is already running)', () => {
    it('returns STATUS: OK + BUN_VERSION', async () => {
      const code = await runCli(['doctor'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('STATUS: OK')
      expect(stdoutBuf).toMatch(/BUN_VERSION: /)
    })
  })

  describe('init', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['init'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state init')
    })

    it('runs init successfully and outputs INITIALIZED summary', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      const code = await runCli(['init', 'script-001'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('INITIALIZED')
      expect(stdoutBuf).toContain('script: script-001')
    })
  })

  describe('apply', () => {
    it('requires three args', async () => {
      const code = await runCli(['apply', 'script-001'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state apply')
    })

    it('outputs structured SCENE / CHANGES stdout on success', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      stderrBuf = ''
      const code = await runCli(['apply', 'script-001', 'scene-001', 'choice-1'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('SCENE  scene-001 → scene-002')
      expect(stdoutBuf).toContain('CHANGES')
      expect(stdoutBuf).toContain('affinity.judy.trust  3 → 5')
      expect(stdoutBuf).toContain('flags.met_johnny  false → true')
    })

    it('shows (clamped) marker when a value hits its range bound', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['apply', 'script-001', 'scene-001', 'choice-1'])
      expect(code).toBe(0)
    })

    it('returns error on unknown scene', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      stderrBuf = ''
      const code = await runCli(['apply', 'script-001', 'scene-999', 'choice-1'])
      expect(code).toBe(1)
      expect(stderrBuf).toContain('scene "scene-999" not found')
    })
  })

  describe('validate', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['validate'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state validate')
    })

    it('outputs JSON with ok: true on clean save', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['validate', 'script-001', '--continue'])
      expect(code).toBe(0)
      const parsed = JSON.parse(stdoutBuf)
      expect(parsed.ok).toBe(true)
      expect(parsed.errors).toEqual([])
    })

    it('exits 1 with structured errors on corrupted save', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      // Corrupt state.yaml by deleting a field
      const fs = await import('node:fs')
      const path = await import('node:path')
      const statePath = path.join(fixture.skillRoot, 'runtime/saves/script-001/auto/state.yaml')
      fs.writeFileSync(
        statePath,
        'current_scene: scene-001\nstate:\n  "affinity.judy.bond": 0\n  "flags.met_johnny": false\n  "custom.location": bar\n',
      )
      stdoutBuf = ''
      const code = await runCli(['validate', 'script-001', '--continue'])
      expect(code).toBe(1)
      const parsed = JSON.parse(stdoutBuf)
      expect(parsed.ok).toBe(false)
      expect(parsed.errors.some((e: { code: string }) => e.code === 'FIELD_MISSING')).toBe(true)
    })
  })

  describe('rebuild', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['rebuild'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state rebuild')
    })

    it('outputs REBUILT summary', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['rebuild', 'script-001'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('REBUILT')
      expect(stdoutBuf).toContain('script: script-001')
    })
  })

  describe('reset', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['reset'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state reset')
    })

    it('outputs RESET summary', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['reset', 'script-001'])
      expect(code).toBe(0)
      expect(stdoutBuf).toContain('RESET')
      expect(stdoutBuf).toContain('first_scene: scene-001')
    })
  })

  describe('save', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['save'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state save')
    })

    it('creates manual save from auto and outputs JSON', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['save', 'script-001'])
      expect(code).toBe(0)
      const parsed = JSON.parse(stdoutBuf)
      expect(parsed.ok).toBe(true)
      expect(parsed.scriptId).toBe('script-001')
      expect(typeof parsed.timestamp).toBe('string')
    })
  })

  describe('list', () => {
    it('requires <script-id> arg', async () => {
      const code = await runCli(['list'])
      expect(code).toBe(2)
      expect(stderrBuf).toContain('usage: state list')
    })

    it('lists saves for a script as JSON', async () => {
      fixture = createFixture()
      process.env.SKILL_ROOT = fixture.skillRoot
      await runCli(['init', 'script-001'])
      stdoutBuf = ''
      const code = await runCli(['list', 'script-001'])
      expect(code).toBe(0)
      const parsed = JSON.parse(stdoutBuf)
      expect(parsed.scriptId).toBe('script-001')
      expect(parsed.auto).not.toBeNull()
      expect(parsed.auto.currentScene).toBe('scene-001')
      expect(parsed.manual).toEqual([])
    })
  })
})
