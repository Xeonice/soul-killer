#!/usr/bin/env bun
/**
 * state CLI entry point.
 *
 * Invocation (from skill runtime/bin/state bash wrapper):
 *   bun runtime/lib/main.ts <subcommand> [args...]
 *
 * The bash wrapper sets SKILL_ROOT environment variable pointing to the
 * directory containing runtime/. When run directly, SKILL_ROOT defaults to
 * two levels up from the script (runtime/lib/main.ts → skill root).
 */

import { dirname, resolve } from 'node:path'
import { runInit } from './init.js'
import { runApply } from './apply.js'
import { runValidate } from './validate.js'
import { runRebuild } from './rebuild.js'
import { runReset } from './reset.js'
import { runList } from './list.js'
import { runSave } from './save.js'
import type { ChangeEntry } from './schema.js'
import type { SaveType } from './io.js'

const SUBCOMMANDS = [
  'doctor',
  'init',
  'apply',
  'validate',
  'rebuild',
  'reset',
  'save',
  'list',
  '--help',
  '-h',
] as const

function printHelp(): void {
  process.stdout.write(
    [
      'state — Skill runtime state management CLI',
      '',
      'Usage:',
      '  state <subcommand> [args...]',
      '',
      'Subcommands:',
      '  doctor                                         Runtime health check',
      '  init <script-id>                               Initialize auto save from initial_state',
      '  apply <script-id> <scene> <choice>             Apply a choice consequences transaction',
      '  validate <script-id> [<save-type>] [--continue] Return JSON diagnostic (writes nothing)',
      '  rebuild <script-id> [<save-type>]              Repair state.yaml, preserving valid fields',
      '  reset <script-id> [<save-type>]                Wholesale reset to initial_state',
      '  save <script-id> [--overwrite <timestamp>]     Snapshot auto save to manual/',
      '  list <script-id>                               List all saves for a script (JSON)',
      '',
      'Save types: auto (default), manual:<timestamp>',
      '',
      'Note: `state get` and `state set` are intentionally not provided.',
      'Reads go through the host Read tool; writes must go through these semantic commands.',
      '',
    ].join('\n')
  )
}

function resolveSkillRoot(): string {
  const envRoot = process.env.SKILL_ROOT
  if (envRoot !== undefined && envRoot !== '') return envRoot
  // Fallback: walk up from this file (runtime/lib/main.ts → runtime → skill root)
  const here = dirname(new URL(import.meta.url).pathname)
  return resolve(here, '..', '..')
}

function serializeChange(c: ChangeEntry): string {
  const arrow = `${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`
  const suffix = c.clamped ? ' (clamped)' : ''
  return `  ${c.key}  ${arrow}${suffix}`
}

/**
 * Parse save-type from CLI arg: "auto" or "manual:<timestamp>".
 */
function parseSaveType(arg: string | undefined): SaveType {
  if (arg === undefined || arg === 'auto') return 'auto'
  if (arg.startsWith('manual:')) {
    return { manual: arg.slice('manual:'.length) }
  }
  // If it looks like a flag (--continue), default to auto
  if (arg.startsWith('--')) return 'auto'
  return 'auto'
}

export async function runCli(argv: string[]): Promise<number> {
  const sub = argv[0]
  if (sub === undefined || sub === '--help' || sub === '-h') {
    printHelp()
    return 0
  }
  if (!SUBCOMMANDS.includes(sub as (typeof SUBCOMMANDS)[number])) {
    process.stderr.write(
      `error: unknown subcommand "${sub}"\n` +
        `all writes must go through init/apply/reset/rebuild; no get/set.\n` +
        `run "state --help" for the full list.\n`
    )
    return 2
  }

  const skillRoot = resolveSkillRoot()

  try {
    if (sub === 'doctor') {
      // doctor is handled by the bash wrapper before main.ts is invoked.
      // If we land here, bun is already running — so doctor is trivially OK.
      process.stdout.write('STATUS: OK\n')
      process.stdout.write(`BUN_VERSION: ${process.versions.bun ?? 'unknown'}\n`)
      return 0
    }

    if (sub === 'init') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state init <script-id>\n')
        return 2
      }
      const result = runInit(skillRoot, scriptId)
      process.stdout.write(
        `INITIALIZED\n  script: ${result.scriptId}\n  first_scene: ${result.firstScene}\n  fields: ${result.fieldCount}\n`
      )
      return 0
    }

    if (sub === 'apply') {
      const scriptId = argv[1]
      const sceneId = argv[2]
      const choiceId = argv[3]
      if (scriptId === undefined || sceneId === undefined || choiceId === undefined) {
        process.stderr.write('usage: state apply <script-id> <scene-id> <choice-id>\n')
        return 2
      }
      const result = runApply(skillRoot, scriptId, sceneId, choiceId)
      const lines: string[] = [
        `SCENE  ${result.fromScene} → ${result.toScene}`,
        result.changes.length > 0 ? 'CHANGES' : 'CHANGES (none)',
      ]
      for (const c of result.changes) {
        lines.push(serializeChange(c))
      }
      process.stdout.write(lines.join('\n') + '\n')
      return 0
    }

    if (sub === 'validate') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state validate <script-id> [<save-type>] [--continue]\n')
        return 2
      }
      const saveType = parseSaveType(argv[2])
      const continueGame = argv.includes('--continue')
      const result = runValidate(skillRoot, scriptId, saveType, { continueGame })
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      return result.ok ? 0 : 1
    }

    if (sub === 'rebuild') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state rebuild <script-id> [<save-type>]\n')
        return 2
      }
      const saveType = parseSaveType(argv[2])
      const result = runRebuild(skillRoot, scriptId, saveType)
      process.stdout.write(
        `REBUILT\n` +
          `  script: ${result.scriptId}\n` +
          `  kept: ${result.keptFields.length}\n` +
          `  defaulted: ${result.defaultedFields.length}\n` +
          `  dropped: ${result.droppedFields.length}\n`
      )
      if (result.defaultedFields.length > 0) {
        process.stdout.write(
          `DEFAULTED_FIELDS\n${result.defaultedFields.map((k) => `  ${k}`).join('\n')}\n`
        )
      }
      return 0
    }

    if (sub === 'reset') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state reset <script-id> [<save-type>]\n')
        return 2
      }
      const saveType = parseSaveType(argv[2])
      const result = runReset(skillRoot, scriptId, saveType)
      process.stdout.write(
        `RESET\n  script: ${result.scriptId}\n  first_scene: ${result.firstScene}\n  fields: ${result.fieldCount}\n`
      )
      return 0
    }

    if (sub === 'save') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state save <script-id> [--overwrite <timestamp>]\n')
        return 2
      }
      const overwriteIdx = argv.indexOf('--overwrite')
      const overwrite = overwriteIdx >= 0 ? argv[overwriteIdx + 1] : undefined
      const result = runSave(skillRoot, scriptId, overwrite)
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      return result.ok ? 0 : 1
    }

    if (sub === 'list') {
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state list <script-id>\n')
        return 2
      }
      const result = runList(skillRoot, scriptId)
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      return 0
    }

    // Unreachable
    return 2
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`)
    return 1
  }
}

// Direct-execution entry (when invoked as `bun main.ts`).
if (import.meta.main) {
  const code = await runCli(process.argv.slice(2))
  process.exit(code)
}
