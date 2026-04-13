import { formatPathSegment } from '../support/format-index.js'
import {
  topForbiddenPatterns,
  type ProseStyleForbiddenPattern,
} from '../support/prose-style-index.js'

/**
 * The soulkiller platform's fixed shared axis name. Every character in every
 * story has an `affinity.<char>.bond` field — this one is NOT declared in
 * `story_state.shared_axes_custom` but is always present alongside the two
 * story-defined axes.
 */
export const BOND_AXIS = 'bond'

export interface CharacterAxis {
  /** Display name (e.g., "信任") */
  name: string
  /** kebab-case English identifier for state tracking (e.g., "trust") */
  english: string
  /** Initial value 0-10 */
  initial: number
}

/**
 * Per-character initial-value overrides for the 3 shared axes. Keys are the
 * axis english identifier (`bond` or one of story_state.shared_axes_custom),
 * values are the initial int in [0, 10].
 *
 * Typical use: villains who should start with low bond/trust without
 * shifting the global default for every character.
 */
export type CharacterAxisOverrides = Record<string, number>

export type CharacterRole = 'protagonist' | 'deuteragonist' | 'antagonist' | 'supporting'

export interface CharacterSpec {
  /** Soul name (matches souls/{name}/ directory) */
  name: string
  /** Display name from soul manifest */
  display_name?: string
  role: CharacterRole
  /**
   * Character-specific axes (0-2 per character). These are flavor axes unique
   * to this character (e.g., 伊莉雅's `self_worth`, 凛's `tsundere_level`).
   * The 3 shared axes (bond + story-defined two) are NOT listed here — they
   * are implicit and declared once in `story_state.shared_axes_custom`.
   */
  axes: CharacterAxis[]
  /**
   * Optional per-character overrides for the shared axes' initial values.
   * When present, the overridden shared axis gets a different default in
   * the generated state_schema (e.g., a villain's `bond` starts at 1
   * instead of 5).
   */
  shared_initial_overrides?: CharacterAxisOverrides
  /** When the character first appears (e.g., "act_1", "act_2"). Defaults to "act_1". */
  appears_from?: string
  /** Optional one-line summary of this character's relationship dynamics */
  dynamics_note?: string
  /**
   * Optional Chinese voice summary for characters whose source style.md
   * contains heavy non-target-language content (e.g., fsn characters with
   * > 30% Japanese quotations). Provided by the export agent at add_character
   * time when the agent detects language heterogeneity. Max 200 chars.
   * Written to story_spec.prose_style.character_voice_summary at build time.
   */
  voice_summary?: string
}

/**
 * A key flag declared at story-design time. These are the only legal flag
 * names that Phase 1 LLM may reference in `scripts/*.yaml` — attempting to
 * introduce a flag not on this list is rejected by the Phase 1 self-check
 * and by Phase -1's "flags consistency" load validation.
 */
export interface StoryStateFlag {
  /** snake_case identifier, e.g. `illya_acknowledges_sisterhood` */
  name: string
  /** Short description shown to the LLM so it understands when to toggle the flag */
  desc: string
  /** Initial value. Flags almost always start false; true is allowed for pre-set conditions */
  initial: boolean
}

/**
 * Story-level state design. Filled in by the export agent via the
 * `set_story_state` tool after `set_story_metadata` but before adding
 * characters — this is the moment where the story's global state vocabulary
 * is locked in. Phase 1 LLM inherits this vocabulary and cannot extend it.
 *
 *   shared_axes_custom: the two non-bond shared axes for this story, e.g.
 *   `["trust", "rivalry"]`. Together with the platform-fixed `bond` they
 *   form every character's 3 shared axes.
 *
 *   flags: every key event flag the story will track. Typical count 5-8,
 *   soft cap 8 (exceeding it produces a warning but does not block).
 */
export interface StoryState {
  shared_axes_custom: [string, string]
  flags: StoryStateFlag[]
}

/**
 * Story-level prose style anchor (prose-style-anchor change).
 *
 * Filled in by the export agent via the `set_prose_style` tool after
 * `set_story_state` but before adding characters. Every new export is
 * REQUIRED to produce this — `ExportBuilder.build()` throws if it is
 * missing. The goal is to eliminate translatese from all generated
 * Chinese prose regardless of source IP.
 *
 *   target_language: currently only 'zh' is supported. Reserved for
 *   future i18n.
 *
 *   voice_anchor: short free-text describing the overall prose style
 *   direction. MUST include a concrete IP-type word (e.g., "type-moon 系
 *   日翻中视觉小说", "古典章回", "赛博朋克网文"). At least 20 chars.
 *
 *   forbidden_patterns: structured bad/good examples forming hard red
 *   lines for Phase 1/2 prose generation. At least 3 entries; typically
 *   selected from the universal ZH_TRANSLATESE_PATTERNS library plus any
 *   story-specific additions the agent composes.
 *
 *   ip_specific: free-text bullet rules specific to this story/IP, e.g.
 *   term preservation ("宝具/Servant 保留英文"), formality register
 *   ("敬语用'桜さん→樱小姐'"), or metaphor pool constraints. At least 3
 *   entries; must be concrete rules not abstract guidance.
 *
 *   character_voice_summary: optional per-character Chinese summary
 *   (max 200 chars each) used when that character's style.md contains
 *   heavy non-target-language content. Phase 2 LLM uses this as the
 *   primary voice anchor for the named character.
 */
