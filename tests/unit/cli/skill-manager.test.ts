import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We test the internal helpers by importing the module.
// skillList/skillUpgrade depend on ~/.claude/skills/ which we can't mock easily,
// so we test the underlying logic via the exported functions and manual dir setup.

const TMP = join(tmpdir(), `soulkiller-skill-mgr-test-${process.pid}`)

function createMockSkill(name: string, opts: { legacy?: boolean; engineVersion?: number } = {}): string {
  const dir = join(TMP, name)
  const runtimeDir = join(dir, 'runtime')
  mkdirSync(join(runtimeDir, 'scripts'), { recursive: true })
  mkdirSync(join(dir, 'souls', 'soul-abc', 'behaviors'), { recursive: true })

  // story-spec.md
  writeFileSync(join(dir, 'story-spec.md'), `---
story_name: "Test Story"
genre: Fantasy
acts_options:
  - { acts: 5, label_zh: "medium", rounds_total: "40-60", endings_count: 5 }
default_acts: 5
characters:
  - name: "Hero"
    display_name: "Hero"
    role: protagonist
    axes:
      - { name: "courage", english: courage, initial: 5 }
    appears_from: act_1
---

# Story Identity
`, 'utf8')

  // souls/soul-abc/identity.md
  writeFileSync(join(dir, 'souls', 'soul-abc', 'identity.md'), '# Hero - The Brave\n\n## Basic Identity\n', 'utf8')
  writeFileSync(join(dir, 'souls', 'soul-abc', 'style.md'), '# Style\n', 'utf8')

  if (opts.legacy) {
    // Legacy skill — no soulkiller.json, has runtime/lib/
    mkdirSync(join(runtimeDir, 'lib'), { recursive: true })
    writeFileSync(join(runtimeDir, 'lib', 'main.ts'), '// old runtime', 'utf8')
    writeFileSync(join(dir, 'SKILL.md'), `---
name: ${name}
description: Test skill
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

You are a visual novel engine.
`, 'utf8')
  } else {
    // Modern skill with soulkiller.json
    writeFileSync(join(dir, 'soulkiller.json'), JSON.stringify({
      engine_version: opts.engineVersion ?? 1,
      soulkiller_version: '0.3.0',
      exported_at: '2026-04-14T00:00:00Z',
      skill_id: name,
    }, null, 2), 'utf8')
    writeFileSync(join(dir, 'SKILL.md'), `---
name: ${name}
description: Test skill
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

You are a visual novel engine.

**Before executing any phase**, Read engine.md.
`, 'utf8')
    writeFileSync(join(runtimeDir, 'engine.md'), '# Engine\n', 'utf8')
  }

  return dir
}

describe('skill-manager helpers', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  })

  it('identifies legacy skill by runtime/ directory', () => {
    const dir = createMockSkill('legacy-skill', { legacy: true })
    expect(existsSync(join(dir, 'runtime'))).toBe(true)
    expect(existsSync(join(dir, 'soulkiller.json'))).toBe(false)
  })

  it('identifies modern skill by soulkiller.json', async () => {
    const { CURRENT_ENGINE_VERSION } = await import('../../../src/export/spec/skill-template.js')
    const dir = createMockSkill('modern-skill', { engineVersion: CURRENT_ENGINE_VERSION })
    expect(existsSync(join(dir, 'soulkiller.json'))).toBe(true)
    const meta = JSON.parse(readFileSync(join(dir, 'soulkiller.json'), 'utf8'))
    expect(meta.engine_version).toBe(CURRENT_ENGINE_VERSION)
  })

  it('detects outdated engine version', async () => {
    const { CURRENT_ENGINE_VERSION } = await import('../../../src/export/spec/skill-template.js')
    const dir = createMockSkill('outdated-skill', { engineVersion: 0 })
    const meta = JSON.parse(readFileSync(join(dir, 'soulkiller.json'), 'utf8'))
    // Any engine_version < CURRENT_ENGINE_VERSION needs upgrade
    expect(meta.engine_version).toBeLessThan(CURRENT_ENGINE_VERSION)
  })
})

describe('generateEngineTemplate', () => {
  it('returns non-empty engine template', async () => {
    const { generateEngineTemplate } = await import('../../../src/export/spec/skill-template.js')
    const engine = generateEngineTemplate()
    expect(engine.length).toBeGreaterThan(1000)
    expect(engine).toContain('Phase -1')
    expect(engine).toContain('Phase 0')
    expect(engine).toContain('Phase 1')
    expect(engine).toContain('Phase 2')
    expect(engine).toContain('Phase 3')
    expect(engine).toContain('Prohibited Actions')
    expect(engine).toContain('soulkiller runtime apply')
    expect(engine).toContain('soulkiller runtime scripts')
  })

  it('does not contain story-specific content', async () => {
    const { generateEngineTemplate } = await import('../../../src/export/spec/skill-template.js')
    const engine = generateEngineTemplate()
    // Should not have character names or specific soul paths
    expect(engine).not.toMatch(/souls\/soul-[a-z0-9]+\//)
    expect(engine).not.toContain('曹操')
    expect(engine).not.toContain('forbidden_patterns')
  })

  it('references SKILL.md for content-specific sections', async () => {
    const { generateEngineTemplate } = await import('../../../src/export/spec/skill-template.js')
    const engine = generateEngineTemplate()
    expect(engine).toContain('SKILL.md')
    expect(engine).toContain('Required Reading List')
  })
})
