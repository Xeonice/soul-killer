/**
 * `soulkiller runtime <subcommand> [args...]`
 *
 * Entry point for the skill state CLI. Directly invokes the built-in
 * runCli() with SKILL_ROOT set to the skill directory.
 *
 * Previously this spawned an external runtime/lib/main.ts from the skill
 * archive — but that meant the skill's bundled code could be out of date
 * relative to the binary. Since SKILL.md always calls `soulkiller runtime`,
 * the binary's own code should be authoritative.
 */

import { runCli } from '../export/state/main.js'

export async function runRuntime(args: string[]): Promise<number> {
  // Support --root <path> for manual / dev usage outside a skill context.
  let skillRoot: string | undefined
  const filteredArgs = [...args]
  const rootIdx = filteredArgs.indexOf('--root')
  if (rootIdx >= 0 && filteredArgs[rootIdx + 1]) {
    skillRoot = filteredArgs[rootIdx + 1]
    filteredArgs.splice(rootIdx, 2)
  }
  skillRoot ??= process.env.CLAUDE_SKILL_DIR

  if (!skillRoot) {
    process.stderr.write(
      'error: CLAUDE_SKILL_DIR not set (pass --root <path> for manual use)\n',
    )
    return 1
  }

  // Set SKILL_ROOT so runCli's resolveSkillRoot() picks it up
  process.env.SKILL_ROOT = skillRoot

  return runCli(filteredArgs)
}
