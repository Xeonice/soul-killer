import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readSoulFiles } from '../../../src/soul/package.js'
import { generateSkillMd } from '../../../src/export/spec/skill-template.js'
import { generateStorySpec } from '../../../src/export/spec/story-spec.js'

// --- readSoulFiles ---

describe('readSoulFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
    const soulDir = path.join(tmpDir, 'soul')
    const behaviorsDir = path.join(soulDir, 'behaviors')
    fs.mkdirSync(behaviorsDir, { recursive: true })

    fs.writeFileSync(path.join(soulDir, 'identity.md'), '# Identity\nI am V.')
    fs.writeFileSync(path.join(soulDir, 'style.md'), '# Style\nDirect and terse.')
    fs.writeFileSync(path.join(behaviorsDir, 'combat.md'), '# Combat\nFight first, talk later.')
    fs.writeFileSync(path.join(behaviorsDir, 'social.md'), '# Social\nTrust is earned.')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads identity, style, behaviors, capabilities, and milestones', () => {
    // Add capabilities and milestones files
    fs.writeFileSync(path.join(tmpDir, 'soul', 'capabilities.md'), '# Capabilities\nExcalibur A++')
    fs.writeFileSync(path.join(tmpDir, 'soul', 'milestones.md'), '# Milestones\n## [15] Drew the sword')

    const result = readSoulFiles(tmpDir)
    expect(result.identity).toContain('I am V.')
    expect(result.style).toContain('Direct and terse.')
    expect(result.behaviors).toHaveLength(2)
    expect(result.behaviors[0]).toContain('Combat')
    expect(result.behaviors[1]).toContain('Social')
    expect(result.capabilities).toContain('Excalibur')
    expect(result.milestones).toContain('Drew the sword')
  })

  it('returns empty strings for missing files (backward compat)', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-empty-'))
    const result = readSoulFiles(emptyDir)
    expect(result.identity).toBe('')
    expect(result.style).toBe('')
    expect(result.behaviors).toHaveLength(0)
    expect(result.capabilities).toBe('')
    expect(result.milestones).toBe('')
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })
})

// --- generateSkillMd ---

