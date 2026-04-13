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

const { waitUntilExit } = render(<App />)
await waitUntilExit()
