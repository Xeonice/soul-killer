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
import { runTree, runTreeStop } from './tree.js'
import { startProductionServer, AVAILABLE_VIEWS } from './viewer-server.js'
import { runScriptPlan, runScriptScene, runScriptEnding, runScriptBuild } from './script-builder.js'
import { runRoute } from './route.js'
import { runScripts } from './scripts.js'
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
  'scripts',
  'viewer',
  'tree',
  'script',
  'route',
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
      '  scripts                                        List all generated scripts (JSON)',
      '  viewer <view> <script-id>                      Start viewer server (views: tree)',
      '  tree <script-id>                               Start branch tree visualization server',
      '  tree --stop                                    Stop the visualization server',
      '  script plan <id>                               Validate + enrich plan.json',
      '  script scene <id> <scene-id>                   Validate + promote a scene draft',
      '  script ending <id> <ending-id>                 Validate + promote an ending draft',
      '  script build <id>                              Merge plan+scenes+endings into script.json',
      '  route <script-id> <gate-scene-id>               Evaluate affinity gate routing',
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
      // Invoked via `soulkiller runtime doctor`. If we land here the
      // soulkiller binary (with embedded bun) is working — trivially OK.
      process.stdout.write('STATUS: OK\n')
      process.stdout.write(`SOULKILLER_VERSION: ${process.env.SOULKILLER_VERSION ?? 'unknown'}\n`)
      process.stdout.write(`BUN_VERSION: ${process.versions.bun ?? 'unknown'}\n`)
      process.stdout.write(`PLATFORM: ${process.platform}-${process.arch}\n`)
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

    if (sub === 'scripts') {
      const result = runScripts(skillRoot)
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      return 0
    }

    if (sub === 'viewer') {
      const viewName = argv[1]
      const viewScriptId = argv[2]
      if (!viewName || !viewScriptId) {
        process.stderr.write(`usage: state viewer <view-name> <script-id>\navailable views: ${AVAILABLE_VIEWS.join(', ')}\n`)
        return 2
      }
      if (!AVAILABLE_VIEWS.includes(viewName)) {
        process.stderr.write(`error: unknown view "${viewName}"\navailable views: ${AVAILABLE_VIEWS.join(', ')}\n`)
        return 2
      }
      const result = await startProductionServer(skillRoot, viewName, viewScriptId)
      process.stdout.write(`VIEWER_URL ${result.url}\n`)
      process.stdout.write(`VIEWER_PID ${result.pid}\n`)
      return 0
    }

    if (sub === 'tree') {
      if (argv[1] === '--stop') {
        const result = runTreeStop(skillRoot)
        process.stdout.write(
          result.action === 'stopped' ? 'TREE_STOPPED\n' : 'TREE_NOT_RUNNING\n'
        )
        return 0
      }
      const scriptId = argv[1]
      if (scriptId === undefined) {
        process.stderr.write('usage: state tree <script-id>  or  state tree --stop\n')
        return 2
      }
      const result = await runTree(skillRoot, scriptId)
      process.stdout.write(`TREE_URL ${result.url}\n`)
      if (result.action === 'started') {
        process.stdout.write(`TREE_PID ${result.pid}\n`)
      }
      return 0
    }

    if (sub === 'route') {
      const scriptId = argv[1]
      const gateSceneId = argv[2]
      if (!scriptId || !gateSceneId) {
        process.stderr.write('usage: state route <script-id> <gate-scene-id>\n')
        return 2
      }
      const result = runRoute(skillRoot, scriptId, gateSceneId)
      if (!result.ok) {
        process.stderr.write(`error: ${result.error}\n`)
        return 1
      }
      process.stdout.write(`ROUTE ${result.routeId} → ${result.nextScene}\n`)
      return 0
    }

    if (sub === 'script') {
      const subSub = argv[1]
      const id = argv[2]

      if (subSub === 'plan') {
        if (!id) { process.stderr.write('usage: state script plan <id>\n'); return 2 }
        const result = runScriptPlan(skillRoot, id)
        if (!result.ok) { process.stderr.write(`error: ${result.error}\n`); return 1 }
        const lines = [
          'PLAN_OK',
          `  scenes: ${result.scenes}`,
          `  fields: ${result.fields}`,
          `  acts: ${result.acts}`,
          `  endings: ${result.endings}`,
          `  generation_order: ${result.generationOrder.join(',')}`,
          `  convergence_points: ${result.convergencePoints.join(',') || '(none)'}`,
        ]
        process.stdout.write(lines.join('\n') + '\n')
        return 0
      }

      if (subSub === 'scene') {
        const sceneId = argv[3]
        if (!id || !sceneId) { process.stderr.write('usage: state script scene <id> <scene-id>\n'); return 2 }
        const result = runScriptScene(skillRoot, id, sceneId)
        if (!result.ok) { process.stderr.write(`error: ${result.error}\n`); return 1 }
        process.stdout.write(`SCENE_OK ${result.sceneId} choices=${result.choices} keys=${result.consequenceKeys}\n`)
        return 0
      }

      if (subSub === 'ending') {
        const endingId = argv[3]
        if (!id || !endingId) { process.stderr.write('usage: state script ending <id> <ending-id>\n'); return 2 }
        const result = runScriptEnding(skillRoot, id, endingId)
        if (!result.ok) { process.stderr.write(`error: ${result.error}\n`); return 1 }
        process.stdout.write(`ENDING_OK ${result.endingId}\n`)
        return 0
      }

      if (subSub === 'build') {
        if (!id) { process.stderr.write('usage: state script build <id>\n'); return 2 }
        const result = runScriptBuild(skillRoot, id)
        if (!result.ok) { process.stderr.write(`error: ${result.error}\n`); return 1 }
        process.stdout.write(`BUILD_OK script-${result.scriptId}.json scenes=${result.scenes} endings=${result.endings} size=${Math.round(result.sizeBytes / 1024)}KB\n`)
        return 0
      }

      process.stderr.write('usage: state script <plan|scene|ending|build> ...\n')
      return 2
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
