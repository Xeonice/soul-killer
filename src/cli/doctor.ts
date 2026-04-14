/**
 * `soulkiller doctor [path]`
 *
 * Top-level diagnostic command. Two modes:
 *
 *   1. Binary self-check (no path argument)
 *      Prints STATUS / SOULKILLER_VERSION / BUN_VERSION / PLATFORM to stdout.
 *      Exit 0 when running at all (if this executes, the binary works).
 *
 *   2. Skill archive check (`soulkiller doctor <path>`)
 *      In addition to the binary self-check, validates the structure of an
 *      extracted skill directory at <path>:
 *        - SKILL.md exists
 *        - runtime/lib/main.ts exists
 *        - every required runtime/lib/*.ts file exists
 *        - runtime/scripts/ script count (optional)
 *      Emits STATUS: FAIL + exit 1 on any missing required file. No heuristic
 *      guessing — if <path>/SKILL.md is missing we flag it and stop.
 *
 * Output protocol: one `KEY: value` pair per line on stdout (keys in UPPER_SNAKE).
 * Diagnostic errors go to stderr; info/warnings never write stderr.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Required runtime/lib/*.ts files — kept in sync with the state CLI baseline
 * packaged by `src/export/packager.ts`. If this list drifts, packager-runtime
 * tests will catch it first.
 */
const REQUIRED_RUNTIME_LIB_FILES = [
  'main.ts',
  'schema.ts',
  'io.ts',
  'mini-yaml.ts',
  'script.ts',
  'init.ts',
  'apply.ts',
  'validate.ts',
  'rebuild.ts',
  'reset.ts',
  'save.ts',
  'list.ts',
  'history.ts',
  'tree.ts',
  'tree-server.ts',
  'tree-html.ts',
  'script-builder.ts',
  'route.ts',
]

interface DoctorLine {
  key: string
  value: string
}

function binarySelfCheck(): DoctorLine[] {
  return [
    { key: 'SOULKILLER_VERSION', value: process.env.SOULKILLER_VERSION ?? 'unknown' },
    { key: 'BUN_VERSION', value: process.versions.bun ?? 'unknown' },
    { key: 'PLATFORM', value: `${process.platform}-${process.arch}` },
  ]
}

interface SkillCheck {
  lines: DoctorLine[]
  failed: boolean
}

function skillArchiveCheck(skillPath: string): SkillCheck {
  const lines: DoctorLine[] = [{ key: 'SKILL_PATH', value: skillPath }]
  let failed = false

  // 1. SKILL.md — if missing, we bail early without further heuristics
  const skillMdPath = join(skillPath, 'SKILL.md')
  if (!existsSync(skillMdPath)) {
    lines.push({ key: 'SKILL_MD', value: 'MISSING' })
    return { lines, failed: true }
  }
  lines.push({ key: 'SKILL_MD', value: 'OK' })

  // 2. runtime/lib/main.ts
  const mainPath = join(skillPath, 'runtime', 'lib', 'main.ts')
  if (!existsSync(mainPath)) {
    lines.push({ key: 'RUNTIME_LIB_MAIN', value: 'MISSING' })
    failed = true
  } else {
    lines.push({ key: 'RUNTIME_LIB_MAIN', value: 'OK' })
  }

  // 3. runtime/lib/*.ts baseline completeness
  const libDir = join(skillPath, 'runtime', 'lib')
  const found: string[] = existsSync(libDir)
    ? readdirSync(libDir).filter((f) => f.endsWith('.ts'))
    : []
  const foundSet = new Set(found)
  const missing = REQUIRED_RUNTIME_LIB_FILES.filter((f) => !foundSet.has(f))
  const presentCount = REQUIRED_RUNTIME_LIB_FILES.length - missing.length
  lines.push({
    key: 'RUNTIME_LIB_FILES',
    value: `${presentCount}/${REQUIRED_RUNTIME_LIB_FILES.length}`,
  })
  if (missing.length > 0) failed = true

  // 4. runtime/scripts/ — optional, informational only
  const scriptsDir = join(skillPath, 'runtime', 'scripts')
  if (existsSync(scriptsDir) && statSync(scriptsDir).isDirectory()) {
    const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith('.json'))
    lines.push({ key: 'RUNTIME_SCRIPTS_DIR', value: `OK (${scripts.length} scripts)` })
  }

  return { lines, failed }
}

export async function runDoctor(argv: string[]): Promise<number> {
  const lines: DoctorLine[] = []
  let failed = false

  // Skill archive check comes before binary self-check output ordering-wise
  // because callers scanning stdout find the more specific context earlier.
  // But by spec we lead with STATUS — so we collect everything, then emit.
  const skillPath = argv[0]
  if (skillPath !== undefined && skillPath !== '') {
    const skill = skillArchiveCheck(skillPath)
    lines.push(...skill.lines)
    if (skill.failed) failed = true
  }

  // Binary self-check always included
  const binaryLines = binarySelfCheck()

  // Emit STATUS first, then binary info, then skill details
  process.stdout.write(`STATUS: ${failed ? 'FAIL' : 'OK'}\n`)
  for (const line of binaryLines) process.stdout.write(`${line.key}: ${line.value}\n`)
  for (const line of lines) process.stdout.write(`${line.key}: ${line.value}\n`)

  return failed ? 1 : 0
}
