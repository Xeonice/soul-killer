#!/usr/bin/env bun
import { render } from 'ink'
import React from 'react'
import { App } from './cli/app.js'
import { cleanupStaleOld, cleanupStaleSkillBackups } from './cli/cleanup.js'
import { runRuntime } from './cli/runtime.js'
import { runUpdate } from './cli/updater.js'
import { runDoctor } from './cli/doctor.js'
import { skillUpgrade } from './cli/skill-manager.js'
import { runSkillSubcommand } from './cli/skill-install/cli.js'
import { runCatalog } from './cli/catalog/cli.js'

cleanupStaleOld()
cleanupStaleSkillBackups()

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
  if (sub === 'upgrade') {
    const code = await skillUpgrade(args[2])
    process.exit(code)
  } else if (sub === 'catalog') {
    const code = await runCatalog(args.slice(2))
    process.exit(code)
  } else if (sub === 'install' || sub === 'list' || sub === 'update' || sub === 'uninstall' || sub === 'info') {
    const code = await runSkillSubcommand(sub, args.slice(2))
    process.exit(code)
  } else {
    console.log('Usage: soulkiller skill <subcommand> [args...]')
    console.log('  install <slug|url|path>       Download and install a skill')
    console.log('  list [--updates] [--json]     List installed skills + catalog diff')
    console.log('  update <slug>... | --all      Pull newer version from catalog')
    console.log('  uninstall <slug>              Remove an installed skill (with backup)')
    console.log('  info <slug>                   Show detailed info for a skill')
    console.log('  upgrade [--all|name]          Sync runtime/engine.md with this binary')
    console.log('  catalog [--json]              List available skills from the remote catalog')
    process.exit(sub ? 2 : 0)
  }
}

const { waitUntilExit } = render(<App />)
await waitUntilExit()