export interface ProseStyle {
  target_language: 'zh' | 'en' | 'ja'
  voice_anchor: string
  forbidden_patterns: ProseStyleForbiddenPattern[]
  ip_specific: string[]
  character_voice_summary?: Record<string, string>
}

/**
 * A length preset offered to the user at skill startup (Phase 0).
 * Agent provides 2-3 ActOptions and the user picks one to determine
 * total acts, expected rounds, and ending count for this playthrough.
 */
export interface ActOption {
  /** Total acts for this length (e.g., 3, 5, 7) */
  acts: number
  /** Display label in Chinese (e.g., "短篇" / "中篇" / "长篇") */
  label_zh: string
  /** Expected total rounds range (e.g., "24-36") */
  rounds_total: string
  /** Number of distinct endings for this length */
  endings_count: number
}

/**
 * A character selected as a route focus character. Route branching uses
 * these characters' affinity thresholds to determine which narrative
 * route the player enters at the gate scene.
 */
export interface RouteCharacter {
  /** Character's ASCII slug (matches souls/{slug}/) */
  slug: string
  /** Character's display name */
  name: string
  /** Why this character was selected as a route focus */
  reason: string
}

export interface StorySpecConfig {
  /** Story name provided by the user (identity of this export) */
  story_name: string
  /** Optional free-form user direction text (injected at top of agent prompt) */
  user_direction?: string
  genre: string
  tone: string
  constraints: string[]
  /** 2-3 length presets the user can choose from at runtime */
  acts_options: ActOption[]
  /** Default length: must equal one of acts_options[i].acts */
  default_acts: number
  /** Multi-character cast. Empty or single = backward-compatible single-character mode. */
  characters?: CharacterSpec[]
  /**
   * Story-level state design (shared axes + flags). Required for scripts
   * generated under the `story-level-state` change. Older skills that were
   * exported before this field existed will be missing it at Phase -1 load
   * time, which triggers the "legacy, cannot replay" hard fail path.
   */
  story_state?: StoryState
  /**
   * Story-level prose style anchor (prose-style-anchor change). Required
   * for every new export; `ExportBuilder.build()` throws when missing.
   * Older archived skills won't have this field — the template renders a
   * fallback section in that case so the player-side experience doesn't
   * completely crash.
   */
  prose_style?: ProseStyle
  /**
   * Route focus characters selected by the export agent via
   * `select_route_characters`. When present, Phase 1 generates a gate
   * scene with affinity-based routing and per-route scene/ending branches.
   * Optional: stories without routes are still valid linear narratives.
   */
  route_characters?: RouteCharacter[]
}

function formatCharactersBlock(characters: CharacterSpec[]): string {
  return characters.map((c) => {
    const axesYaml = c.axes.map((a) =>
      `      - { name: "${a.name}", english: ${a.english}, initial: ${a.initial} }`
    ).join('\n')
    const appearsFrom = c.appears_from ? `    appears_from: ${c.appears_from}` : ''
    const dynamicsNote = c.dynamics_note ? `    dynamics_note: "${c.dynamics_note}"` : ''
    const lines = [
      `  - name: "${c.name}"`,
      c.display_name ? `    display_name: "${c.display_name}"` : '',
      `    role: ${c.role}`,
      '    axes:',
      axesYaml,
      appearsFrom,
      dynamicsNote,
    ].filter(Boolean)
    return lines.join('\n')
  }).join('\n')
}

function buildMultiCharacterRules(characters: CharacterSpec[]): string {
  const charNames = characters.map((c) => c.name).join(', ')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]?.name ?? ''

  return `
## Multi-Character Cast

This script features ${characters.length} core characters: ${charNames}.

### Character Roles

${characters.map((c) => {
  const roleLabel = c.role === 'protagonist' ? 'Protagonist'
    : c.role === 'deuteragonist' ? 'Deuteragonist'
    : c.role === 'antagonist' ? 'Antagonist'
    : 'Supporting'
  const axes = c.axes.map((a) => `${a.name}(${a.english})`).join(' / ')
  const appearsLine = c.appears_from && c.appears_from !== 'act_1' ? `Appears from ${c.appears_from}` : 'Present throughout'
  const dynamicsLine = c.dynamics_note ? `\n  - Dynamics: ${c.dynamics_note}` : ''
  return `- **${c.name}** [${roleLabel}]
  - Affinity axes: ${axes}
  - Appearance: ${appearsLine}${dynamicsLine}`
}).join('\n')}

### Cast Scheduling Rules

Every scene must explicitly annotate its cast (characters present). Characters not in the cast do not participate in that scene's dialogue, and their affinity axes are not affected by that scene's choices.

\`\`\`
[scene: scene_id]

[narration]
Narration text...

[cast]
- ${protagonist}: { mood: ..., stance: ... }
- {other_present_character}: { mood: ..., stance: ... }

[dialogue]
${protagonist}: "..."
{other_character}: "..."
(narration may be interspersed)

[choices]
- "Choice text" -> scene:{next_scene} | ${protagonist}.${characters[0]?.axes[0]?.english ?? 'trust'} +2, {other_character}.{axis} +/- N
- ...
\`\`\`

### Choice Tradeoff Constraints (Important)

- Each choice must produce **differentiated affinity effects across characters** (one goes up while another goes down, or different magnitudes)
- **It is forbidden** for all choices to affect all characters in the same direction (such choices are meaningless)
- At least one choice must create tension between the protagonist and deuteragonist
- Supporting characters' affinity changes should generally be smaller than those of main characters

### Character Appearance Timing

${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').length > 0
  ? characters.filter((c) => c.appears_from && c.appears_from !== 'act_1')
      .map((c) => `- ${c.name}: Appears from ${c.appears_from} onward; first appearance must have a natural introduction`)
      .join('\n')
  : 'All characters are present throughout the story.'}
`
}