describe('generateSkillMd', () => {
  const sampleActOptions = [
    { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
    { acts: 5, label_zh: '中篇', rounds_total: '40-60', endings_count: 5 },
  ]

  it('generates valid SKILL.md with frontmatter', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: '视觉小说 — 在赛博朋克 2077的世界中与V的一次相遇。',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('---')
    expect(result).toContain('name: v-in-cyberpunk-2077')
    // allowed-tools must include the four tools required by Phase -1/1 persistence
    expect(result).toMatch(/allowed-tools:.*AskUserQuestion/)
    expect(result).toMatch(/allowed-tools:.*Read/)
    expect(result).toMatch(/allowed-tools:.*Write/)
    expect(result).toMatch(/allowed-tools:.*Glob/)
    expect(result).toMatch(/allowed-tools:.*Edit/)
    expect(result).toContain('Phase 0')
    expect(result).toContain('Phase 1')
    expect(result).toContain('Phase 2')
    expect(result).toContain('AskUserQuestion')
    expect(result).toContain('V')
    expect(result).toContain('赛博朋克 2077')
    // Phase 0 must include length selection
    expect(result).toContain('Choose Story Length')
    expect(result).toContain('短篇')
    expect(result).toContain('state.chosen_acts')
  })

  it('includes state tracking rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('State Tracking Rules')
    expect(result).toContain('axes')
    expect(result).toContain('flags')
  })

  it('includes capabilities and milestones references', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('capabilities.md')
    expect(result).toContain('milestones.md')
    expect(result).toContain('Capability Reference Rules')
    expect(result).toContain('Timeline Reference Rules')
  })

  it('includes Phase -1 script library menu with five top-level options', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Phase -1: Script Library Menu')
    // Post-bun-runtime migration: scripts live at runtime/scripts/*.json
    expect(result).toContain('runtime/scripts/*.json')
    expect(result).not.toContain('runtime/scripts/*.yaml')
    // Flat script list with save status + management sub-menu
    expect(result).toContain('Generate new script')
    expect(result).toContain('Manage scripts')
    expect(result).toContain('Rename script')
    expect(result).toContain('Delete script')
    expect(result).toContain('Start from beginning')
    // state list for save enumeration
    expect(result).toContain('runtime/bin/state list')
    // Header fields that were formerly in YAML frontmatter
    expect(result).toContain('user_direction')
    expect(result).toContain('generated_at')
    // Damaged script handling
    expect(result).toContain('corrupted')
  })

  it('includes Phase 1 script persistence with JSON Write instructions', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Phase 1 must instruct Write tool usage (JSON, not YAML)
    expect(result).toContain('Script Persistence')
    expect(result).toContain('Write tool')
    expect(result).toContain('runtime/scripts/script-')
    expect(result).toContain('script-<id>.json')
    expect(result).not.toContain('script-<id>.yaml')
    // Header fields still enumerated (inside JSON object now)
    expect(result).toContain('"id"')
    expect(result).toContain('"title"')
    expect(result).toContain('"generated_at"')
    expect(result).toContain('"user_direction"')
    expect(result).toContain('"acts"')
    // Explicit JSON format instruction
    expect(result).toContain('JSON format')
    expect(result).toContain('valid JSON')
    // Old "save in internal context" wording must be gone
    expect(result).not.toContain('剧本在你的内部上下文中保存，不要输出给用户')
    // Failure tolerance
    expect(result).toContain('could not be persisted')
  })

  it('includes rename and delete script flows in Phase -1', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Rename flow: now modifies top-level JSON `title` field in memory and writes back
    expect(result).toContain('Rename script')
    expect(result).toContain('top-level `title` field')
    // Delete flow: confirmation + cascade delete saves
    expect(result).toContain('Delete script')
    expect(result).toContain('Confirm delete')
    expect(result).toContain('Deleted script')
    // Corruption tolerance
    expect(result).toContain('corrupted')
    expect(result).toContain('Continue parsing other files')
  })

  it('includes per-script save system with auto + manual saves', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Save System')
    expect(result).toContain('auto/')
    expect(result).toContain('manual/')
    expect(result).toContain('runtime/saves/')
    expect(result).toContain('script_ref')
    expect(result).toContain('last_played_at')
    // Save updates go through state apply (auto) and state save (manual)
    expect(result).toContain('runtime/bin/state apply')
    expect(result).toContain('runtime/bin/state save')
    expect(result).toContain('💾 Save current progress')
    expect(result).not.toContain('Edit ${CLAUDE_SKILL_DIR}/runtime/saves')
  })

  it('includes ending display and replay rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Ending Determination Rules')
    expect(result).toContain('Ending Display Rules')
    expect(result).toContain('Journey recap')
    expect(result).toContain('Ending Gallery')
    expect(result).toContain('Start over')
    expect(result).toContain('Replay Rules')
  })

  it('includes state_schema creation constraints section', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Section header + key concepts
    expect(result).toContain('state_schema Creation Constraints')
    // Naming constraint mentions
    expect(result).toContain('snake_case')
    expect(result).toContain('Dot-separated namespaces')
    expect(result).toContain('Must be quoted')
    // Type set
    expect(result).toContain('int')
    expect(result).toContain('bool')
    expect(result).toContain('enum')
    // Required field metadata
    expect(result).toContain('desc')
    expect(result).toContain('default')
    // Namespace convention
    expect(result).toContain('affinity.<character>.<axis>')
    expect(result).toContain('flags.<event_name>')
    // Example presence
    expect(result).toContain('"affinity.judy.trust"')
  })

  it('includes endings DSL section with cross-character aggregation primitives', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Endings Condition Structured DSL')
    // Existing boolean operators
    expect(result).toContain('>=')
    expect(result).toContain('all_of')
    expect(result).toContain('any_of')
    expect(result).toContain('not')
    // New cross-character aggregation primitives
    expect(result).toContain('all_chars:')
    expect(result).toContain('any_char:')
    expect(result).toContain('except:')
    // Axis restriction
    expect(result).toContain('only be a **shared axis**')
    // Default fallback
    expect(result).toContain('condition: default')
    // Example uses new primitives
    expect(result).toContain('"ending-unity"')
    expect(result).toContain('"ending-breakthrough"')
    // Forbid natural-language expressions
    expect(result).toContain('not accepted')
  })

  it('Phase -1 delegates validation to state CLI with full error code table', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Validation is now delegated to the state CLI — no more inline六重 prose
    expect(result).toContain('runtime/bin/state validate')
    expect(result).toContain('--continue')
    // Structured JSON contract
    expect(result).toContain('"ok"')
    expect(result).toContain('"errors"')
    // Full error code table for LLM to dispatch on
    expect(result).toContain('DANGLING_SCRIPT_REF')
    expect(result).toContain('STATE_SCHEMA_MISSING')
    expect(result).toContain('INITIAL_STATE_MISMATCH')
    expect(result).toContain('CONSEQUENCES_UNKNOWN_KEY')
    expect(result).toContain('SHARED_AXES_INCOMPLETE')
    expect(result).toContain('FLAGS_SET_MISMATCH')
    expect(result).toContain('FIELD_MISSING')
    expect(result).toContain('FIELD_EXTRA')
    expect(result).toContain('FIELD_TYPE_MISMATCH')
    expect(result).toContain('MALFORMED')
    // Error outcome labels
    expect(result).toContain('(orphaned)')
    expect(result).toContain('(corrupted)')
    expect(result).toContain('legacy, cannot replay')
    // Inline prose-style six-fold validation text must be gone (Chinese)
    expect(result).not.toContain('**六重验证**')
    expect(result).not.toContain('**验证 1：dangling reference 检查**')
  })

  it('Phase -1 repair menu routes through state rebuild / state reset', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Repair menu exists and is explicit about forbidding manual Edit/Write
    expect(result).toContain('Repair Menu')
    expect(result).toContain('state rebuild')
    expect(result).toContain('state reset')
    expect(result).toContain('**Never**')
    expect(result).toContain('manually patch state.yaml')
  })

  it('replay rule delegates to state reset CLI command', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('# Replay Rules')
    expect(result).toContain('runtime/bin/state reset')
    // The old Write-to-reset pattern must be gone from the replay rule (Chinese)
    expect(result).not.toContain('整体覆盖为 script 的 `initial_state`')
    expect(result).not.toContain('允许 Write 整个 state.yaml 的两个例外')
    // Note: "用 Write 工具" still appears elsewhere for Phase 1 script.json
    // persistence (a legitimate use — Phase 1 creates the script file).
  })

  it('Phase 2 apply_consequences is delegated to state apply CLI command', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Section header still exists but now dispatches to CLI
    expect(result).toContain('apply_consequences Standard Flow')
    expect(result).toContain('runtime/bin/state apply')
    expect(result).toContain('<current-scene-id>')
    expect(result).toContain('<choice-id>')
    // stdout output format anchors
    expect(result).toContain('SCENE')
    expect(result).toContain('CHANGES')
    expect(result).toContain('clamped')
    // First-enter path uses state init
    expect(result).toContain('runtime/bin/state init')
    // Hard red line: no manual Edit/Write on state.yaml or meta.yaml
    expect(result).toContain('Direct State File Writes')
    expect(result).toContain('**All** state writes must go through')
    // Old pseudo-code must be gone
    expect(result).not.toContain('schema_field is None')
    expect(result).not.toContain('clamp(new,')
    expect(result).not.toContain('Edit ${CLAUDE_SKILL_DIR}/runtime/saves')
    // Old section names that depended on Edit semantics must be gone (Chinese)
    expect(result).not.toContain('Edit 工具的关键约束')
    expect(result).not.toContain('唯一允许 Write 整个 state.yaml 的两个时机')
  })

  it('Phase 1 has 7-step creation procedure', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Phase 1 Creation Steps (Strict Sequential Order)')
    expect(result).toContain('Step 1: Design state_schema')
    expect(result).toContain('Step 2: Write initial_state')
    expect(result).toContain('Step 3: Write scenes')
    expect(result).toContain('Step 4: Write endings')
    expect(result).toContain('Step 5: Self-Check')
    expect(result).toContain('Step 6: Write')
    expect(result).toContain('Step 7: Enter Phase 2')
    expect(result).toContain('character-for-character')
  })

  it('Phase 1 instructions reference chronicle timeline and events directories', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('world/history/timeline.md')
    expect(result).toContain('world/history/events/')
    expect(result).toContain('Chronicle Consistency Requirements')
    expect(result).toContain('display_time')
  })

  it('replay rule reuses current script (no Phase 0 / no regeneration)', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // The new replay rule dispatches to state reset — the CLI handles
    // copying script.initial_state → state.yaml + resetting current_scene.
    expect(result).toContain('runtime/bin/state reset')
    expect(result).toContain('Reuses the current script')
    expect(result).toContain('initial_state')
    expect(result).toContain('first scene')
    expect(result).toContain('Generate new script')
    // Old behaviour must be gone (Chinese)
    expect(result).not.toContain('回到 Phase 0（重新询问 story seeds）')
    expect(result).not.toContain('重新生成全新剧本')
  })

  it('Phase 1 creation steps reference prose_style forbidden_patterns before writing scenes', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Phase 1 Step 3 must instruct LLM to read the prose_style anchor
    // before writing narration/dialogue.
    expect(result).toContain('Prose Style Anchor')
    expect(result).toContain('forbidden_patterns')
    expect(result).toContain('ip_specific')
    // The self-check step for prose_style must exist.
    expect(result).toContain('Prose style anti-pattern verification')
  })

  it('Phase 2 scene rendering lists high-frequency translatese patterns to avoid', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Phase 2 must have its own prose style constraints section.
    expect(result).toContain('Prose Style Constraints')
    // Must call out character_voice_summary as voice anchor priority.
    expect(result).toContain('character_voice_summary')
    // The five high-frequency pattern labels must appear in the cheat sheet.
    expect(result).toContain('Measurement clauses')
    expect(result).toContain('Possessive parallel structures')
    expect(result).toContain('Literal metaphor translation')
    expect(result).toContain('Literal gesture translation')
    expect(result).toContain('Literal negation')
  })

  it('Phase 1 includes context budget declaration with file count and size', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      expectedFileCount: 137,
      expectedTextSizeKb: 420,
    })

    // Budget declaration header + concrete numbers
    expect(result).toContain('Context Budget and Full-Read Enforcement')
    expect(result).toContain('137')
    expect(result).toContain('420 KB')
    expect(result).toContain('1,000,000 token')
    // The hard no-pagination constraint
    expect(result).toContain('MUST NOT use `offset` or `limit` parameters')
    // The "don't be frugal" authorization
    expect(result).toContain('Do not defensively conserve')
  })

  it('Phase 1 budget declaration uses fallback when no file count provided', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      // expectedFileCount / expectedTextSizeKb omitted
    })

    // Fallback still has the header and the no-pagination constraint
    expect(result).toContain('Context Budget and Full-Read Enforcement')
    expect(result).toContain('MUST NOT use `offset` or `limit` parameters')
    // Fallback should NOT contain a specific file count like "approximately N files"
    // (the generic version doesn't claim a number)
    expect(result).not.toMatch(/approximately \*\*\d+ files/)
  })

  it('Phase 1 includes Step 0 data loading report instructions', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      expectedFileCount: 60,
      expectedTextSizeKb: 230,
    })

    expect(result).toContain('Step 0: Data Loading Report')
    expect(result).toContain('# Data Loading Report')
    // Structured markdown table headers
    expect(result).toContain('| Category | File | Lines |')
    expect(result).toContain('(not present)')
    // Step 1 has the guard clause pointing back to Step 0
    expect(result).toContain('Precondition check')
    expect(result).toContain('stop immediately and go back to do Step 0')
  })

  it('Phase 1 re-reads story-spec.md to fix Phase 0 pollution', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      expectedFileCount: 60,
      expectedTextSizeKb: 230,
    })

    expect(result).toContain('Phase 0 Contamination Fix')
    expect(result).toContain('re-Read')
    expect(result).toContain('story-spec.md')
    expect(result).toContain('first 50 lines')
  })

  it('Phase 1 Step 5 includes data coverage self-check (single-character engine)', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      expectedFileCount: 60,
      expectedTextSizeKb: 230,
    })

    // Single-character engine uses Step 5.e for data coverage
    expect(result).toContain('Step 5.e — Data coverage completeness')
    // Sanity thresholds must be present
    expect(result).toContain('> 50')
    expect(result).toContain('> 40')
    expect(result).toContain('> 20')
    // Recovery path
    expect(result).toContain('offset/limit')
  })

  it('Phase 1 Step 5 includes data coverage self-check (multi-character engine)', () => {
    const result = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      expectedFileCount: 200,
      expectedTextSizeKb: 800,
      characters: [
        { name: 'A', role: 'protagonist', axes: [], slug: 'a' },
        { name: 'B', role: 'deuteragonist', axes: [], slug: 'b' },
      ],
    })

    // Multi-character engine uses Step 5.h for data coverage
    expect(result).toContain('Step 5.h — Data coverage completeness')
    // Header updated to Eight-Fold
    expect(result).toContain('Step 5: Eight-Fold Self-Check')
    // Step 1 count in header updated to 8 steps (0-7)
    expect(result).toContain('8 steps (Step 0 - Step 7)')
  })

  it('Phase 2 forbids LLM trained-default self-pause and fourth-wall breaks', () => {
    // Covers a diagnosed failure mode: LLM inserting "要继续吗?" meta-prompts
    // mid-Phase-2 and leaking save slot / scene ID details to the user.
    // The SKILL.md must explicitly forbid these trained defaults.
    const resultMulti = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      characters: [
        { name: 'A', role: 'protagonist', axes: [], slug: 'a' },
        { name: 'B', role: 'deuteragonist', axes: [], slug: 'b' },
      ],
    })

    // Category 1: control-flow self-pause
    expect(resultMulti).toContain('Control Flow Self-Pausing')
    expect(resultMulti).toContain('continue?')
    expect(resultMulti).toContain('response seems too long')
    expect(resultMulti).toContain('apply_consequences -> render next scene is **a single atomic action**')

    // Category 2: progress / save exposure (fourth wall)
    expect(resultMulti).toContain('Progress/Save Exposure')
    expect(resultMulti).toContain('mid-Act 3')
    expect(resultMulti).toContain('scene-007')
    expect(resultMulti).toContain('auto/')
    expect(resultMulti).toContain('story state update')

    // Category 3: chatbot meta-narration
    expect(resultMulti).toContain('Chatbot-Style Meta-Narration')

    // Category 4: option label contamination
    expect(resultMulti).toContain('Option Label Contamination')
    expect(resultMulti).toContain('friendly route')

    // "Only stop in 4 cases" clarification
    expect(resultMulti).toContain('You Only Stop Rendering in 4 Situations')
    expect(resultMulti).toContain('immediately render the next scene')

    // Single-character engine has the same rules
    const resultSingle = generateSkillMd({
      skillName: 'test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      // no characters → single-character engine path
    })
    expect(resultSingle).toContain('Control Flow Self-Pausing')
    expect(resultSingle).toContain('Progress/Save Exposure')
    expect(resultSingle).toContain('You Only Stop Rendering in 4 Situations')
    expect(resultSingle).toContain('immediately render the next scene')
  })
})

