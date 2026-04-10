import { describe, it, expect } from 'vitest'
import {
  lintSkillTemplate,
  lintStorySpec,
  lintCharacterAxesConsistency,
} from '../../src/export/support/lint-index.js'

describe('lintSkillTemplate — yaml block parsing', () => {
  it('passes a clean SKILL.md with valid yaml example', () => {
    // Realistic skeleton includes the state CLI markers so that the runtime
    // CLI rules (PHASE_0_DOCTOR_PRESENT / STATE_APPLY_PRESENT) don't fire.
    const skill = `---
name: test
---

# Phase -1

bash \${CLAUDE_SKILL_DIR}/runtime/bin/state doctor

# Phase 1

\`\`\`yaml
state_schema:
  "affinity.judy.trust":
    desc: "trust"
    type: int
    range: [0, 10]
    default: 5
\`\`\`

# Phase 2

bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply slot-1 scene-001 choice-1
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('flags a value-without-key line in a yaml example', () => {
    const skill = `# Phase 1

\`\`\`yaml
state_schema:
  : missing key here
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.rule === 'YAML_PARSE')).toBe(true)
  })

  it('non-yaml fenced blocks are ignored by the yaml rules', () => {
    const skill = `\`\`\`bash
echo "hello"
: not yaml
\`\`\`
`
    const r = lintSkillTemplate(skill)
    // Other scan-level rules (doctor/apply presence) may fire on this
    // minimal fixture, but YAML_PARSE must not.
    expect(r.errors.filter((e) => e.rule === 'YAML_PARSE')).toHaveLength(0)
  })
})

describe('lintSkillTemplate — schema key naming', () => {
  it('accepts canonical snake_case + dot keys', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.trust":
    type: int
  "flags.met_johnny":
    type: bool
  "custom.relic_corruption":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.errors.filter((e) => e.rule === 'SCHEMA_KEY_NAMING')).toHaveLength(0)
  })

  it('rejects camelCase keys', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.Judy.Trust":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    const naming = r.errors.find((e) => e.rule === 'SCHEMA_KEY_NAMING')
    expect(naming).toBeDefined()
    expect(naming!.message).toContain('Judy')
  })

  it('rejects keys containing non-ASCII characters', () => {
    const skill = `\`\`\`yaml
state_schema:
  "亲密度.judy.信任":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.rule === 'SCHEMA_KEY_NAMING')).toBe(true)
  })

  it('accepts angle-bracket placeholder keys (template prompts use them)', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.<character>.<axis>":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.errors.filter((e) => e.rule === 'SCHEMA_KEY_NAMING')).toHaveLength(0)
  })

  it('rejects keys with spaces', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity judy trust":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.rule === 'SCHEMA_KEY_NAMING')).toBe(true)
  })
})

describe('lintSkillTemplate — multiple yaml blocks', () => {
  it('checks every fenced yaml block, not just the first', () => {
    const skill = `# Block 1

\`\`\`yaml
state_schema:
  "affinity.a.b":
    type: int
\`\`\`

# Block 2 — has the bug

\`\`\`yaml
state_schema:
  "affinity.BAD.Trust":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThanOrEqual(1)
  })
})

describe('lintCharacterAxesConsistency', () => {
  it('passes when every story-spec axis appears in at least one SKILL.md schema example', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.trust":
    type: int
  "affinity.johnny.bond":
    type: int
\`\`\`
`
    const storySpec = `
characters:
  - name: judy
    axes:
      - { name: "信任", english: trust, initial: 5 }
  - name: johnny
    axes:
      - { name: "羁绊", english: bond, initial: 5 }
`
    const r = lintCharacterAxesConsistency(skill, storySpec)
    expect(r.ok).toBe(true)
  })

  it('flags an axis declared in story-spec but missing from SKILL.md examples', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.trust":
    type: int
\`\`\`
`
    const storySpec = `
characters:
  - name: judy
    axes:
      - { name: "信任", english: trust, initial: 5 }
      - { name: "亲密", english: attraction, initial: 3 }
`
    const r = lintCharacterAxesConsistency(skill, storySpec)
    expect(r.ok).toBe(false)
    const axisErr = r.errors.find((e) => e.rule === 'AXIS_CROSS_REF')
    expect(axisErr).toBeDefined()
    expect(axisErr!.message).toContain('attraction')
  })

  it('passes when story-spec has no characters (single-character mode)', () => {
    const skill = `\`\`\`yaml
state_schema:
  "axes.trust":
    type: int
\`\`\`
`
    const storySpec = `# no characters block at all`
    const r = lintCharacterAxesConsistency(skill, storySpec)
    expect(r.ok).toBe(true)
  })
})

describe('lintStorySpec passthrough', () => {
  it('runs the same checks on story-spec content', () => {
    const storySpec = `\`\`\`yaml
: bad value with no key
\`\`\`
`
    const r = lintStorySpec(storySpec)
    expect(r.ok).toBe(false)
  })
})