function buildMultiCharacterStateSystem(
  characters: CharacterSpec[],
  storyState?: StoryState,
): string {
  // Compute an ASCII slug for every character so that schema key examples
  // stay spec-compliant even when the character name is CJK. This mirrors
  // what packager.ts does when building souls/<slug>/ paths in the archive,
  // so the slug LLM sees in story-spec lines up with the actual on-disk
  // soul directory name and the SKILL.md path mapping table.
  const slugs = characters.map((c) => formatPathSegment(c.name, 'char'))

  // Default shared axes when story_state is missing (legacy single-change
  // compatibility). When story_state is set — which is the post-change
  // expected state — these come from the author's design.
  const sharedAxes: string[] = storyState
    ? [BOND_AXIS, ...storyState.shared_axes_custom]
    : [BOND_AXIS, 'trust', 'respect']

  const flagsList = storyState?.flags ?? []

  const sampleCharA = slugs[0] ?? 'char-a'
  const sampleCharB = slugs[1] ?? 'char-b'
  const sampleSharedAxis = sharedAxes[1] ?? 'trust'
  const sampleFlagName = flagsList[0]?.name ?? 'shared_secret'

  // Build the per-character schema example. Each character contributes:
  //   · 3 shared axes (bond + shared_axes_custom), each with possibly
  //     overridden initial value
  //   · 0-2 specific axes from character.axes
  const schemaExampleLines: string[] = []
  for (let i = 0; i < characters.length; i++) {
    const c = characters[i]!
    const slug = slugs[i]!
    const overrides = c.shared_initial_overrides ?? {}
    // Shared axes
    for (const axis of sharedAxes) {
      const initial = overrides[axis] ?? 5
      schemaExampleLines.push(`  "affinity.${slug}.${axis}":`)
      schemaExampleLines.push(`    desc: "${c.name} ${axis} (shared axis)"`)
      schemaExampleLines.push(`    type: int`)
      schemaExampleLines.push(`    range: [0, 10]`)
      schemaExampleLines.push(`    default: ${initial}`)
    }
    // Specific axes
    for (const a of c.axes) {
      schemaExampleLines.push(`  "affinity.${slug}.${a.english}":`)
      schemaExampleLines.push(`    desc: "${c.name} — ${a.name} (specific axis)"`)
      schemaExampleLines.push(`    type: int`)
      schemaExampleLines.push(`    range: [0, 10]`)
      schemaExampleLines.push(`    default: ${a.initial}`)
    }
  }
  // Flags
  for (const f of flagsList) {
    schemaExampleLines.push(`  "flags.${f.name}":`)
    schemaExampleLines.push(`    desc: "${f.desc}"`)
    schemaExampleLines.push(`    type: bool`)
    schemaExampleLines.push(`    default: ${f.initial}`)
  }

  const charactersListingLines = characters.map((c, i) => {
    const slug = slugs[i]!
    const overrides = c.shared_initial_overrides ?? {}
    const sharedParts = sharedAxes.map((axis) => {
      const initial = overrides[axis] ?? 5
      const mark = axis in overrides ? ' ★' : ''
      return `\`${axis}\`=${initial}${mark}`
    }).join(', ')
    const specificParts = c.axes.length === 0
      ? '(none)'
      : c.axes.map((a) => `\`${a.english}\`(${a.name})=${a.initial}`).join(', ')
    return `- **${c.name}** (slug: \`${slug}\`)\n  - Shared axes initial: ${sharedParts}\n  - Specific axes: ${specificParts}`
  }).join('\n')

  const flagsListing = flagsList.length === 0
    ? '(No flags declared via set_story_state for this story — this field should be filled in by the export agent)'
    : flagsList.map((f) => `- \`flags.${f.name}\` — ${f.desc} (initial: ${f.initial})`).join('\n')

  return `
## State System (Multi-Character, Three-Layer Structure)

All runtime state fields must be **explicitly declared** in the \`state_schema\` block at the top of \`script.yaml\` — each key is a quoted literal string with type / range / default / desc. See the "state_schema authoring constraints" section in SKILL.md for detailed rules.

**Important**: Schema keys **must use ASCII slugs** (lowercase letters / digits / hyphens / underscores) as the character namespace. CJK characters are not allowed. See the "Character Path Mapping" table at the top of SKILL.md for each character's slug.

State is organized into **three layers**: **shared axes** (every character has them), **character-specific axes** (0-2 per character), and **flags** (story-level, predefined).

### Layer 1: Shared Axes (all 3 required per character)

This story's shared axes are \`${sharedAxes.join(' / ')}\`, where \`bond\` is platform-fixed and the other 2 are declared by the export agent via \`set_story_state\`.
Every character **must** have all 3 shared axis fields — **no opt-out**. Shared axes are used for cross-character aggregation in the ending DSL (\`all_chars\` / \`any_char\`).

### Layer 2: Character-Specific Axes (0-2 per character)

Specific axes represent emotional or growth dimensions unique to a character. They are purely for flavor and do not participate in cross-character aggregation, but can still be used in ending conditions as character-exclusive branching criteria.

### Layer 3: Flags (story-level, predefined)

Key event flags are declared **once** in \`set_story_state\`. **Phase 1 LLM cannot create new flags** — it may only reference flag names listed in this section.

Flags declared for this story:

${flagsListing}

### Per-Character State Configuration

${charactersListingLines}

The ★ marker indicates that the shared axis's initial value has been overridden per-character (shared_initial_overrides).

### state_schema Example (this story — Phase 1 LLM must copy verbatim into script.yaml)

\`\`\`yaml
state_schema:
${schemaExampleLines.join('\n')}
\`\`\`

### Choice State Effects (consequences)

Each \`choice.consequences\` **must** only reference fields declared in the schema, and keys must be **copied character-for-character**. A single choice can affect multiple characters' shared axes, specific axes, and flags simultaneously.

\`\`\`yaml
choices:
  - text: "Choice text"
    consequences:
      "affinity.${sampleCharA}.bond": -2                # shared axis delta
      "affinity.${sampleCharB}.${sampleSharedAxis}": +1  # another character, another shared axis
      "flags.${sampleFlagName}": true                    # story-level flag trigger
    next: "scene-next"
\`\`\`

Different choices must produce **differentiated affinity effects across characters** (this is a hard constraint of story-spec).
`
}

