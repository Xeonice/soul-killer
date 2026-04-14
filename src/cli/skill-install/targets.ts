import path from 'node:path'
import { homedir } from 'node:os'

export type TargetId = 'claude-code' | 'codex' | 'opencode' | 'openclaw'
export type Scope = 'global' | 'project'

export const ALL_TARGET_IDS: TargetId[] = ['claude-code', 'codex', 'opencode', 'openclaw']

export interface TargetDefinition {
  id: TargetId
  display: string
  supportsProject: boolean
  /** Returns the directory that holds `<slug>/SKILL.md` entries. */
  resolveDir(scope: Scope, cwd?: string): string
}

export const TARGETS: Record<TargetId, TargetDefinition> = {
  'claude-code': {
    id: 'claude-code',
    display: 'Claude Code',
    supportsProject: true,
    resolveDir(scope, cwd = process.cwd()) {
      if (scope === 'project') return path.join(cwd, '.claude', 'skills')
      return path.join(homedir(), '.claude', 'skills')
    },
  },
  codex: {
    id: 'codex',
    display: 'Codex CLI',
    supportsProject: true,
    resolveDir(scope, cwd = process.cwd()) {
      if (scope === 'project') return path.join(cwd, '.agents', 'skills')
      return path.join(homedir(), '.agents', 'skills')
    },
  },
  opencode: {
    id: 'opencode',
    display: 'opencode',
    supportsProject: true,
    resolveDir(scope, cwd = process.cwd()) {
      if (scope === 'project') return path.join(cwd, '.opencode', 'skills')
      return path.join(homedir(), '.config', 'opencode', 'skills')
    },
  },
  openclaw: {
    id: 'openclaw',
    display: 'OpenClaw',
    supportsProject: false,
    resolveDir(scope) {
      if (scope === 'project') {
        throw new Error('openclaw does not support project scope')
      }
      return path.join(homedir(), '.openclaw', 'workspace', 'skills')
    },
  },
}

export function resolveTargetDir(id: TargetId, scope: Scope, cwd?: string): string {
  const def = TARGETS[id]
  if (!def) throw new Error(`unknown target: ${id}`)
  return def.resolveDir(scope, cwd)
}

/**
 * Project scope at $HOME resolves to the same dir as global — warn the caller.
 * Returns true if the caller should warn / confirm.
 */
export function isCwdHomeCollision(scope: Scope, cwd: string = process.cwd()): boolean {
  if (scope !== 'project') return false
  return path.resolve(cwd) === path.resolve(homedir())
}

export function parseTargetId(raw: string): TargetId {
  if ((ALL_TARGET_IDS as string[]).includes(raw)) return raw as TargetId
  throw new Error(
    `unknown target "${raw}". Valid: ${ALL_TARGET_IDS.join(', ')}`,
  )
}

export function parseScope(raw: string | undefined): Scope {
  if (!raw) return 'global'
  if (raw === 'global' || raw === 'project') return raw
  throw new Error(`unknown scope "${raw}". Valid: global, project`)
}
