import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { homedir } from 'node:os'
import {
  resolveTargetDir,
  isCwdHomeCollision,
  parseTargetId,
  parseScope,
  ALL_TARGET_IDS,
  TARGETS,
} from '../../../../src/cli/skill-install/targets.js'

// homedir() resolves from $HOME on Unix (and falls back to /etc/passwd);
// on macOS/Linux CI the env override is reliable. For assertions we read
// the real homedir at setup time rather than trying to mock it, since
// os.homedir is non-configurable in bun and vitest can't spy on it.
const FAKE_HOME = homedir()

beforeEach(() => {})
afterEach(() => {})

describe('resolveTargetDir — global', () => {
  it('claude-code', () => {
    expect(resolveTargetDir('claude-code', 'global')).toBe(path.join(FAKE_HOME, '.claude', 'skills'))
  })
  it('codex', () => {
    expect(resolveTargetDir('codex', 'global')).toBe(path.join(FAKE_HOME, '.agents', 'skills'))
  })
  it('opencode', () => {
    expect(resolveTargetDir('opencode', 'global')).toBe(path.join(FAKE_HOME, '.config', 'opencode', 'skills'))
  })
  it('openclaw', () => {
    expect(resolveTargetDir('openclaw', 'global')).toBe(path.join(FAKE_HOME, '.openclaw', 'workspace', 'skills'))
  })
})

describe('resolveTargetDir — project', () => {
  it('claude-code uses cwd', () => {
    expect(resolveTargetDir('claude-code', 'project', '/work/proj')).toBe('/work/proj/.claude/skills')
  })
  it('codex uses cwd', () => {
    expect(resolveTargetDir('codex', 'project', '/work/proj')).toBe('/work/proj/.agents/skills')
  })
  it('opencode uses cwd', () => {
    expect(resolveTargetDir('opencode', 'project', '/work/proj')).toBe('/work/proj/.opencode/skills')
  })
  it('openclaw rejects project scope', () => {
    expect(() => resolveTargetDir('openclaw', 'project')).toThrow(/does not support project scope/)
  })
})

describe('isCwdHomeCollision', () => {
  it('true when project + cwd == home', () => {
    expect(isCwdHomeCollision('project', FAKE_HOME)).toBe(true)
  })
  it('false for global scope', () => {
    expect(isCwdHomeCollision('global', FAKE_HOME)).toBe(false)
  })
  it('false for non-home cwd', () => {
    expect(isCwdHomeCollision('project', '/work/proj')).toBe(false)
  })
})

describe('parsing', () => {
  it('parseTargetId accepts valid', () => {
    for (const id of ALL_TARGET_IDS) expect(parseTargetId(id)).toBe(id)
  })
  it('parseTargetId rejects unknown', () => {
    expect(() => parseTargetId('cursor')).toThrow(/unknown target/)
  })
  it('parseScope defaults to global when undefined', () => {
    expect(parseScope(undefined)).toBe('global')
  })
  it('parseScope rejects unknown', () => {
    expect(() => parseScope('user')).toThrow(/unknown scope/)
  })
})

describe('TARGETS metadata', () => {
  it('openclaw.supportsProject === false', () => {
    expect(TARGETS.openclaw.supportsProject).toBe(false)
  })
  it('everyone else supportsProject === true', () => {
    for (const id of ['claude-code', 'codex', 'opencode'] as const) {
      expect(TARGETS[id].supportsProject).toBe(true)
    }
  })
})