function buildMultiCharacterEnding(
  characters: CharacterSpec[],
  minEndings: number,
  storyState?: StoryState,
): string {
  // Use ASCII slugs (consistent with state schema and SKILL.md path mapping)
  // so the example DSL keys are valid spec-compliant references.
  const slugA = characters[0] ? formatPathSegment(characters[0].name, 'char') : 'char-a'
  const displayA = characters[0]?.display_name ?? characters[0]?.name ?? 'A'
  const slugB = characters[1] ? formatPathSegment(characters[1].name, 'char') : 'char-b'
  const displayB = characters[1]?.display_name ?? characters[1]?.name ?? 'B'
  const specificAxisA = characters[0]?.axes[0]?.english
  const sampleSharedAxis = storyState?.shared_axes_custom[0] ?? 'trust'
  const sampleFlag = storyState?.flags[0]?.name ?? 'truth_revealed'
  const villainSlug = (() => {
    const villain = characters.find((c) => c.role === 'antagonist')
    return villain ? formatPathSegment(villain.name, 'char') : slugB
  })()

  return `
## Ending Evaluation (Multi-Character Combination, Structured DSL)

At least ${minEndings} distinct endings (depending on the number of acts selected at runtime), determined by the combination of multi-character affinity axes + key event flags.

Each ending's \`condition\` field **must** use the structured DSL (natural language string expressions are not accepted).
See the "endings condition structured DSL" section in SKILL.md for detailed syntax.

Endings are evaluated in array order; the first ending where \`evaluate(condition) === true\` is triggered.
**The last ending must** use \`condition: default\` as the fallthrough.

All \`affinity.<slug>.<axis>\` keys referenced in the DSL must use the character's ASCII slug (see the "Character Path Mapping" table at the top of SKILL.md). CJK characters are not allowed.

### Available DSL Nodes

- **Comparison node**: \`{ key, op, value }\` — references any schema field (shared/specific axes, flags, custom)
- **Boolean combinators**: \`all_of: [...]\` / \`any_of: [...]\` / \`not: {...}\`
- **Cross-character aggregation** (only valid for **shared axes**):
  - \`all_chars: { axis, op, value, except? }\` — all characters (excluding the except list) satisfy the condition on this shared axis
  - \`any_char: { axis, op, value, except? }\` — at least one character (excluding the except list) satisfies the condition on this shared axis
- **Fallthrough**: \`condition: default\`

**Important**: The \`axis\` in \`all_chars\` / \`any_char\` may only reference **shared axes** (\`bond\` or the 2 axes in story_state.shared_axes_custom). It **cannot** reference character-specific axes (specific axes have different names per character and cannot be aggregated across characters).

Format example (in script.yaml):
\`\`\`yaml
endings:
  # Example 1: Universal acceptance — using all_chars to aggregate shared axes across all characters
  - id: "ending-unity"
    title: "United We Stand"
    condition:
      all_of:
        - all_chars: { axis: "bond", op: ">=", value: 7, except: ["${villainSlug}"] }
        - { key: "flags.${sampleFlag}", op: "==", value: true }
    body: |
      ...

  # Example 2: Dual-character opposition — ${displayA} scores high while ${displayB} becomes fully hostile
  - id: "ending-${slugA}-route"
    title: "${displayA} Exclusive Ending"
    condition:
      all_of:
        - { key: "affinity.${slugA}.bond", op: ">=", value: 8 }${specificAxisA ? `
        - { key: "affinity.${slugA}.${specificAxisA}", op: ">=", value: 7 }` : ''}
        - { key: "affinity.${slugB}.${sampleSharedAxis}", op: "<=", value: 2 }
    body: |
      ...

  # Example 3: Any character achieves enlightenment — using any_char
  - id: "ending-breakthrough"
    title: "At Least One Awakens"
    condition:
      any_char: { axis: "${sampleSharedAxis}", op: ">=", value: 9 }
    body: |
      ...

  - id: "ending-default"
    title: "Default Ending"
    condition: default
    body: |
      ...
\`\`\`

### Ending Design Guidelines

- Different endings should reflect the **final state of different character combinations**
- At minimum, include:
  - 1 ending favoring the protagonist
  - 1 ending favoring the deuteragonist
  - 1 "perfect" ending where all characters reach high affinity
  - 1 default/failure ending
- Endings must have distinct emotional tones

## Ending Gallery Display

When an ending is reached, present the following in order:

### 1. Ending Narration
Ending narration + full portrayal of present characters (same format as regular scenes).

### 2. Journey Recap

Display each character's final affinity axis values, grouped by character:

\`\`\`
${characters.map((c) => {
  const axesLines = c.axes.map((a) => `  ${a.name.padEnd(8)} {bar} {value}/10`).join('\n')
  return `${c.name}:\n${axesLines}`
}).join('\n')}
\`\`\`

Progress bar format: \`'█'.repeat(value) + '░'.repeat(10-value)\`

### 3. Key Event Flags

\`\`\`
{event_name} ✓  (triggered)
{event_name} ✗  (not triggered)
\`\`\`

### 4. Ending Gallery (All Endings)

List **all** endings, each containing:
- Title (achieved endings marked with ★, unachieved with ☆)
- Trigger condition summary (e.g., "Requires character_a.trust >= 7 and shared the secret")
- One preview line (the first sentence of that ending)

Format example:
\`\`\`
★ Stars Fall at Wuzhang Plains (Achieved)
  "You held on until the very end..."

☆ Sleeping Dragon and Fledgling Phoenix (Not Achieved)
  Condition: character_a.bond >= 8 AND character_b.warmth >= 8
  "If only you had met her sooner..."
\`\`\`

### 5. Replay Options

Use AskUserQuestion to provide:
- "Start Over" — **reuse the current script**, reset affinity and flags to the script's declared \`initial_state\`, clear the current slot's state.yaml, restart from Phase 2's first scene; does not re-enter Phase 0/1 or regenerate the script
- "End Story" — story concludes

To play a completely new script, end the story and restart the skill, then select "Generate New Script" from the Phase -1 menu.
`
}

