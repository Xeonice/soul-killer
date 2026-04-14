#!/usr/bin/env bun
import { render } from 'ink'
import React from 'react'
import { existsSync, realpathSync, unlinkSync } from 'node:fs'
import { App } from './cli/app.js'
import { runRuntime } from './cli/runtime.js'
import { runUpdate } from './cli/updater.js'
import { runDoctor } from './cli/doctor.js'
import { skillList, skillUpgrade } from './cli/skill-manager.js'

/**
 * Remove any stale `<exe>.old` left behind by a previous Windows self-update.
 * On Windows the update path renames the running exe to `<exe>.old` before
 * writing the new binary — cleanup is deferred to the next cold start because
 * the just-updated process may still hold a lock at update completion time.
 * Runs silently; any failure (permission, still-locked, non-existent) is
 * swallowed and retried on the next start.
 */
export function cleanupStaleOld(): void {
  try {
    const target = (() => {
      try { return realpathSync(process.execPath) } catch { return process.execPath }
    })()
    const staleOld = target + '.old'
    if (existsSync(staleOld)) unlinkSync(staleOld)
  } catch { /* silent */ }
}

cleanupStaleOld()

// Pre-ink flag handling — intercept before React renders
const args = process.argv.slice(2)

if (args.includes('--version') || args.includes('-v')) {
  const version = process.env.SOULKILLER_VERSION ?? 'dev'
  console.log(`soulkiller ${version}`)
  process.exit(0)
}

if (args.includes('--update')) {
  await runUpdate()
  process.exit(0)
}

if (args[0] === 'runtime') {
  const code = await runRuntime(args.slice(1))
  process.exit(code)
}

if (args[0] === 'doctor') {
  const code = await runDoctor(args.slice(1))
  process.exit(code)
}

if (args[0] === 'skill') {
  const sub = args[1]
  if (sub === 'list') {
    process.exit(skillList())
  } else if (sub === 'upgrade') {
    const code = await skillUpgrade(args[2])
    process.exit(code)
  } else {
    console.log('Usage: soulkiller skill <list|upgrade>')
    console.log('  list                  List installed soulkiller skills')
    console.log('  upgrade [--all|name]  Upgrade skill engine')
    process.exit(sub ? 2 : 0)
  }
}

const { waitUntilExit } = render(<App />)
await waitUntilExit()
