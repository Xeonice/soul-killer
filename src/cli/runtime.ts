/**
 * `soulkiller runtime <subcommand> [args...]`
 *
 * Cross-platform entry point for the skill state CLI. Spawns the compiled
 * binary itself (via process.execPath + BUN_BE_BUN=1) to execute the
 * external runtime/lib/main.ts shipped inside the skill archive.
 *
 * This avoids any shell wrapper dependency (bash/powershell) and works
 * identically on macOS, Linux, and Windows.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

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

  const mainTs = join(skillRoot, 'runtime', 'lib', 'main.ts')
  if (!existsSync(mainTs)) {
    process.stderr.write(`error: ${mainTs} not found\n`)
    return 1
  }

  // Spawn self to execute the external .ts file.
  // MUST use process.execPath (the absolute path to this binary), NOT
  // process.argv[0] which resolves to "bun" in compiled binaries and
  // would fail on Windows where system bun is not installed.
  const child = spawn(process.execPath, [mainTs, ...filteredArgs], {
    env: { ...process.env, BUN_BE_BUN: '1', SKILL_ROOT: skillRoot },
    stdio: 'inherit',
  })

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1))
  })
}