function buildSingleCharacterStateSystem(storyState?: StoryState): string {
  const sharedAxes = storyState
    ? [BOND_AXIS, ...storyState.shared_axes_custom]
    : [BOND_AXIS, 'trust', 'respect']
  const flagsList = storyState?.flags ?? []

  const flagsListing = flagsList.length === 0
    ? '(No flags declared via set_story_state for this story — this field should be filled in by the export agent)'
    : flagsList.map((f) => `- \`flags.${f.name}\` — ${f.desc} (initial: ${f.initial})`).join('\n')

  return `
## State System (Single Character, Three-Layer Structure)

All runtime state fields must be **explicitly declared** in the \`state_schema\` block at the top of \`script.yaml\` — each key with type, default, and desc. See the "state_schema authoring constraints" section in SKILL.md for detailed rules.

State is organized into **three layers**: **shared axes**, **character-specific axes**, and **flags**. In single-character mode there is only one character, but the three-layer structure is still used for consistency with multi-character mode.

### Layer 1: Shared Axes (3 total)

This story's shared axes are \`${sharedAxes.join(' / ')}\`, where \`bond\` is platform-fixed and the other 2 are declared by the export agent via \`set_story_state\`. Schema key format: \`"affinity.<slug>.<axis>"\`.

### Layer 2: Character-Specific Axes (0-2 total)

Emotional or growth dimensions unique to the protagonist. Purely for flavor; they do not participate in cross-character aggregation (not applicable in single-character mode), but can still be used in ending conditions.

### Layer 3: Flags (story-level, predefined)

Key event flags are declared **once** in \`set_story_state\`. **Phase 1 LLM cannot create new flags**.

Flags declared for this story:

${flagsListing}

### Choice State Effects (consequences)

Each scene's \`choices[*].consequences\` **must** only reference fields declared in the \`state_schema\`, and keys must be **copied character-for-character** from the schema.
- \`int\` field values are **deltas** (add/subtract), e.g., \`"affinity.<slug>.bond": -2\`
- \`bool\` field values are **absolute overwrites**, e.g., \`"flags.<name>": true\`

Different choices should produce effects in different directions; avoid having all choices increase the same axis.
`
}