// --- generateStorySpec ---

describe('generateStorySpec', () => {
  const sampleActOptions = [
    { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
    { acts: 5, label_zh: '中篇', rounds_total: '40-60', endings_count: 5 },
  ]

  it('generates story-spec.md with config values', () => {
    const result = generateStorySpec({
      story_name: '暗巷追凶',
      genre: '赛博朋克黑色电影',
      tone: '暗巷与阴谋',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: ['不要出现超自然元素'],
    })

    expect(result).toContain('story_name: "暗巷追凶"')
    expect(result).toContain('genre: 赛博朋克黑色电影')
    expect(result).toContain('tone: 暗巷与阴谋')
    expect(result).toContain('acts_options:')
    expect(result).toContain('default_acts: 3')
    expect(result).toContain('短篇')
    expect(result).toContain('中篇')
    expect(result).toContain('state.chosen_acts')
    expect(result).toContain('不要出现超自然元素')
  })

  it('includes state system and ending rules (single-character, post story-level-state)', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('State System')
    // Three-layer structure replaces old heading
    expect(result).toContain('Three-Layer Structure')
    expect(result).toContain('Shared Axes')
    expect(result).toContain('Character-Specific Axes')
    expect(result).toContain('Flags')
    // Endings still discussed
    expect(result).toContain('Ending Evaluation')
    expect(result).toContain('Default Ending')
  })

  it('omits constraints block when empty', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).not.toContain('Additional Constraints')
  })

  it('state system uses three-layer structure and DSL endings', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    // Three-layer reference (replaces the old label)
    expect(result).toContain('Three-Layer Structure')
    expect(result).toContain('Layer 1: Shared Axes')
    expect(result).toContain('Layer 2: Character-Specific Axes')
    expect(result).toContain('Layer 3: Flags')
    expect(result).toContain('character-for-character')
    // Endings DSL — structured
    expect(result).toContain('Structured DSL')
    expect(result).toContain('all_of')
    expect(result).toContain('condition: default')
    // No old free-text condition syntax
    expect(result).not.toMatch(/条件: trust >= 7 AND shared_secret/)
  })

  it('replay option reuses current script', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('reuse the current script')
    expect(result).toContain('initial_state')
    expect(result).toContain('Phase 2\'s first scene')
    expect(result).toContain('Generate New Script')
    expect(result).not.toMatch(/回到 Phase 0/)
  })

  it('emits story_state section with shared_axes_custom and flags yaml block when provided', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
      story_state: {
        shared_axes_custom: ['trust', 'rivalry'],
        flags: [
          { name: 'met_illya', desc: '玩家首次遇到伊莉雅', initial: false },
          { name: 'truth_revealed', desc: '真相被揭露', initial: false },
        ],
      },
    })

    // The Story State section exists and is machine-parseable
    expect(result).toContain('## Story State')
    expect(result).toContain('shared_axes_custom: [trust, rivalry]')
    expect(result).toContain('- name: met_illya')
    expect(result).toContain('- name: truth_revealed')
    expect(result).toContain('initial: false')
    // Legacy placeholder must NOT be present when story_state is provided
    expect(result).not.toContain('was not declared via set_story_state')
  })

  it('emits legacy placeholder in story_state section when not provided', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('## Story State')
    expect(result).toContain('was not declared via set_story_state')
  })

  it('multi-character state system renders three layers with story_state shared axes', () => {
    const result = generateStorySpec({
      story_name: 'fsn-test',
      genre: 'visual novel',
      tone: '救赎',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
      story_state: {
        shared_axes_custom: ['trust', 'rivalry'],
        flags: [{ name: 'met_illya', desc: '...', initial: false }],
      },
      characters: [
        {
          name: 'illya',
          display_name: '伊莉雅',
          role: 'protagonist',
          axes: [{ name: '自我价值', english: 'self_worth', initial: 3 }],
        },
        {
          name: 'kotomine',
          display_name: '绮礼',
          role: 'antagonist',
          axes: [],
          shared_initial_overrides: { bond: 1, trust: 1, rivalry: 8 },
        },
      ],
    })

    // Multi-char three-layer header
    expect(result).toContain('Three-Layer Structure')
    // Shared axes listed with the story_state names
    expect(result).toContain('bond / trust / rivalry')
    // Each character shows shared axis initial (kotomine's overrides)
    expect(result).toContain('`bond`=1')
    expect(result).toContain('`rivalry`=8')
    // Specific axes listed
    expect(result).toContain('self_worth')
    // Flags yaml listing
    expect(result).toContain('- `flags.met_illya`')
    // all_chars / any_char in endings DSL section
    expect(result).toContain('all_chars:')
    expect(result).toContain('any_char:')
  })

  it('marks default acts option in summary', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 5,
      constraints: [],
    })

    // Default option should be marked as recommended
    expect(result).toContain('**中篇** (5 acts, 40-60 rounds, 5 endings) [Recommended]')
    // Non-default should NOT have the marker
    expect(result).toContain('**短篇** (3 acts, 24-36 rounds, 4 endings)')
    expect(result).not.toContain('**短篇** (3 acts, 24-36 rounds, 4 endings) [Recommended]')
  })

  it('emits prose_style section with voice_anchor / forbidden_patterns / ip_specific when provided', () => {
    const result = generateStorySpec({
      story_name: 'fsn-test',
      genre: 'visual novel',
      tone: '救赎',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
      prose_style: {
        target_language: 'zh',
        voice_anchor: 'type-moon 系日翻中视觉小说官方译本风格，克制冷峻',
        forbidden_patterns: [
          {
            id: 'degree_clause',
            bad: '她抓着你腰的手收紧到了指甲嵌进衣服的程度',
            good: '她猛地收紧抓着你腰的手。指甲掐进了衣服里',
            reason: '英文 to-the-degree-that 从句直译',
          },
          {
            id: 'possessive_chain',
            bad: '我的 A。我的 B。我的 C。',
            good: 'A。B。还有 C。',
            reason: '英文 my-X / my-Y 排比直译',
          },
          {
            id: 'gaze_level',
            bad: '让自己的视线和她的视线持平',
            good: '与她平视',
            reason: 'level gaze 直译',
          },
        ],
        ip_specific: [
          '宝具/Servant/Master 保留英文不意译',
          '敬语：樱 → 樱小姐；士郎 → 卫宫',
          '比喻池：月光/雪/灯笼/石阶，不用西式意象',
        ],
        character_voice_summary: {
          sakura: '间桐桜：克制敬语中文。「先輩…」译为「学长……」',
        },
      },
    })

    // Section header
    expect(result).toContain('## Prose Style Anchor')
    // Scalar fields
    expect(result).toContain('target_language: zh')
    expect(result).toContain('type-moon 系日翻中')
    // Forbidden patterns yaml block
    expect(result).toContain('forbidden_patterns:')
    expect(result).toContain('id: degree_clause')
    expect(result).toContain('id: possessive_chain')
    expect(result).toContain('id: gaze_level')
    // ip_specific listed
    expect(result).toContain('ip_specific:')
    expect(result).toContain('宝具/Servant/Master')
    // character_voice_summary
    expect(result).toContain('character_voice_summary:')
    expect(result).toContain('sakura:')
    // Fallback marker should NOT appear
    expect(result).not.toContain('(Fallback)')
  })

  it('emits prose_style fallback section when prose_style is missing', () => {
    const result = generateStorySpec({
      story_name: 'legacy-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('## Prose Style Anchor (Fallback)')
    // Fallback inlines the top 5 highest-frequency forbidden patterns.
    expect(result).toContain('id: degree_clause')
    expect(result).toContain('id: gaze_level')
    // Generic voice anchor message
    expect(result).toContain('Restrained written Chinese')
  })

  it('forbidden_patterns yaml in prose_style section escapes embedded quotes', () => {
    const result = generateStorySpec({
      story_name: 'test',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
      prose_style: {
        target_language: 'zh',
        voice_anchor: '足够长的 voice anchor 描述 twenty chars',
        forbidden_patterns: [
          {
            id: 'quoted_pattern',
            bad: '她说"朋友"时 voice was empty',
            good: '她说"朋友"时声音平得像一面湖',
            reason: '测试引号转义',
          },
          { id: 'p2', bad: 'b2', good: 'g2', reason: 'r2' },
          { id: 'p3', bad: 'b3', good: 'g3', reason: 'r3' },
        ],
        ip_specific: ['rule one具体', 'rule two具体', 'rule three具体'],
      },
    })

    // Quotes escaped
    expect(result).toContain('\\"朋友\\"')
  })
})
