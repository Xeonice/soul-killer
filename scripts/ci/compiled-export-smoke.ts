#!/usr/bin/env bun
/**
 * Smoke test for runtime-manifest-bundling.
 *
 * Runs the compiled soulkiller binary's hidden __runtime-manifest-check
 * subcommand and asserts:
 *   - RUNTIME_FILES is non-empty
 *   - Keys count matches the state/*.ts files on disk (minus manifest.ts)
 *   - At least 'mini-yaml.ts' and 'apply.ts' are present
 *   - mini-yaml.ts content is non-empty
 *
 * Catches regressions where packager.ts or its dependencies lose bundler
 * visibility of the state files (the bug this change was introduced to
 * prevent). Runs in CI after a linux-x64 build.
 */

import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..', '..')
// After `tar -xzf dist/soulkiller-<platform>.tar.gz -C dist/` the binary is
// named `soulkiller` regardless of platform. SOULKILLER_SMOKE_BIN overrides
// for local testing.
const BINARY = process.env.SOULKILLER_SMOKE_BIN ?? join(ROOT, 'dist', 'soulkiller')

async function main(): Promise<number> {
  const proc = Bun.spawn([BINARY, '__runtime-manifest-check'], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  if (exitCode !== 0) {
    console.error(`✗ binary exited ${exitCode}`)
    console.error(`stdout:\n${stdout}`)
    console.error(`stderr:\n${stderr}`)
    return 1
  }

  let payload: { count: number; keys: string[]; miniYamlLen: number; miniYamlFirstLine: string }
  try {
    payload = JSON.parse(stdout)
  } catch (err) {
    console.error(`✗ stdout is not JSON: ${String(err)}`)
    console.error(stdout)
    return 1
  }

  const stateFiles = readdirSync(join(ROOT, 'src', 'export', 'state'))
    .filter((f) => f.endsWith('.ts') && f !== 'manifest.ts')
    .sort()

  const errors: string[] = []
  if (payload.count === 0) errors.push('RUNTIME_FILES is empty — bundler missed state/*.ts imports')
  if (payload.count !== stateFiles.length) {
    errors.push(`count mismatch: binary=${payload.count}, on-disk=${stateFiles.length}`)
  }
  if (!payload.keys.includes('mini-yaml.ts')) errors.push('mini-yaml.ts missing from embedded manifest')
  if (!payload.keys.includes('apply.ts')) errors.push('apply.ts missing from embedded manifest')
  if (payload.miniYamlLen === 0) errors.push('mini-yaml.ts has zero length in embedded manifest')
  if (!payload.miniYamlFirstLine.includes('/**') && !payload.miniYamlFirstLine.includes('//')) {
    errors.push(`mini-yaml.ts first line looks wrong: ${JSON.stringify(payload.miniYamlFirstLine)}`)
  }

  if (errors.length > 0) {
    console.error('✗ compiled binary runtime manifest check failed:')
    for (const e of errors) console.error(`  - ${e}`)
    console.error('')
    console.error('payload:', JSON.stringify(payload, null, 2))
    return 1
  }

  console.log(`✓ compiled binary embeds ${payload.count} state files; mini-yaml.ts=${payload.miniYamlLen} bytes`)
  return 0
}

process.exit(await main())