function buildSingleCharacterEnding(): string {
  return `
## Ending Evaluation (Structured DSL)

Each ending's \`condition\` field **must** use the structured DSL (natural language string expressions are not accepted).
See the "endings condition structured DSL" section in SKILL.md for detailed syntax.

Endings are evaluated in array order; the first ending where \`evaluate(condition) === true\` is triggered.
**The last ending must** use \`condition: default\` as the fallthrough.

Format example (in script.yaml):
\`\`\`yaml
endings:
  - id: "ending-trust-route"
    title: "Trust Ending"
    condition:
      all_of:
        - { key: "axes.trust", op: ">=", value: 7 }
        - { key: "flags.shared_secret", op: "==", value: true }
    body: |
      ...

  - id: "ending-understanding"
    title: "Understanding Ending"
    condition:
      { key: "axes.understanding", op: ">=", value: 7 }
    body: |
      ...

  - id: "ending-default"
    title: "Default Ending"
    condition: default
    body: |
      ...
\`\`\`

## Ending Display

Each ending must include:
1. Ending narration and character portrayal (same format as regular scenes)
2. Journey recap data: list final numeric axis values and triggered event flags
3. Preview of all other endings: title + trigger condition summary + one preview line

## Replay Options

Use AskUserQuestion to provide:
- "Start Over" — **reuse the current script**, reset axes and flags to the script's declared \`initial_state\`, clear the current slot's state.yaml, restart from Phase 2's first scene; does not re-enter Phase 0/1 or regenerate the script
- "End Story" — story concludes

To play a completely new script, end the story and restart the skill, then select "Generate New Script" from the Phase -1 menu.
`
}

function formatActOptionsBlock(options: ActOption[]): string {
  return options.map((o) =>
    `  - { acts: ${o.acts}, label_zh: "${o.label_zh}", rounds_total: "${o.rounds_total}", endings_count: ${o.endings_count} }`
  ).join('\n')
}

function formatActOptionsSummary(options: ActOption[], defaultActs: number): string {
  return options.map((o) => {
    const marker = o.acts === defaultActs ? ' [Recommended]' : ''
    return `- **${o.label_zh}** (${o.acts} acts, ${o.rounds_total} rounds, ${o.endings_count} endings)${marker}`
  }).join('\n')
}