describe('SHARED_AXES_COMPLETENESS', () => {
  it('passes when every character has bond + 2 shared axes', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.bond":
    type: int
  "affinity.judy.trust":
    type: int
  "affinity.judy.resolve":
    type: int
  "affinity.panam.bond":
    type: int
  "affinity.panam.trust":
    type: int
  "affinity.panam.resolve":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.errors.filter((e) => e.rule === 'SHARED_AXES_COMPLETENESS')).toHaveLength(0)
  })

  it('flags a character missing bond', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.bond":
    type: int
  "affinity.judy.trust":
    type: int
  "affinity.panam.trust":
    type: int
  "affinity.panam.resolve":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(
      r.errors.some(
        (e) => e.rule === 'SHARED_AXES_COMPLETENESS' && /panam.*bond/.test(e.message),
      ),
    ).toBe(true)
  })

  it('flags a character missing a story-defined shared axis', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.bond":
    type: int
  "affinity.judy.trust":
    type: int
  "affinity.judy.resolve":
    type: int
  "affinity.panam.bond":
    type: int
  "affinity.panam.trust":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.ok).toBe(false)
    expect(
      r.errors.some(
        (e) => e.rule === 'SHARED_AXES_COMPLETENESS' && /panam.*resolve/.test(e.message),
      ),
    ).toBe(true)
  })

  it('skips single-character examples (no cross-character contract)', () => {
    const skill = `\`\`\`yaml
state_schema:
  "affinity.judy.bond":
    type: int
  "affinity.judy.trust":
    type: int
\`\`\`
`
    const r = lintSkillTemplate(skill)
    expect(r.errors.filter((e) => e.rule === 'SHARED_AXES_COMPLETENESS')).toHaveLength(0)
  })
})

describe('runtime CLI rules — Group 5', () => {
  const goodSkill = `---
name: test
---

# Phase -1

bash \${CLAUDE_SKILL_DIR}/runtime/bin/state doctor

# Phase 2

bash \${CLAUDE_SKILL_DIR}/runtime/bin/state apply slot-1 scene-001 choice-1
`

  describe('PHASE_0_DOCTOR_PRESENT', () => {
    it('passes when skill references state doctor', () => {
      const r = lintSkillTemplate(goodSkill)
      expect(r.errors.filter((e) => e.rule === 'PHASE_0_DOCTOR_PRESENT')).toHaveLength(0)
    })

    it('fails when skill omits state doctor call', () => {
      const skill = `# Phase -1\n\nsome prose without doctor call\n\n# Phase 2\n\nbash runtime/bin/state apply slot-1 scene-001 choice-1\n`
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'PHASE_0_DOCTOR_PRESENT')).toBe(true)
    })
  })

  describe('STATE_APPLY_PRESENT', () => {
    it('passes when skill references state apply', () => {
      const r = lintSkillTemplate(goodSkill)
      expect(r.errors.filter((e) => e.rule === 'STATE_APPLY_PRESENT')).toHaveLength(0)
    })

    it('fails when skill omits state apply call', () => {
      const skill = `# Phase -1\n\nbash runtime/bin/state doctor\n\n# Phase 2\n\nsome prose without state apply\n`
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'STATE_APPLY_PRESENT')).toBe(true)
    })
  })

  describe('NO_EDIT_STATE_YAML', () => {
    it('passes on clean template', () => {
      const r = lintSkillTemplate(goodSkill)
      expect(r.errors.filter((e) => e.rule === 'NO_EDIT_STATE_YAML')).toHaveLength(0)
    })

    it('fails on literal Edit ${CLAUDE_SKILL_DIR}/runtime/saves/.../state.yaml', () => {
      const skill =
        goodSkill +
        '\n\nOld pseudo-code:\n\nEdit \${CLAUDE_SKILL_DIR}/runtime/saves/slot-1/state.yaml\n'
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'NO_EDIT_STATE_YAML')).toBe(true)
    })

    it('fails on literal Edit ${CLAUDE_SKILL_DIR}/runtime/saves/.../meta.yaml', () => {
      const skill =
        goodSkill +
        '\n\nOld pseudo-code:\n\nEdit \${CLAUDE_SKILL_DIR}/runtime/saves/slot-1/meta.yaml\n'
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'NO_EDIT_STATE_YAML')).toBe(true)
    })

    it('fails on bare "Edit state.yaml:" pseudocode', () => {
      const skill = goodSkill + '\n\n  Edit state.yaml:\n    old_string: ...\n'
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'NO_EDIT_STATE_YAML')).toBe(true)
    })

    it('fails on bare "Edit meta.yaml:" pseudocode', () => {
      const skill = goodSkill + '\n\n  Edit meta.yaml:\n    old_string: ...\n'
      const r = lintSkillTemplate(skill)
      expect(r.errors.some((e) => e.rule === 'NO_EDIT_STATE_YAML')).toBe(true)
    })

    it('does not fire on unrelated Edit usage (e.g. editing script.json)', () => {
      // Edits to script.json are a legitimate Phase -1 rename flow
      const skill =
        goodSkill +
        '\n\nRename flow: Read \${CLAUDE_SKILL_DIR}/runtime/scripts/script-abc.json and use Edit or Write to update the title field.\n'
      const r = lintSkillTemplate(skill)
      expect(r.errors.filter((e) => e.rule === 'NO_EDIT_STATE_YAML')).toHaveLength(0)
    })
  })

  describe('real generated template passes all three rules', () => {
    it('a full SKILL.md rendered from the template has zero runtime-CLI rule errors', async () => {
      const { generateSkillMd } = await import('../../src/export/spec/skill-template.js')
      const md = generateSkillMd({
        skillName: 'test-in-world',
        storyName: 'Test',
        worldDisplayName: 'World',
        description: 'test',
        acts_options: [
          { acts: 3, rounds_total: 9, endings_count: 3, label_zh: '短篇' },
        ],
        default_acts: 3,
      })
      const r = lintSkillTemplate(md)
      expect(r.errors.filter((e) => e.rule === 'PHASE_0_DOCTOR_PRESENT')).toHaveLength(0)
      expect(r.errors.filter((e) => e.rule === 'STATE_APPLY_PRESENT')).toHaveLength(0)
      expect(r.errors.filter((e) => e.rule === 'NO_EDIT_STATE_YAML')).toHaveLength(0)
    })
  })
})
