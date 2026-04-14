import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDoctor } from '../../../src/cli/doctor.js'

/**
 * Capture stdout/stderr written by a thunk. `runDoctor` writes directly to
 * process.stdout/stderr, so we stub their `write` methods for the test.
 */
async function capture(fn: () => Promise<number>): Promise<{
  stdout: string
  stderr: string
  code: number
}> {
  const outBufs: string[] = []
  const errBufs: string[] = []
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  process.stdout.write = ((chunk: string | Uint8Array) => {
    outBufs.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString())
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    errBufs.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString())
    return true
  }) as typeof process.stderr.write
  try {
    const code = await fn()
    return { stdout: outBufs.join(''), stderr: errBufs.join(''), code }
  } finally {
    process.stdout.write = origOut
    process.stderr.write = origErr
  }
}

const REQUIRED_LIB_FILES = [
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

function scaffoldSkill(root: string, opts: { omitSkillMd?: boolean; omitLibFiles?: string[] } = {}): void {
  if (!opts.omitSkillMd) {
    writeFileSync(join(root, 'SKILL.md'), '# skill\n')
  }
  const libDir = join(root, 'runtime', 'lib')
  mkdirSync(libDir, { recursive: true })
  const omit = new Set(opts.omitLibFiles ?? [])
  for (const f of REQUIRED_LIB_FILES) {
    if (omit.has(f)) continue
    writeFileSync(join(libDir, f), `// ${f}\n`)
  }
}

describe('runDoctor — binary self-check', () => {
  it('prints STATUS: OK + binary fields with exit 0', async () => {
    const { stdout, code } = await capture(() => runDoctor([]))
    expect(code).toBe(0)
    expect(stdout).toMatch(/^STATUS: OK\n/)
    expect(stdout).toContain('SOULKILLER_VERSION:')
    expect(stdout).toContain('BUN_VERSION:')
    expect(stdout).toMatch(/PLATFORM: \w+-\w+\n/)
  })

  it('every non-empty stdout line matches KEY: value protocol', async () => {
    const { stdout } = await capture(() => runDoctor([]))
    for (const line of stdout.split('\n')) {
      if (line === '') continue
      expect(line).toMatch(/^[A-Z][A-Z0-9_]*: .+$/)
    }
  })
})

describe('runDoctor — skill archive check', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'soulkiller-doctor-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('passes for a complete skill archive', async () => {
    scaffoldSkill(root)
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(0)
    expect(stdout).toMatch(/^STATUS: OK\n/)
    expect(stdout).toContain(`SKILL_PATH: ${root}\n`)
    expect(stdout).toContain('SKILL_MD: OK\n')
    expect(stdout).toContain('RUNTIME_LIB_MAIN: OK\n')
    expect(stdout).toContain(`RUNTIME_LIB_FILES: ${REQUIRED_LIB_FILES.length}/${REQUIRED_LIB_FILES.length}\n`)
  })

  it('fails when SKILL.md is missing', async () => {
    scaffoldSkill(root, { omitSkillMd: true })
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(1)
    expect(stdout).toMatch(/^STATUS: FAIL\n/)
    expect(stdout).toContain('SKILL_MD: MISSING\n')
    // When SKILL.md missing we bail — shouldn't see RUNTIME_LIB_MAIN line
    expect(stdout).not.toContain('RUNTIME_LIB_MAIN:')
  })

  it('fails when runtime/lib/main.ts is missing', async () => {
    scaffoldSkill(root, { omitLibFiles: ['main.ts'] })
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(1)
    expect(stdout).toMatch(/^STATUS: FAIL\n/)
    expect(stdout).toContain('RUNTIME_LIB_MAIN: MISSING\n')
  })

  it('fails when runtime/lib is missing other baseline files', async () => {
    scaffoldSkill(root, { omitLibFiles: ['apply.ts', 'validate.ts'] })
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(1)
    expect(stdout).toMatch(/^STATUS: FAIL\n/)
    const expected = REQUIRED_LIB_FILES.length - 2
    expect(stdout).toContain(`RUNTIME_LIB_FILES: ${expected}/${REQUIRED_LIB_FILES.length}\n`)
  })

  it('reports runtime/scripts count when present', async () => {
    scaffoldSkill(root)
    const scriptsDir = join(root, 'runtime', 'scripts')
    mkdirSync(scriptsDir, { recursive: true })
    writeFileSync(join(scriptsDir, 'script-abc.json'), '{}')
    writeFileSync(join(scriptsDir, 'script-def.json'), '{}')
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(0)
    expect(stdout).toContain('RUNTIME_SCRIPTS_DIR: OK (2 scripts)\n')
  })

  it('rejects a non-skill directory', async () => {
    // root is a fresh empty tmp dir — no SKILL.md, no runtime/
    const { stdout, code } = await capture(() => runDoctor([root]))
    expect(code).toBe(1)
    expect(stdout).toMatch(/^STATUS: FAIL\n/)
    expect(stdout).toContain(`SKILL_PATH: ${root}\n`)
    expect(stdout).toContain('SKILL_MD: MISSING\n')
    // No heuristic guessing — should not attempt runtime checks either
    expect(stdout).not.toContain('RUNTIME_LIB_MAIN:')
  })
})
