#!/usr/bin/env bun
import { render } from 'ink'
import React from 'react'
import { App } from './cli/app.js'

// Pre-ink flag handling — intercept before React renders
const args = process.argv.slice(2)

if (args.includes('--version') || args.includes('-v')) {
  const version = process.env.SOULKILLER_VERSION ?? 'dev'
  console.log(`soulkiller ${version}`)
  process.exit(0)
}

if (args.includes('--update')) {
  const { runUpdate } = await import('./cli/updater.js')
  await runUpdate()
  process.exit(0)
}

if (args[0] === 'runtime') {
  const { runRuntime } = await import('./cli/runtime.js')
  const code = await runRuntime(args.slice(1))
  process.exit(code)
}

if (args[0] === 'skill') {
  const { skillList, skillUpgrade } = await import('./cli/skill-manager.js')
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
