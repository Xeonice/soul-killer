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

if (args[0] === '__pack-fixture') {
  // Hidden smoke command for skill-binary-contract verification:
  //   soulkiller __pack-fixture <story-name> <soul-name> <world-name> <out-dir>
  // Drives packageSkill directly from the compiled binary so we can audit
  // the resulting .skill against the contract whitelist. NOT user-facing.
  const [, story, soul, world, outDir] = args
  if (!story || !soul || !world || !outDir) {
    console.error('usage: soulkiller __pack-fixture <story> <soul> <world> <out-dir>')
    process.exit(2)
  }
  const { packageSkill } = await import('./export/packager.js')
  // Minimal story_spec — the only contract-relevant axes are file presence,
  // not narrative content; defaults are fine for a smoke.
  const result = packageSkill({
    souls: [soul],
    world_name: world,
    story_name: story,
    output_base_dir: outDir,
    story_spec: {
      story_name: story,
      genre: 'unset',
      tone: 'unset',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 'short', rounds_total: '24-36', endings_count: 3 }],
      default_acts: 3,
      characters: [
        { name: soul, display_name: soul, role: 'protagonist', axes: [] },
      ],
      story_state: { shared_axes_custom: ['trust', 'openness'], flags: [] },
      prose_style: {
        target_language: 'zh',
        voice_anchor: 'smoke-test prose anchor with at least twenty characters',
        forbidden_patterns: [
          { id: 'p1', bad: 'a', good: 'b', reason: 'r' },
          { id: 'p2', bad: 'c', good: 'd', reason: 'r' },
          { id: 'p3', bad: 'e', good: 'f', reason: 'r' },
        ],
        ip_specific: ['rule one for ip', 'rule two for ip', 'rule three for ip'],
      },
      author_version: '0.0.0',
    },
  })
  console.log(JSON.stringify({ output_file: result.output_file, file_count: result.file_count }, null, 2))
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