function escapeYamlString(s: string): string {
  // Wrap in double quotes and escape embedded double-quotes/backslashes
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function formatUserDirectionBlock(direction: string): string {
  // YAML literal block scalar (|) preserves newlines without escaping
  const indented = direction.split('\n').map((line) => `  ${line}`).join('\n')
  return `user_direction: |\n${indented}\n`
}

/**
 * Render the story_state block as a top-level Markdown section in
 * story-spec.md. Emits a stable, machine-parseable yaml block that
 * Phase -1 validation can re-read to compare against the script's flag
 * set and shared axis names.
 *
 * The format is:
 *
 *   ## Story State
 *
 *   ```yaml
 *   shared_axes_custom: [trust, rivalry]
 *   flags:
 *     - name: illya_acknowledges_sisterhood
 *       desc: "..."
 *       initial: false
 *   ```
 *
 * Phase -1's flag-consistency check only needs the flag `name` list, so
 * any yaml/jsonc reader (or even regex) can recover it.
 */
function formatStoryStateSection(storyState: StoryState): string {
  const axesLine = `shared_axes_custom: [${storyState.shared_axes_custom.join(', ')}]`
  const flagsLines = storyState.flags.length === 0
    ? 'flags: []'
    : 'flags:\n' +
      storyState.flags.map((f) => {
        const escapedDesc = f.desc.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `  - name: ${f.name}\n    desc: "${escapedDesc}"\n    initial: ${f.initial}`
      }).join('\n')
  return `\n## Story State\n\nThis block is declared by the export agent via \`set_story_state\`. When Phase 1 LLM writes the state_schema in script.yaml, it **must** strictly reuse the flag list here (key: \`flags.<name>\`) — no additions, deletions, or renames are allowed. Phase -1 performs consistency validation on load.\n\n\`\`\`yaml\n${axesLine}\n${flagsLines}\n\`\`\`\n`
}

/**
 * Serialize a ProseStyle into a machine-parseable `## 叙事风格锚点` section.
 *
 * Phase 1 / Phase 2 LLM reads this section and must obey:
 * - forbidden_patterns are HARD red lines (always avoid these structures)
 * - ip_specific rules are terminology/register conventions for this story
 * - character_voice_summary (if present) is the primary Chinese voice anchor
 *   for that character, taking precedence over any non-Chinese content in
 *   the source style.md
 */
function formatProseStyleSection(proseStyle: ProseStyle): string {
  const escapeYaml = (s: string): string =>
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

  const forbiddenYaml = proseStyle.forbidden_patterns
    .map(
      (p) =>
        `  - id: ${p.id}\n` +
        `    bad: "${escapeYaml(p.bad)}"\n` +
        `    good: "${escapeYaml(p.good)}"\n` +
        `    reason: "${escapeYaml(p.reason)}"`,
    )
    .join('\n')

  const ipSpecificYaml = proseStyle.ip_specific
    .map((rule) => `  - "${escapeYaml(rule)}"`)
    .join('\n')

  const voiceSummaryYaml =
    proseStyle.character_voice_summary &&
    Object.keys(proseStyle.character_voice_summary).length > 0
      ? '\ncharacter_voice_summary:\n' +
        Object.entries(proseStyle.character_voice_summary)
          .map(([name, summary]) => `  ${name}: "${escapeYaml(summary)}"`)
          .join('\n')
      : ''

  return `\n## Prose Style Anchor\n\nThis block is declared by the export agent via \`set_prose_style\`. Phase 1 when writing \`narration\`/\`dialogue\` and Phase 2 during improvised narration **must** obey forbidden_patterns as hard constraints; ip_specific contains terminology and form-of-address conventions for this story; character_voice_summary (if present) is the Chinese voice anchor for that character, taking precedence over any non-Chinese quotations in style.md.\n\n\`\`\`yaml\ntarget_language: ${proseStyle.target_language}\nvoice_anchor: "${escapeYaml(proseStyle.voice_anchor)}"\nforbidden_patterns:\n${forbiddenYaml}\nip_specific:\n${ipSpecificYaml}${voiceSummaryYaml}\n\`\`\`\n`
}

/**
 * Fallback section used only when StorySpecConfig lacks a prose_style
 * (i.e., legacy archive loaded on the player side). New exports always
 * have prose_style because ExportBuilder.build() throws without it.
 */
function formatProseStyleFallbackSection(): string {
  const top = topForbiddenPatterns(5)
  const fallbackYaml = top
    .map(
      (p) =>
        `  - id: ${p.id}\n` +
        `    bad: "${p.bad.replace(/"/g, '\\"')}"\n` +
        `    good: "${p.good.replace(/"/g, '\\"')}"\n` +
        `    reason: "${p.reason.replace(/"/g, '\\"')}"`,
    )
    .join('\n')
  return `\n## Prose Style Anchor (Fallback)\n\nThis story did not declare a prose style anchor via \`set_prose_style\` (legacy archive). Phase 1/2 LLM uses the following universal Chinese writing constraints as a fallback: all generated Chinese text must avoid these common translatese patterns.\n\n\`\`\`yaml\ntarget_language: zh\nvoice_anchor: "Restrained written Chinese, avoiding literal syntactic projections from English/Japanese"\nforbidden_patterns:\n${fallbackYaml}\n\`\`\`\n`
}

function formatRoutesSection(routeCharacters: RouteCharacter[]): string {
  const charList = routeCharacters
    .map((rc) => `- **${rc.name}** (slug: \`${rc.slug}\`): ${rc.reason}`)
    .join('\n')

  return `
## Routes

This story uses affinity-gate route branching. The following characters were selected as route focus characters by the export agent via \`select_route_characters\`:

${charList}

### Route Structure

- **Common scenes**: Shared by all players in early acts. Choices build affinity toward route characters and set key flags.
- **Gate scene**: A scene with type \`"affinity_gate"\` placed at the branching point. Its \`routing\` array is evaluated in order; the first matching condition determines the player's route. The last entry must use \`condition: "default"\`.
- **Route scenes**: Tagged with a \`route\` field. Each route is a linear sequence of scenes where choices affect affinity for route-specific endings. \`next\` references stay within the same route.
- **Route endings**: Tagged with a \`route\` field. Each route has its own set of endings. Endings without a \`route\` field apply to all routes.

Phase 1 must generate:
1. Common scenes (no \`route\` field)
2. One gate scene (type \`"affinity_gate"\`)
3. Per-route scene sequences (each scene tagged with \`route: "<route_id>"\`)
4. Per-route endings (each ending tagged with \`route: "<route_id>"\`) plus optional universal endings
`
}

export function generateStorySpec(config: StorySpecConfig): string {
  const { story_name, user_direction, genre, tone, constraints, acts_options, default_acts, characters, story_state, prose_style, route_characters } = config

  const isMultiCharacter = !!characters && characters.length > 1

  // Use the smallest endings_count from acts_options as the multi-char min baseline
  const minEndings = acts_options.length > 0
    ? Math.min(...acts_options.map((o) => o.endings_count))
    : 4

  const constraintsBlock = constraints.length > 0
    ? `\n## Additional Constraints\n\n${constraints.map((c) => `- ${c}`).join('\n')}\n`
    : ''

  const charactersFrontmatter = characters && characters.length > 0
    ? `\ncharacters:\n${formatCharactersBlock(characters)}\n`
    : ''

  const actOptionsFrontmatter = `\nacts_options:\n${formatActOptionsBlock(acts_options)}\ndefault_acts: ${default_acts}\n`

  const userDirectionFrontmatter = user_direction && user_direction.trim().length > 0
    ? formatUserDirectionBlock(user_direction.trim())
    : ''

  const storyIdentityBlock = `\n# Story Identity

- **Story Name**: ${story_name}${user_direction && user_direction.trim().length > 0 ? `\n- **User's Original Intent**:\n\n> ${user_direction.trim().split('\n').join('\n> ')}\n` : ''}
`

  const castSection = isMultiCharacter ? buildMultiCharacterRules(characters!) : ''
  const stateSection = isMultiCharacter
    ? buildMultiCharacterStateSystem(characters!, story_state)
    : buildSingleCharacterStateSystem(story_state)
  const endingSection = isMultiCharacter
    ? buildMultiCharacterEnding(characters!, minEndings, story_state)
    : buildSingleCharacterEnding()

  // Machine-parseable story_state block. Always emitted so Phase -1
  // can read it for the flag-consistency check. When story_state is
  // missing (legacy path) we emit an empty placeholder.
  const storyStateSection = story_state
    ? formatStoryStateSection(story_state)
    : '\n## Story State\n\n(This story was not declared via set_story_state. Phase -1 load validation will treat this as legacy — please re-export.)\n'

  // Machine-parseable prose_style block. New exports always have prose_style
  // because ExportBuilder.build() throws without it. The fallback branch
  // only runs for legacy archives loaded on the player side.
  const proseStyleSection = prose_style
    ? formatProseStyleSection(prose_style)
    : formatProseStyleFallbackSection()

  const maxActs = Math.max(...acts_options.map((o) => o.acts), default_acts)

  return `---
story_name: ${escapeYamlString(story_name)}
${userDirectionFrontmatter}genre: ${genre}
tone: ${tone}${actOptionsFrontmatter}${charactersFrontmatter}---
${storyIdentityBlock}
# Seeds

This section is dynamically populated with user seeds collected during Skill runtime Phase 0.
If the user selects "Let fate decide", this section is left empty and generation is fully random.

# Story Length (Selected at Runtime)

Story length is chosen by the user during Phase 0. Available options:

${formatActOptionsSummary(acts_options, default_acts)}

After the user's selection, the engine writes the chosen option's acts to \`state.chosen_acts\`, rounds_total to \`state.rounds_budget\`, and endings_count to \`state.target_endings_count\`. All subsequent structural metrics are based on these runtime values.

## appears_from Truncation Rule

If a character's \`appears_from\` exceeds the user's selected \`chosen_acts\`:
- Truncate to first appearance in the final act (act_{chosen_acts})
- No error; introduce naturally

# Script Generation Rules

## Structural Requirements

- Number of acts: the user's Phase 0 selection via \`state.chosen_acts\`, with 2-4 scenes per act
- Number of endings: at least \`state.target_endings_count\`
- Total interaction rounds: \`state.rounds_budget\`
- Each scene must end with 2-3 choices

## Scene Format

Each scene must contain:

\`\`\`
[narration]
Second-person immersive narration describing the environment, atmosphere, and character states.

[character: {character_name}]
state: the character's current emotional/physical state
attitude: attitude toward the user
key_info: key information this scene must reveal
tone: emotional tone of the dialogue

[choices]
- "Choice text" -> scene:{next_scene_id} | {state effects}
- "Choice text" -> scene:{next_scene_id} | {state effects}
\`\`\`

State effect format examples: \`trust +1, understanding +2\` or \`shared_secret = true\`

## Narrative Constraints

- Genre is "${genre}", overall tone is "${tone}"
- The opening must naturally introduce the encounter between the character and the user
- Choices must produce substantive plot divergence — no converging to the same outcome
- Endings must have distinct emotional tones
- Worldbuilding elements should be woven naturally into scenes, not presented didactically

## Character Constraints

- Character behavior must align with the personality described in souls/{character_name}/identity.md
- Speech patterns must conform to souls/{character_name}/style.md
- Characters do not unconditionally trust the user; trust must be built through choices
${storyStateSection}${proseStyleSection}${castSection}${stateSection}${endingSection}${route_characters && route_characters.length > 0 ? formatRoutesSection(route_characters) : ''}
## Act Transitions

- Every act transition must have transitional narration (summarizing the emotional aftermath of the previous act)
- Transitions should include a reflective choice (does not affect plot direction, but influences the emotional entry point of the next act)

## Prohibited

- Do not generate more than \`state.chosen_acts × 5\` scenes (runtime ceiling)
- Do not generate single-choice scenes (dead ends)
- Do not introduce ending branches before the first \`floor(state.chosen_acts / 2)\` acts
- Do not let characters break the fourth wall
- Static reference: the longest script must not exceed ${maxActs * 5} scenes
${constraintsBlock}`
}
