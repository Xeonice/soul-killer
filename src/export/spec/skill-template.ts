import type { CharacterSpec, ActOption } from './story-spec.js'

/**
 * Engine template version — bump this when engine.md structure changes
 * so the packager / loader can detect stale archives.
 */
export const CURRENT_ENGINE_VERSION = 1

/**
 * `CharacterSpec` extended with the ASCII slug used as the souls/<slug>/
 * directory name inside the archive. The slug is computed by the packager
 * via `formatPathSegment` and threaded through here so SKILL.md path
 * references stay in sync with the actual on-disk layout.
 */
export interface CharacterSpecWithSlug extends CharacterSpec {
  slug: string
}

export interface SkillTemplateConfig {
  skillName: string
  /** Story name provided by the user — used for the intro and references */
  storyName: string
  worldDisplayName: string
  description: string
  /**
   * Multi-character cast with ASCII path slugs. Empty or single = backward-compatible
   * single-character mode. Each character carries `name` (original, possibly CJK)
   * for display and `slug` (ASCII) for file paths.
   */
  characters?: CharacterSpecWithSlug[]
  /** Runtime-selectable length presets */
  acts_options: ActOption[]
  /** Default acts (must be one of acts_options[i].acts) */
  default_acts: number
  /**
   * Phase 1 full-read enforcement anchors. Packager computes these at
   * export time from the in-memory archive map so the SKILL.md Phase 1
   * prompt contains concrete numbers ("N files, ~M KB, < 15% of your 1M
   * context"). Counts every md file the LLM is expected to Read at
   * runtime: souls/, world/, story-spec.md.
   *
   * Optional for backward compatibility: when missing, the template
   * renders a generic fallback budget declaration that still includes
   * the "no offset/limit" constraint but lacks specific numbers.
   */
  expectedFileCount?: number
  expectedTextSizeKb?: number
  /** Route focus characters. When non-empty, SKILL.md Phase 1 uses mandatory route instructions. */
  routeCharacters?: Array<{ slug: string; name: string }>
}

/** Phase 1 full-read enforcement — budget anchor options. */
interface ReadBudgetOptions {
  expectedFileCount?: number
  expectedTextSizeKb?: number
}

/**
 * Render the "Context Budget and Full-Read Enforcement" declaration that sits at the top of the
 * Phase 1 read-data section. Tells the LLM explicitly how much content it's
 * expected to consume and gives it authorization to stop being frugal.
 *
 * When packager doesn't pass budget numbers (backward compat), renders a
 * generic version without specific counts but still with the no-offset /
 * no-limit hard constraint.
 */
function buildReadBudgetDeclaration(opts: ReadBudgetOptions): string {
  const hasNumbers =
    typeof opts.expectedFileCount === 'number' &&
    typeof opts.expectedTextSizeKb === 'number'
  if (hasNumbers) {
    return `## Context Budget and Full-Read Enforcement (Hard Constraint)

This phase requires reading approximately **${opts.expectedFileCount} files / ~${opts.expectedTextSizeKb} KB of text**. You are using Claude Opus (1,000,000 token context window), and this read volume is **under 15% of your budget**.

**All Read calls MUST NOT use \`offset\` or \`limit\` parameters**. Every file must be read in full.

Do not defensively conserve tokens — this is expected behavior, the packager has already computed the budget.

If you used \`lines 1-50\` or any pagination parameters in a Read call, you are incorrectly being frugal. **Immediately re-Read that file without any parameters**.
`
  }
  return `## Context Budget and Full-Read Enforcement (Hard Constraint)

This phase requires reading multiple files to collect character personality, worldview, and script specifications. Your context window is large enough to contain all content.

**All Read calls MUST NOT use \`offset\` or \`limit\` parameters**. Every file must be read in full.

Do not defensively conserve tokens — this is expected behavior.
`
}

function buildMultiCharacterEngine(
  characters: CharacterSpecWithSlug[],
  budget: ReadBudgetOptions = {},
): string {
  const charNames = characters.map((c) => c.name).join(', ')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]!.name
  // Path references use the ASCII slug (which is the actual on-disk
  // directory name); display strings use the original character name.
  const soulsList = characters.map((c) => `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/identity.md\` (${c.name})\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/style.md\`\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/capabilities.md\` (if present)\n   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/milestones.md\` (if present)\n   - All files under \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/behaviors/\``).join('\n')

  const initialState = characters.map((c) => {
    const axes = c.axes.map((a) => `      ${a.english}: ${a.initial}`).join(',\n')
    return `    "${c.name}": {\n${axes}\n    }`
  }).join(',\n')

  return `# Phase 1: Generate Multi-Character Script and Persist

This script features ${characters.length} core characters: ${charNames}.

${buildReadBudgetDeclaration(budget)}

## Phase 0 Contamination Fix (Mandatory)

Phase 0 likely only Read the first 50 lines of \`story-spec.md\` to extract \`acts_options\`. However, the **Story State section, Prose Style Anchor section, and characters configuration** are further down in the file. Phase 0's partial read did not include this critical information.

**As the very first action of Phase 1**, re-Read the entire \`\${CLAUDE_SKILL_DIR}/story-spec.md\` **without offset/limit parameters**. Even if you think "story-spec.md is already in context", you must re-Read it — the previous read was partial and incomplete.

## Required Reading List

1. Each character's personality files (every file must be Read in full, without offset/limit):
${soulsList}
2. Read all .md files under \`\${CLAUDE_SKILL_DIR}/world/\` dimension subdirectories (geography, factions, systems, society, culture, species, figures, atmosphere, history) — the worldview. Skip \`_\`-prefixed files (author-view), and exclude the \`history/events/\` subdirectory and the \`history/timeline.md\` file (they are read separately below)
3. Read \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\` (if present) — world chronicle single file (split by \`## \` headings, each section is a time-anchored event)
4. Read all files under \`\${CLAUDE_SKILL_DIR}/world/history/events/\` (if present) — world chronicle details (full descriptions of major events)
5. Re-Read the complete \`\${CLAUDE_SKILL_DIR}/story-spec.md\` (see "Phase 0 Contamination Fix" above)

When reading worldview files, first use \`Glob ${"${CLAUDE_SKILL_DIR}/world/**/*.md"}\` to list all files, then call Read on each one (without offset/limit) to ensure nothing is missed.

Using the above materials and the seeds collected from the user in Phase 0 (if any), create a complete multi-character visual novel script following story-spec.md's specifications.

**Chronicle Consistency Requirements**:
- All time anchors referenced in the script (years, eras, battle numbers, etc.) must match the \`display_time\` in \`history/timeline.md\` sections
- Do not fabricate event details that conflict with \`history/events/\` descriptions
- If the script takes place in a specific time period, explicitly mark its position relative to the chronicle timeline (e.g., "five years after the Arasaka Tower bombing")

The script must follow story-spec.md's:
- Multi-character cast scheduling rules (each scene must explicitly tag which characters are present)
- Choice tradeoff constraints (each choice must produce differentiated effects on different characters)
- Character appearance timing (${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').map((c) => `${c.name} starting from ${c.appears_from}`).join(', ') || 'all characters present throughout'})

## Script Building (Incremental)

Script generation uses an incremental plan-then-build approach. You do NOT write the complete script in a single call. Instead:

1. Write a **plan** (narrative blueprint, no scene text) -> validate with CLI
2. Write each **scene** individually -> validate with CLI
3. Write each **ending** individually -> validate with CLI
4. CLI **builds** the final script.json from all pieces

Build directory: \`\${CLAUDE_SKILL_DIR}/runtime/scripts/.build-<id>/\`
Final output: \`\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json\`

\`<id>\` is an 8-character short hash generated from the current timestamp and user_direction summary.

## Phase 1 Creation Steps

**Step 0: Data Loading Report (Mandatory)**

Complete **all** Read calls from the "Required Reading List" above (without offset/limit), then output a **loading report** in the following format:

\`\`\`markdown
# Data Loading Report

| Category | File | Lines |
|---|---|---|
| story | story-spec.md | 245 |
| soul:${characters[0]!.slug} | identity.md | 120 |
| soul:${characters[0]!.slug} | style.md | 85 |
| soul:${characters[0]!.slug} | capabilities.md | (not present) |
| soul:${characters[0]!.slug} | milestones.md | 60 |
| soul:${characters[0]!.slug} | behaviors/honor-code.md | 45 |
| ... | ... | ... |
| world | geography/overview.md | 80 |
| world | factions/...  | ... |
| chronicle | history/timeline.md | ... |
| chronicle | history/events/...  | ... |
\`\`\`

Rules:
- Each character's identity / style / capabilities / milestones / each behaviors/*.md must have its own row
- For optional files that truly do not exist, write \`(not present)\` in the lines column
- Line counts must be the actual number of lines you Read (this is mandatory proof that you performed full reads)
- World dimension files and chronicle files must also be listed individually
- This report is **planning output for your own use** — no need to explain it to the user

If any single item in the report has a suspiciously low line count (e.g., identity.md with only 30 lines), you most likely used \`offset/limit\` parameters by mistake. Immediately re-Read that file (without any pagination parameters) and update the report.

**You may only proceed to Step 1 after the report is fully output**.

**Step A: Plan**

**Precondition check**: If you have not yet output Step 0's data loading report, **stop immediately and go back to do Step 0**.

Design the narrative blueprint. This is structure only — no scene text.

1. Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`, locate the **Story State** section, and extract:
   - \`shared_axes_custom: [a, b]\` — the story's 2 story-level shared axis names (plus \`bond\` which is platform-fixed)
   - \`flags: [...]\` — the story's key event flag list
2. Design state_schema following the "state_schema Creation Constraints" section above:
   - **Layer 1: Shared axes (3 per character, no opt-out)**: \`"affinity.<char_slug>.bond"\`, \`"affinity.<char_slug>.<a>"\`, \`"affinity.<char_slug>.<b>"\`. Each field includes desc / type=int / range=[0, 10] / default. **default**: Read story-spec's \`characters[i].shared_initial_overrides\`. If a character has an override for that axis, use the override value; otherwise use the global default of 5
   - **Layer 2: Character-specific axes (from story-spec's \`characters[i].axes\` list)**: 0-2 per character, each translated to \`"affinity.<char_slug>.<axis.english>"\`. Each field includes desc / type=int / range=[0, 10] / default=axis.initial
   - **Layer 3: Flags (copied verbatim from story-spec's Story State)**: Every flag in story-spec must have a corresponding \`"flags.<name>"\` field. You **must not** add, remove, or rename flags
3. Write initial_state (field set strictly == state_schema)
4. **MANDATORY PREP: Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`, locate the "Prose Style Anchor" section, and absorb every \`forbidden_patterns\` and \`ip_specific\` entry**. These are hard constraints on this story's text, not suggestions. If story-spec contains a fallback section (legacy), use the fallback's generic anti-pattern library as constraints.
5. Plan the narrative arc, act structure, and character arcs
6. For each scene: write outline, cast, emotional_beat, choices (id/text/intent/next), continuity, context_refs
   - **choices <= 3 per scene** (the CLI will reject more than 3)
   - context_refs: list scene-ids that this scene needs to reference for narrative callbacks (non-predecessor scenes only; predecessors are auto-computed)
   - Every \`choice.consequences\` key must be **character-for-character copied** from state_schema (exact literal string match). Values must conform to schema.type semantics (int = delta, bool/enum/string = absolute overwrite). **Flag references must strictly be within story-spec's flags whitelist**
   - Character appearance timing: ${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').map((c) => `${c.name} starting from ${c.appears_from}`).join(', ') || 'all characters present throughout'}
7. For each ending: write id, title, condition, intent (NO body — that comes later)
   - Each ending's \`condition\` must use the format from the "Endings Condition Structured DSL" section above. Every key referenced in a condition must exist in state_schema
   - **The last ending must** use \`condition: default\` as the fallthrough
   - Cross-character aggregation (\`all_chars\` / \`any_char\`) \`axis\` may only be a shared axis (bond or one of the 2 from story-spec's shared_axes_custom)

**Route Structure (if story-spec defines routes):**
- Common route scenes: shared by all players, choices build affinity + set key flags
- Gate scene: type \`"affinity_gate"\` with routing conditions (affinity thresholds + flag checks)
  - Routing entries evaluated in order, first match wins
  - Last entry must be \`condition: "default"\`
  - Each routing entry has route_id + condition + next
- Route scenes: tagged with \`route\` field, linear within each route (choices affect affinity for endings, \`next\` stays within route)
- Route endings: tagged with \`route\` field, each route has its own endings

In the plan's scenes, the gate scene looks like:
\`\`\`json
{
  "scene-gate": {
    "type": "affinity_gate",
    "outline": "Route branching point",
    "routing": [
      { "route_id": "route-a", "condition": { "all_of": ["..."] }, "next": "scene-a01" },
      { "route_id": "route-b", "condition": "default", "next": "scene-b01" }
    ]
  }
}
\`\`\`

8. Write the plan to \`.build-<id>/plan.json\`
9. Call \`soulkiller runtime script plan <id>\`
10. The CLI will:
    - Validate JSON syntax, schema, graph integrity
    - Auto-compute predecessors and is_convergence for each scene
    - Compute generation_order (topological sort)
    - Write the enriched plan back
11. Read PLAN_OK output: note generation_order and convergence_points
12. If error -> read error message -> fix plan -> re-Write -> retry

**Step B: Generate Scenes (in generation_order)**

Generate each scene following the order from PLAN_OK. For each scene-id:

1. Read \`.build-<id>/plan.json\`:
   - This scene's outline, cast, emotional_beat, choices
   - narrative.character_arcs for characters in this scene
   - This scene's is_convergence flag
2. Read all predecessor scenes: \`.build-<id>/scenes/<pred>.json\` for each pred in this scene's predecessors
3. Read context_refs scenes: \`.build-<id>/scenes/<ref>.json\` for refs not already in predecessors
4. **If is_convergence == true**: This scene is reached from multiple paths. Your narration MUST NOT reference events or dialogue from any specific predecessor. Write path-neutral prose.
5. **Gate scenes** (type \`"affinity_gate"\`): auto-generated from the plan. Write the routing JSON only — no narration text needed (optional short narration is allowed). The gate's \`routing\` array is copied verbatim from plan.json.
6. Generate the scene JSON:
   \`\`\`json
   {
     "text": "full narration + dialogue",
     "choices": [
       { "id": "c1", "text": "option text", "consequences": { "affinity.<char_slug>.trust": 2 }, "next": "scene-002" }
     ]
   }
   \`\`\`
   - **Prose constraints**: narration and dialogue must comply with prose_style:
     - Every \`bad\` pattern in \`forbidden_patterns\` is a hard red line that must not appear
     - \`ip_specific\` defines terminology and naming conventions that must be followed when writing for the corresponding character
     - If a character has a \`character_voice_summary\`, use that summary as the voice anchor, taking priority over non-target-language source text in style.md
6. Write to \`.build-<id>/draft/<scene-id>.json\`
7. Call \`soulkiller runtime script scene <id> <scene-id>\`
8. If error -> read error -> fix draft -> re-Write -> retry (max 3 times)

**Step C: Generate Endings (after ALL scenes)**

After every scene is generated, create ending bodies based on actual scene content:

1. For each ending in plan:
   - Read plan.json for this ending's intent and condition
   - Read character_arcs to find key_scenes for relevant characters
   - Read those key_scenes from \`.build-<id>/scenes/\`
   - Generate the ending body based on intent + actual scene content
2. Write to \`.build-<id>/draft/<ending-id>.json\`:
   \`\`\`json
   { "id": "ending-A", "title": "...", "condition": {...}, "body": "ending narration..." }
   \`\`\`
3. Call \`soulkiller runtime script ending <id> <ending-id>\`
4. If error -> fix -> retry

**Step D: Build**

Call \`soulkiller runtime script build <id>\`

This merges plan + scenes + endings into \`runtime/scripts/script-<id>.json\` and cleans up the build directory. The final format is identical to a standard script.json.

**Step E: Self-Check (Simplified)**

Most validation is already done incrementally by the CLI. Only two checks remain:

- **Prose style verification**: Re-read story-spec.md's forbidden_patterns. Scan your generated scene text for violations. If found, use Edit to fix the scene files before they were built (note: after build, the source scenes are cleaned up — if prose issues are found, you must rebuild).
- **Data coverage**: Verify source material coverage matches Step 0's loading report.

After self-check passes, enter Phase 2.

# Phase 2: Run Multi-Character Story

Once the script is ready, proceed directly to the first scene.

## Prose Style Constraints (Hard Constraints on All Phase 2 Output)

**Before outputting any text**, you must first check against the "Prose Style Anchor" section of \`\${CLAUDE_SKILL_DIR}/story-spec.md\`:

- Every \`bad\` pattern in \`forbidden_patterns\` **must be avoided**. If any passage contains a similar structure -> replace it with the corresponding \`good\` form before outputting.
- Every rule in \`ip_specific\` **must be followed**: term preservation, naming conventions, metaphor pool constraints.
- \`character_voice_summary\` (if present for a character) is that character's **voice anchor**, taking priority over non-target-language source text that may exist in \`souls/{character}/style.md\`. Characters without a summary continue to use style.md.
- If story-spec contains a "Prose Style Anchor (fallback)" section (legacy archive), use the fallback's generic anti-pattern library as hard constraints.

Most common patterns that slide toward translatese (highest priority to avoid):
1. **Measurement clauses**: over-literal degree expressions -> break into short sentences
2. **Possessive parallel structures**: "My A. My B. My C." -> drop the possessive after the first
3. **Literal metaphor translation**: choosing the wrong concrete noun -> pick an idiomatic image
4. **Literal gesture translation**: over-literal body language -> use natural expressions
5. **Literal negation**: flat negation -> use concrete metaphor

## Scene Rendering Rules

For each scene you must output:
1. **Narration** — immersive second-person description (strictly following prose style constraints)
2. **Multi-character performance** — present dialogue and actions for each character listed in the scene's cast, in sequence or interleaved
   - Each character's speech style must follow the corresponding \`souls/{character}/style.md\` (layered with prose_style constraints)
   - Characters with \`character_voice_summary\` use the summary as their voice anchor
   - Narration may be interspersed between different characters' dialogue
   - Characters not present in the scene do not participate in dialogue

Then use AskUserQuestion to present choices:
- question: situational prompt for the current scene
- options: the script's choices for this scene (**choices <= 3 per scene**) **+ append "💾 Save current progress" at the end**
- multiSelect: false

## State Tracking Rules (Multi-Character)

You must internally maintain a state object in the following format:
\`\`\`
{
  affinity: {
${initialState}
  },
  flags: {
    // defined by the Phase 1 generated script
  }
}
\`\`\`

### Choice Effect Rules

- After the user makes a choice, update the state object according to the consequences tagged on that choice in the script
- A single choice can affect **multiple characters'** affinity axes simultaneously
- Different choices must produce **differentiated** effects on different characters (this is a hard constraint from story-spec)
- **Never** reveal state values or event flags to the user — state is implicit
- State affects each character's attitude, dialogue tone, and reactions in subsequent scenes

### When a Character Is Absent

- Absent characters' affinity axes are not affected by choices in the current scene
- However, flags are global and can be triggered by any scene

## Scene Transition Rules

- User selects a story choice -> call \`soulkiller runtime apply <script-id> <scene-id> <choice-id>\` to let the script handle all state transitions (auto-save) -> **immediately render the next scene** (no pausing, no "continue?" prompts, no save details shown)
- User selects "💾 Save current progress" -> call \`soulkiller runtime save <script-id>\` to create a manual save -> after confirmation, re-present the same AskUserQuestion (with original choices + 💾). See "Manual Save" section above
- User enters free text -> respond in character as the most contextually relevant present character,
  then re-present AskUserQuestion with the same scene's choices + 💾 (no transition, no state change, no save written, **do not call state apply**)
- Reaching the ending stage -> enter the ending determination flow (per the "Endings Condition Structured DSL" section's evaluate algorithm)

### Affinity Gate Handling

When the current scene has type \`"affinity_gate"\`:
1. If the gate has text, render it as narration
2. Call \`soulkiller runtime route <script-id> <gate-scene-id>\`
3. Parse output: \`ROUTE <route_id> → <next-scene-id>\`
4. Narrate the route entry naturally (e.g., a brief transition sentence fitting the story mood)
5. Immediately render the next scene (no AskUserQuestion for gates — gates are automatic transitions)

### You Only Stop Rendering in 4 Situations

1. **After rendering a scene**: call AskUserQuestion presenting **script's native choices + 💾 Save current progress**, wait for user selection
2. **User selects 💾 save**: execute manual save flow, then re-present the same AskUserQuestion
3. **User triggers free-text response**: respond, then AskUserQuestion again (same scene, with 💾)
4. **Reaching an ending node**: enter Phase 3 via the ending determination flow

**Any other "mid-stream pause" is an error**. Specifically:
- Do not pause because "the response seems too long"
- Do not insert "continue?" or similar meta-confirmations between scenes
- Do not expose save write details, scene IDs, or "now entering Act N" progress indicators to the user
- Rendering multiple consecutive scenes is **normal behavior**, as long as each scene ends with AskUserQuestion presenting script choices + 💾

## apply_consequences Standard Flow (via state apply script)

**Core contract**: delta calculation, clamping, type validation, and transactional writes to auto/ directory's state.yaml + meta.yaml are **all handled internally by \`soulkiller runtime apply\`**. You do not need to calculate any deltas, construct Edit old_strings, or maintain a literal representation of state. Your only responsibilities are:

1. Receive the user's choice (choice id)
2. Call state apply once
3. Read the script's stdout change summary to inform the next scene's transition narration
4. Render the next scene

### Standard Call

\`\`\`bash
soulkiller runtime apply <script-id> <current-scene-id> <choice-id>
\`\`\`

- \`<script-id>\` is the current script's id (determined in Phase -1, constant throughout Phase 2)
- \`<current-scene-id>\` is the id of the scene **currently being played** (not the next one)
- \`<choice-id>\` is the id of the choice the user selected (from scene.choices[i].id)

### stdout Output Format

After successful execution, the script outputs something like:

\`\`\`
SCENE  scene-005 → scene-007
CHANGES
  affinity.judy.trust  3 → 5
  flags.met_johnny  false → true
\`\`\`

- The first line's \`SCENE\` tells you the next scene id (use this for rendering)
- \`CHANGES\` lists all fields affected by consequences (oldValue → newValue)
- If an int was clamped, the line ends with \`(clamped)\`
- If consequences is empty, it shows \`CHANGES (none)\`

### Prohibited Actions (Hard Red Lines)

- **Never** use the Edit tool to directly modify \`state.yaml\` or \`meta.yaml\`
- **Never** use the Write tool to directly rewrite \`state.yaml\` or \`meta.yaml\`
- **Never** pre-calculate new state values in memory and then reconcile against script output — trust the script
- **Never** skip state apply and render the next scene directly (this causes state drift)

If state apply returns a non-zero exit code (stderr will print an error message), **do not** attempt to manually fix state.yaml. Instead:
- Parse stderr and tell the user "Failed to apply scene state: {reason}"
- Let the user choose "Retry" / "Cancel this choice and return to options"

### First Scene Entry (Phase 2 Startup)

When entering Phase 2 for the first time, call **init** instead of apply:

\`\`\`bash
soulkiller runtime init <script-id>
\`\`\`

The script internally writes auto/state.yaml from script.initial_state and initializes auto/meta.yaml in one pass. (Phase -1's "restart from beginning" or "no-save script" entry point already called init on that path — Phase 2 can start rendering directly.)

**Before rendering the first scene**, call \`soulkiller runtime viewer tree <script-id>\` to start the branch tree visualization server. Parse VIEWER_URL from stdout and inform the user:
"分支线可视化已就绪：<VIEWER_URL> — 在浏览器中打开即可实时查看选择路径。"

Then begin rendering the first scene.

## Character Entrance Rules

${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').length > 0
  ? characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').map((c) =>
    `- **${c.name}** appears starting from ${c.appears_from}; their first appearance must have a natural introduction (a focused entrance narration for that character)`
  ).join('\n')
  : 'All characters are present from the start of the story.'}

## Act Transition Rules

When the story advances from one Act to the next:
1. Output a transition text block (using ━ separator line + centered Act title + atmospheric narration)
2. If new characters are about to appear, foreshadow them in the transition block
3. Use AskUserQuestion to present a "reflective choice":
   - question: an introspective question
   - options: 2-3 emotional/thought directions
   - This choice does not change the plot direction but affects each character's attitude toward you at the start of the next act
4. After the user chooses, enter the first scene of the next Act

## Capability Reference Rules

When the user asks about a character's abilities, skills, equipment, or expertise,
read \`\${CLAUDE_SKILL_DIR}/souls/{character}/capabilities.md\` to answer.
A character's demonstrated behavior and abilities must not exceed what is described in capabilities.md.

## Timeline Reference Rules

When the user asks about a character's experiences, past events, or historical events,
read \`\${CLAUDE_SKILL_DIR}/souls/{character}/milestones.md\` to answer.
Characters only know events recorded in milestones.md.

## Character Relationship Reference Rules

When a scene involves relationship dynamics between characters,
read \`\${CLAUDE_SKILL_DIR}/souls/{character}/behaviors/relationships.md\` to understand a character's attitudes and interaction patterns with other characters.

## World Lore Reference Rules

When a scene involves specific locations, organizations, events, or other worldview knowledge,
read relevant .md files from dimension subdirectories under \`\${CLAUDE_SKILL_DIR}/world/\` to fill in details (skip \`_\`-prefixed files and \`history/events/\`, \`history/timeline.md\`).
Weave details naturally into narration and character dialogue — do not present them didactically.

## Ending Determination Rules

When reaching the final stage of the story, match endings based on accumulated multi-character affinity state:
- Read \`meta.yaml\`'s \`current_route\` field (if present). Only evaluate endings whose \`route\` field matches \`current_route\`. If no \`route\` field exists on an ending, it applies to all routes
- Check each eligible ending's trigger condition from highest to lowest priority as defined in the script
- Conditions may involve combinations of multiple characters' affinity axes and flags
- The first satisfied condition triggers the corresponding ending
- If no condition is met, trigger the default ending (the last one)

# Phase 3: Ending Gallery

When an ending is reached, present in the following order:

## 1. Ending Performance

Ending narration + full character performances by present characters (same format as regular scenes).

## 2. Journey Recap

Display each character's final affinity axis values grouped by character:

\`\`\`
${characters.map((c) => {
  const exampleAxis = c.axes[0]
  return `${c.name}:\n${c.axes.map((a) => `  ${a.name.padEnd(8)} {bar} {value}/10`).join('\n')}`
}).join('\n\n')}
\`\`\`

Progress bar format: each axis uses \`'█'.repeat(value) + '░'.repeat(10-value)\`.

## 3. Key Event Markers

\`\`\`
{event_name} ✓  (triggered)
{event_name} ✗  (not triggered)
\`\`\`

## 4. Ending Gallery (All Endings)

List **all** endings, each containing:
- Title (achieved marked with ★, unachieved marked with ☆)
- Human-readable description of trigger conditions (e.g., "Requires ${protagonist}.trust >= 7 and shared_secret is true")
- One preview line (the first sentence of that ending)

Format example:
\`\`\`
★ {achieved ending title} (achieved)
  "{first sentence of ending}"

☆ {unachieved ending title} (not achieved)
  Condition: {readable condition description}
  "{first sentence of ending}"
\`\`\`

## 5. Replay Options

Use AskUserQuestion to offer:
- "Start over" — reuse the current script, reset state, restart from the first scene
- "End story" — conclude the story

# Replay Rules

When the user selects "Start over", you **must** call the state CLI's reset subcommand to perform the full reset:

\`\`\`bash
soulkiller runtime reset <script-id>
\`\`\`

The script internally handles:
- Reuses the current script (read from meta.yaml.script_ref) — does not regenerate the script
- Overwrites state.yaml in one pass from script.initial_state, restoring all fields to initial values
- Sets meta.yaml.current_scene to the first scene id
- Atomic transaction: both state.yaml and meta.yaml are either both reset or neither is changed

After reset succeeds:
- Jump directly to Phase 2's **first scene** and continue running
- **Do not** return to Phase 0 or Phase 1, **do not** regenerate the script
- **Do not** manually reset state.yaml using Read / Edit / Write — only use state reset

If the user wants to play an entirely new story (not replay the current script), guide them to end the current story and restart the skill, entering the Phase -1 menu to select "Generate new script".

# Prohibited Actions

## Story Structure
- Do not skip scenes
- Do not fabricate branches not in the script
- Do not break the fourth wall
- Do not advance the plot outside of choices
- Do not let all choices produce the same directional effect on all characters (violates the tradeoff constraint)
- Do not let absent characters participate in dialogue
- Each AskUserQuestion cycle renders **one** scene only: finish that scene's narration + dialogue -> call AskUserQuestion presenting that scene's choices -> wait for user selection. After the user chooses, **immediately** begin rendering the next scene without stopping

## Control Flow Self-Pausing (Strictly Prohibited)
- **Never** insert "continue?", "next step", "shall I expand scene-X?" or similar meta-confirmations
- **Never** self-rate-limit because "the response seems too long" / "to avoid verbosity" / "let me pause here". Length is not your decision axis; scene boundaries are
- **Never** mix control flow options like "Continue" / "Status" / "Next step" into AskUserQuestion options. Options **must be** a verbatim copy of the current scene's script choices array **+ "💾 Save current progress"** (the only allowed non-script option)
- **Never** stop writing after apply_consequences completes without rendering the next scene. apply_consequences -> render next scene is **a single atomic action**
- **Never** omit the "💾 Save current progress" option. Every AskUserQuestion **must** include this option at the end

## Progress/Save Exposure (Fourth Wall)
- **Never** show the user "story has entered Act N" / "mid-Act 3" / "X% complete" or similar progress indicators
- **Never** show the user scene IDs ("scene-007" / "current scene: scene-X") or save write details ("save written to auto/"). Saves and scene transitions are **background operations** the user does not need to see
- **Never** prefix scene output with "story state update" / "Act title" or similar meta-framework labels, except for the Act transition block (see Act Transition Rules above)
- Do not reveal state values or state field names to the user during the story
- Do not mention flags / affinity / consequences as mechanism terms in narration

## Chatbot-Style Meta-Narration
- Do not use transitions like "The above was X, now let me..." / "Let's move to the next scene" / "I will now perform..."
- Do not use self-referential phrases like "As this character, my response is..."
- Narration enters the scene directly without preamble or epilogue

## Option Label Contamination
- AskUserQuestion option text **must be** a verbatim copy of script choices[i].text (except the 💾 option)
- **Do not** add suffix hints to option text, such as "(friendly route)", "(will increase trust)", "(choose carefully)"
- **Do not** hint at an option's consequences

## Direct State File Writes (Hard Red Line)
- **Never** use the Edit tool to directly modify \`runtime/saves/<script-id>/auto/state.yaml\`
- **Never** use the Edit tool to directly modify \`runtime/saves/<script-id>/*/meta.yaml\`
- **Never** use the Write tool to directly rewrite \`state.yaml\` or \`meta.yaml\`
- **All** state writes must go through \`soulkiller runtime {init,apply,reset,rebuild,save}\`
- Even if you see a field in state.yaml that is "obviously wrong", you may only use \`state rebuild\` or \`state reset\` — direct Edit will lock the error into the file
`
}

function buildSingleCharacterEngine(
  storyName: string,
  worldDisplayName: string,
  /**
   * ASCII slug used as the souls/<slug>/ directory name in the archive.
   * Computed by the formatter to guarantee Anthropic Skill spec compliance.
   */
  soulSlug: string,
  /**
   * Original (possibly CJK) display name shown to the user. Never used in
   * file paths — only in human-readable text.
   */
  soulDisplayName: string,
  budget: ReadBudgetOptions = {},
): string {
  return `# Phase 1: Generate Script and Persist

Protagonist: **${soulDisplayName}** (path slug: \`${soulSlug}\`)

${buildReadBudgetDeclaration(budget)}

## Phase 0 Contamination Fix (Mandatory)

Phase 0 likely only Read the first 50 lines of \`story-spec.md\` to extract \`acts_options\`. However, the **Story State section and Prose Style Anchor section** are further down in the file. Phase 0's partial read did not include this critical information.

**As the very first action of Phase 1**, re-Read the entire \`\${CLAUDE_SKILL_DIR}/story-spec.md\` **without offset/limit parameters**. Even if you think "story-spec.md is already in context", you must re-Read it — the previous read was partial and incomplete.

## Required Reading List

Every file must be Read in full, **without offset/limit**:

1. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/identity.md\` — character personality
2. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/style.md\` — character expression style
3. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/capabilities.md\` (if present) — character abilities, skills, equipment
4. \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/milestones.md\` (if present) — character timeline, key events
5. All files under \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/behaviors/\` — behavior patterns (Glob first, then Read each)
6. All .md files under dimension subdirectories of \`\${CLAUDE_SKILL_DIR}/world/\` (geography, factions, systems, society, culture, species, figures, atmosphere, history) — the worldview. Skip \`_\`-prefixed files (author-view), and exclude the \`history/events/\` subdirectory and the \`history/timeline.md\` file (they are read separately below)
7. \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\` (if present) — world chronicle single file (split by \`## \` headings, each section is a time-anchored event)
8. All files under \`\${CLAUDE_SKILL_DIR}/world/history/events/\` (if present) — world chronicle details
9. Re-Read the complete \`\${CLAUDE_SKILL_DIR}/story-spec.md\` (see "Phase 0 Contamination Fix" above)

When reading worldview files, first use \`Glob ${"${CLAUDE_SKILL_DIR}/world/**/*.md"}\` to list all files, then call Read on each one (without offset/limit) to ensure nothing is missed.

Using the above materials and the user_direction collected in Phase 0 (if any), create a complete visual novel script following story-spec.md's specifications.

**Chronicle Consistency Requirements**:
- All time anchors referenced in the script (years, eras, battle numbers, etc.) must match the \`display_time\` in \`history/timeline.md\` sections
- Do not fabricate event details that conflict with \`history/events/\` descriptions

## Script Building (Incremental)

Script generation uses an incremental plan-then-build approach. You do NOT write the complete script in a single call. Instead:

1. Write a **plan** (narrative blueprint, no scene text) -> validate with CLI
2. Write each **scene** individually -> validate with CLI
3. Write each **ending** individually -> validate with CLI
4. CLI **builds** the final script.json from all pieces

Build directory: \`\${CLAUDE_SKILL_DIR}/runtime/scripts/.build-<id>/\`
Final output: \`\${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json\`

\`<id>\` is an 8-character short hash generated from the current timestamp and user_direction summary.

For detailed schema declaration rules, naming constraints, and type sets, see the "state_schema Creation Constraints" section above.
For the complete condition DSL syntax, see the "Endings Condition Structured DSL" section above.

## Phase 1 Creation Steps

**Step 0: Data Loading Report (Mandatory)**

Complete **all** Read calls from the "Required Reading List" above (without offset/limit), then output a **loading report** in the following format:

\`\`\`markdown
# Data Loading Report

| Category | File | Lines |
|---|---|---|
| story | story-spec.md | 245 |
| soul | souls/${soulSlug}/identity.md | 120 |
| soul | souls/${soulSlug}/style.md | 85 |
| soul | souls/${soulSlug}/capabilities.md | (not present) |
| soul | souls/${soulSlug}/milestones.md | 60 |
| soul | souls/${soulSlug}/behaviors/honor-code.md | 45 |
| ... | ... | ... |
| world | geography/overview.md | 80 |
| chronicle | history/timeline.md | ... |
\`\`\`

Rules:
- identity / style / capabilities / milestones / each behaviors/*.md must have its own row
- For optional files that truly do not exist, write \`(not present)\` in the lines column
- Line counts must be the actual number of lines you Read (mandatory proof that you performed full reads)
- This report is **planning output for your own use** — no need to explain it to the user

If any single item has a suspiciously low line count (e.g., identity.md with only 30 lines), you most likely used \`offset/limit\` parameters by mistake. Immediately re-Read that file (without any pagination parameters) and update the report.

**You may only proceed to Step 1 after the report is fully output**.

**Step A: Plan**

**Precondition check**: If you have not yet output Step 0's data loading report, **stop immediately and go back to do Step 0**.

Design the narrative blueprint. This is structure only — no scene text.

1. Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`'s Story State section to extract:
   - \`flags\` list (name / desc / initial) — this is the flag whitelist you can use
   - Translate axes from story-spec into \`axes.<axis>\` or \`affinity.<character>.<axis>\` schema fields
   - Copy every flag declared in Story State verbatim to state_schema's \`flags.<name>\` (**no more, no fewer**)
   - Strictly follow the naming rules and type set from the "state_schema Creation Constraints" section above
2. Write initial_state (field set strictly == state_schema)
3. **MANDATORY PREP: Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`, locate the "Prose Style Anchor" section, and absorb every \`forbidden_patterns\` and \`ip_specific\` entry**. These are hard constraints on this story's text, not suggestions. If story-spec contains a fallback section (legacy), use the fallback's generic anti-pattern library as constraints.
4. Plan the narrative arc, act structure, and character arcs
5. For each scene: write outline, cast, emotional_beat, choices (id/text/intent/next), continuity, context_refs
   - **choices <= 3 per scene** (the CLI will reject more than 3)
   - context_refs: list scene-ids that this scene needs to reference for narrative callbacks (non-predecessor scenes only; predecessors are auto-computed)
   - Every \`choice.consequences\` key must be **character-for-character copied** from state_schema. Values must conform to schema.type (int = delta, bool/enum/string = overwrite). **Flag references must strictly be within story-spec's flags whitelist**
6. For each ending: write id, title, condition, intent (NO body — that comes later)
   - Each ending's \`condition\` must use the format from the "Endings Condition Structured DSL" section above
   - **The last ending must** use \`condition: default\` as the fallthrough

**Route Structure (if story-spec defines routes):**
- Common route scenes: shared by all players, choices build affinity + set key flags
- Gate scene: type \`"affinity_gate"\` with routing conditions (affinity thresholds + flag checks)
  - Routing entries evaluated in order, first match wins
  - Last entry must be \`condition: "default"\`
  - Each routing entry has route_id + condition + next
- Route scenes: tagged with \`route\` field, linear within each route (choices affect affinity for endings, \`next\` stays within route)
- Route endings: tagged with \`route\` field, each route has its own endings

In the plan's scenes, the gate scene looks like:
\`\`\`json
{
  "scene-gate": {
    "type": "affinity_gate",
    "outline": "Route branching point",
    "routing": [
      { "route_id": "route-a", "condition": { "all_of": ["..."] }, "next": "scene-a01" },
      { "route_id": "route-b", "condition": "default", "next": "scene-b01" }
    ]
  }
}
\`\`\`

7. Write the plan to \`.build-<id>/plan.json\`
8. Call \`soulkiller runtime script plan <id>\`
9. The CLI will:
   - Validate JSON syntax, schema, graph integrity
   - Auto-compute predecessors and is_convergence for each scene
   - Compute generation_order (topological sort)
   - Write the enriched plan back
10. Read PLAN_OK output: note generation_order and convergence_points
11. If error -> read error message -> fix plan -> re-Write -> retry

**Step B: Generate Scenes (in generation_order)**

Generate each scene following the order from PLAN_OK. For each scene-id:

1. Read \`.build-<id>/plan.json\`:
   - This scene's outline, cast, emotional_beat, choices
   - narrative.character_arcs for characters in this scene
   - This scene's is_convergence flag
2. Read all predecessor scenes: \`.build-<id>/scenes/<pred>.json\` for each pred in this scene's predecessors
3. Read context_refs scenes: \`.build-<id>/scenes/<ref>.json\` for refs not already in predecessors
4. **If is_convergence == true**: This scene is reached from multiple paths. Your narration MUST NOT reference events or dialogue from any specific predecessor. Write path-neutral prose.
5. **Gate scenes** (type \`"affinity_gate"\`): auto-generated from the plan. Write the routing JSON only — no narration text needed (optional short narration is allowed). The gate's \`routing\` array is copied verbatim from plan.json.
6. Generate the scene JSON:
   \`\`\`json
   {
     "text": "full narration + dialogue",
     "choices": [
       { "id": "c1", "text": "option text", "consequences": { "axes.trust": 2 }, "next": "scene-002" }
     ]
   }
   \`\`\`
   - **Prose constraints**: narration and dialogue must comply with prose_style's forbidden_patterns and ip_specific
8. Write to \`.build-<id>/draft/<scene-id>.json\`
9. Call \`soulkiller runtime script scene <id> <scene-id>\`
10. If error -> read error -> fix draft -> re-Write -> retry (max 3 times)

**Step C: Generate Endings (after ALL scenes)**

After every scene is generated, create ending bodies based on actual scene content:

1. For each ending in plan:
   - Read plan.json for this ending's intent and condition
   - Read character_arcs to find key_scenes for relevant characters
   - Read those key_scenes from \`.build-<id>/scenes/\`
   - Generate the ending body based on intent + actual scene content
2. Write to \`.build-<id>/draft/<ending-id>.json\`:
   \`\`\`json
   { "id": "ending-A", "title": "...", "condition": {...}, "body": "ending narration..." }
   \`\`\`
3. Call \`soulkiller runtime script ending <id> <ending-id>\`
4. If error -> fix -> retry

**Step D: Build**

Call \`soulkiller runtime script build <id>\`

This merges plan + scenes + endings into \`runtime/scripts/script-<id>.json\` and cleans up the build directory. The final format is identical to a standard script.json.

**Step E: Self-Check (Simplified)**

Most validation is already done incrementally by the CLI. Only two checks remain:

- **Prose style verification**: Re-read story-spec.md's forbidden_patterns. Scan your generated scene text for violations. If found, use Edit to fix the scene files before they were built (note: after build, the source scenes are cleaned up — if prose issues are found, you must rebuild).
- **Data coverage**: Verify source material coverage matches Step 0's loading report.

After self-check passes, enter Phase 2.

# Phase 2: Run Story

Once the script is ready, proceed directly to the first scene.

## Prose Style Constraints (Hard Constraints on All Phase 2 Output)

**Before outputting any text**, you must first check against the "Prose Style Anchor" section of \`\${CLAUDE_SKILL_DIR}/story-spec.md\`:

- Every \`bad\` pattern in \`forbidden_patterns\` **must be avoided**. If any passage contains a similar structure -> replace it with the corresponding \`good\` form before outputting.
- Every rule in \`ip_specific\` **must be followed**: term preservation, naming conventions, metaphor pool constraints.
- \`character_voice_summary\` (if present for a character) is that character's **voice anchor**, taking priority over non-target-language source text that may exist in \`souls/{character}/style.md\`.
- If story-spec contains a "Prose Style Anchor (fallback)" section (legacy archive), use the fallback's generic anti-pattern library as hard constraints.

Most common patterns that slide toward translatese (highest priority to avoid):
1. **Measurement clauses**: over-literal degree expressions -> break into short sentences
2. **Possessive parallel structures**: "My A. My B. My C." -> drop the possessive after the first
3. **Literal metaphor translation**: choosing the wrong concrete noun -> pick an idiomatic image
4. **Literal gesture translation**: over-literal body language -> use natural expressions
5. **Literal negation**: flat negation -> use concrete metaphor

## Scene Rendering Rules

For each scene you must output:
1. **Narration** — immersive second-person description ("You push the door open...", "You see...") — strictly following prose style constraints
2. **Character performance** — improvise based on the script's character direction,
   must follow identity.md's personality and style.md's expression patterns — layered with prose_style constraints; characters with voice_summary use the summary as their voice anchor

Then use AskUserQuestion to present choices:
- question: situational prompt for the current scene (e.g., "What will you do?")
- options: the script's choices for this scene (**choices <= 3 per scene**) **+ append "💾 Save current progress" at the end**
- multiSelect: false

## State Tracking Rules

You must internally maintain a state object in the following format:
\`\`\`
{
  axes: { trust: 5, understanding: 5, ... },
  flags: { shared_secret: false, ... }
}
\`\`\`

- Axis names and flag names are defined by the Phase 1 generated script
- After each user choice, update the state object according to the consequences tagged on that choice in the script
- **Never** reveal state values or event flags to the user — state is implicit
- State affects the character's attitude and dialogue style in subsequent scenes

## Scene Transition Rules

- User selects a story choice -> call \`soulkiller runtime apply <script-id> <scene-id> <choice-id>\` to let the script handle all state transitions (auto-save) -> **immediately render the next scene** (no pausing, no "continue?" prompts, no save details shown)
- User selects "💾 Save current progress" -> call \`soulkiller runtime save <script-id>\` to create a manual save -> after confirmation, re-present the same AskUserQuestion (with original choices + 💾). See "Manual Save" section above
- User enters free text -> respond in character within the current scene,
  then re-present AskUserQuestion with the same scene's choices + 💾 (no transition, no state change, no save written, **do not call state apply**)
- Reaching the ending stage -> enter the ending determination flow (per the "Endings Condition Structured DSL" section's evaluate algorithm)

### Affinity Gate Handling

When the current scene has type \`"affinity_gate"\`:
1. If the gate has text, render it as narration
2. Call \`soulkiller runtime route <script-id> <gate-scene-id>\`
3. Parse output: \`ROUTE <route_id> → <next-scene-id>\`
4. Narrate the route entry naturally (e.g., a brief transition sentence fitting the story mood)
5. Immediately render the next scene (no AskUserQuestion for gates — gates are automatic transitions)

### You Only Stop Rendering in 4 Situations

1. **After rendering a scene**: call AskUserQuestion presenting **script's native choices + 💾 Save current progress**, wait for user selection
2. **User selects 💾 save**: execute manual save flow, then re-present the same AskUserQuestion
3. **User triggers free-text response**: respond, then AskUserQuestion again (same scene, with 💾)
4. **Reaching an ending node**: enter Phase 3 via the ending determination flow

**Any other "mid-stream pause" is an error**. Specifically:
- Do not pause because "the response seems too long"
- Do not insert "continue?" or similar meta-confirmations between scenes
- Do not expose save write details, scene IDs, or "now entering Act N" progress indicators to the user
- Rendering multiple consecutive scenes is **normal behavior**, as long as each scene ends with AskUserQuestion presenting script choices + 💾

## apply_consequences Standard Flow (via state apply script)

**Core contract**: delta calculation, clamping, type validation, and transactional writes to auto/ directory's state.yaml + meta.yaml are **all handled internally by \`soulkiller runtime apply\`**. You do not need to calculate any deltas, construct Edit old_strings, or maintain a literal representation of state. Your only responsibilities are:

1. Receive the user's choice (choice id)
2. Call state apply once
3. Read the script's stdout change summary to inform the next scene's transition narration
4. Render the next scene

### Standard Call

\`\`\`bash
soulkiller runtime apply <script-id> <current-scene-id> <choice-id>
\`\`\`

- \`<script-id>\` is the current script's id (determined in Phase -1, constant throughout Phase 2)
- \`<current-scene-id>\` is the id of the scene **currently being played** (not the next one)
- \`<choice-id>\` is the id of the choice the user selected (from scene.choices[i].id)

### stdout Output Format

After successful execution, the script outputs something like:

\`\`\`
SCENE  scene-005 → scene-007
CHANGES
  axes.trust  5 → 7
  flags.shared_secret  false → true
\`\`\`

- The first line's \`SCENE\` tells you the next scene id (use this for rendering)
- \`CHANGES\` lists all fields affected by consequences (oldValue → newValue)
- If an int was clamped, the line ends with \`(clamped)\`
- If consequences is empty, it shows \`CHANGES (none)\`

### Prohibited Actions (Hard Red Lines)

- **Never** use the Edit tool to directly modify \`state.yaml\` or \`meta.yaml\`
- **Never** use the Write tool to directly rewrite \`state.yaml\` or \`meta.yaml\`
- **Never** pre-calculate new state values in memory and then reconcile against script output — trust the script
- **Never** skip state apply and render the next scene directly (this causes state drift)

If state apply returns a non-zero exit code (stderr will print an error message), **do not** attempt to manually fix state.yaml. Instead:
- Parse stderr and tell the user "Failed to apply scene state: {reason}"
- Let the user choose "Retry" / "Cancel this choice and return to options"

### First Scene Entry (Phase 2 Startup)

When entering Phase 2 for the first time, call **init** instead of apply:

\`\`\`bash
soulkiller runtime init <script-id>
\`\`\`

The script internally writes auto/state.yaml from script.initial_state and initializes auto/meta.yaml in one pass. (Phase -1's "restart from beginning" or "no-save script" entry point already called init on that path — Phase 2 can start rendering directly.)

**Before rendering the first scene**, call \`soulkiller runtime viewer tree <script-id>\` to start the branch tree visualization server. Parse VIEWER_URL from stdout and inform the user:
"分支线可视化已就绪：<VIEWER_URL> — 在浏览器中打开即可实时查看选择路径。"

Then begin rendering the first scene.

## Act Transition Rules

When the story advances from one Act to the next:
1. Output a transition text block (using ━ separator line + centered Act title + atmospheric narration)
2. Use AskUserQuestion to present a "reflective choice"

## Capability Reference Rules

When the user asks about the character's abilities, skills, equipment, or expertise,
refer to the descriptions in \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/capabilities.md\` to answer.

## Timeline Reference Rules

When the user asks about the character's experiences, past events, or historical events,
refer to the records in \`\${CLAUDE_SKILL_DIR}/souls/${soulSlug}/milestones.md\` to answer.

## World Lore Reference Rules

When a scene involves specific locations, organizations, events, or other worldview knowledge,
read relevant .md files from dimension subdirectories under \`\${CLAUDE_SKILL_DIR}/world/\` to fill in details (skip \`_\`-prefixed files and \`history/events/\`, \`history/timeline.md\`).

## Ending Determination Rules

When reaching the final stage of the story, match endings based on accumulated state:
- Read \`meta.yaml\`'s \`current_route\` field (if present). Only evaluate endings whose \`route\` field matches \`current_route\`. If no \`route\` field exists on an ending, it applies to all routes
- Check each eligible ending's trigger condition from highest to lowest priority as defined in the script
- The first satisfied condition triggers the corresponding ending

## Ending Display Rules

When an ending is reached, present in the following order:

1. **Ending narration and character performance** (same format as regular scenes)

2. **Journey recap**:
   - Each numeric axis displayed as a progress bar
   - Key event markers displayed as: \`{event_name} ✓\` or \`{event_name} ✗\`

3. **Ending gallery**: list all endings (achieved ★ / unachieved ☆) + trigger conditions + preview text

4. Use AskUserQuestion to offer:
   - "Start over" — reuse the current script, reset state, restart from the first scene
   - "End story" — conclude the story

# Replay Rules

When the user selects "Start over", you **must** call the state CLI's reset subcommand to perform the full reset:

\`\`\`bash
soulkiller runtime reset <script-id>
\`\`\`

The script internally handles:
- Reuses the current script (read from meta.yaml.script_ref) — does not regenerate the script
- Overwrites state.yaml in one pass from script.initial_state, restoring all fields to initial values
- Sets meta.yaml.current_scene to the first scene id
- Atomic transaction: both state.yaml and meta.yaml are either both reset or neither is changed

After reset succeeds:
- Jump directly to Phase 2's **first scene** and continue running
- **Do not** return to Phase 0 or Phase 1, **do not** regenerate the script
- **Do not** manually reset state.yaml using Read / Edit / Write — only use state reset

If the user wants to play an entirely new story (not replay the current script), guide them to end the current story and restart the skill, entering the Phase -1 menu to select "Generate new script".

# Prohibited Actions

## Story Structure
- Do not skip scenes
- Do not fabricate branches not in the script
- Do not break the fourth wall
- Do not advance the plot outside of choices
- Each AskUserQuestion cycle renders **one** scene only: finish that scene's narration + dialogue -> call AskUserQuestion presenting that scene's choices -> wait for user selection. After the user chooses, **immediately** begin rendering the next scene without stopping

## Control Flow Self-Pausing (Strictly Prohibited)
- **Never** insert "continue?", "next step", "shall I expand scene-X?" or similar meta-confirmations
- **Never** self-rate-limit because "the response seems too long" / "to avoid verbosity" / "let me pause here". Length is not your decision axis; scene boundaries are
- **Never** mix control flow options like "Continue" / "Status" / "Next step" into AskUserQuestion options. Options **must be** a verbatim copy of the current scene's script choices array **+ "💾 Save current progress"** (the only allowed non-script option)
- **Never** stop writing after apply_consequences completes without rendering the next scene. apply_consequences -> render next scene is **a single atomic action**
- **Never** omit the "💾 Save current progress" option. Every AskUserQuestion **must** include this option at the end

## Progress/Save Exposure (Fourth Wall)
- **Never** show the user "story has entered Act N" / "mid-Act 3" / "X% complete" or similar progress indicators
- **Never** show the user scene IDs ("scene-007" / "current scene: scene-X") or save write details ("save written to auto/"). Saves and scene transitions are **background operations** the user does not need to see
- **Never** prefix scene output with "story state update" / "Act title" or similar meta-framework labels, except for the Act transition block (see Act Transition Rules above)
- Do not reveal state values or state field names to the user during the story
- Do not mention flags / affinity / consequences as mechanism terms in narration

## Chatbot-Style Meta-Narration
- Do not use transitions like "The above was X, now let me..." / "Let's move to the next scene" / "I will now perform..."
- Do not use self-referential phrases like "As this character, my response is..."
- Narration enters the scene directly without preamble or epilogue

## Option Label Contamination
- AskUserQuestion option text **must be** a verbatim copy of script choices[i].text
- **Do not** add suffix hints to option text, such as "(friendly route)", "(will increase trust)", "(choose carefully)"
- **Do not** hint at an option's consequences

## Direct State File Writes (Hard Red Line)
- **Never** use the Edit tool to directly modify \`runtime/saves/<script-id>/auto/state.yaml\`
- **Never** use the Edit tool to directly modify \`runtime/saves/<script-id>/*/meta.yaml\`
- **Never** use the Write tool to directly rewrite \`state.yaml\` or \`meta.yaml\`
- **All** state writes must go through \`soulkiller runtime {init,apply,reset,rebuild,save}\`
- Even if you see a field in state.yaml that is "obviously wrong", you may only use \`state rebuild\` or \`state reset\` — direct Edit will lock the error into the file
`
}

/**
 * Save system: per-script saves with auto + manual snapshots.
 *
 * Inserted as a top-level section in SKILL.md (after Phase -1 / before Phase 0)
 * because it is referenced by both Phase -1 (continue/retry flows) and Phase 2
 * (writing state on every scene transition + manual save).
 */
function buildSaveSystemSection(): string {
  return `# Save System

Saves are organized **per script**, located under \`\${CLAUDE_SKILL_DIR}/runtime/saves/<script-id>/\`. Each script has:
- **1 auto-save** (\`auto/\`) — automatically updated after every story choice
- **Up to 3 manual saves** (\`manual/<timestamp>/\`) — created when the user actively saves at a choice point

## Save Directory Structure

\`\`\`
runtime/saves/<script-id>/
├── auto/
│   ├── meta.yaml        # save metadata (linked script, last played time, current scene)
│   └── state.yaml       # current runtime state (affinity / flags / current_scene)
└── manual/
    ├── <timestamp-1>/
    │   ├── meta.yaml
    │   └── state.yaml
    ├── <timestamp-2>/
    │   └── ...
    └── <timestamp-3>/   # max 3
        └── ...
\`\`\`

## meta.yaml Fields

\`\`\`yaml
script_ref: <corresponding script id, e.g. a3f9c2e1>
last_played_at: <ISO 8601 timestamp>
current_scene: <id of the current scene>
\`\`\`

## state.yaml Fields

\`\`\`yaml
current_scene: <current scene id>
affinity:
  # per-character affinity axis current values (multi-char) or axes (single-char)
flags:
  # current truth values for all flags
\`\`\`

## Auto-Save (Must Execute on Every Phase 2 Choice)

Every time a **scene transition** occurs (user selects a story choice -> jumps to the next scene), you **must immediately** call:

\`\`\`bash
soulkiller runtime apply <script-id> <current-scene-id> <choice-id>
\`\`\`

The script internally performs a transactional update: reads consequences from script.json, applies deltas (int clamp / bool overwrite / enum validation), and atomically writes state.yaml + meta.yaml under the auto/ directory. You **do not** need to manually Edit or Write any file — the entire write flow is guaranteed by the script.

If the script returns a non-zero exit code, parse stderr's error message to inform the user — do not attempt to manually fix it.

## Manual Save (User-Initiated During Phase 2)

At the end of **every AskUserQuestion**'s option list in Phase 2, you **must** append a fixed option \`💾 Save current progress\`. This option is not part of the script's choices definition — you inject it at runtime.

When the user selects "💾 Save current progress":

1. Call \`soulkiller runtime save <script-id>\`
2. **Success** -> output "✅ Saved" -> **re-present the exact same AskUserQuestion** (with all original story choices + 💾)
3. Returns \`MANUAL_SAVE_LIMIT_REACHED\` -> use AskUserQuestion to show existing manual saves and let the user choose which to overwrite -> call \`soulkiller runtime save <script-id> --overwrite <timestamp>\` -> confirm -> re-present original choices

**Manual saves do not trigger state apply**, do not advance the plot, and do not consume a turn.

## Current Script Determination

When entering Phase 2, the current script-id is determined by the Phase -1 entry point:
- Selected an existing script (whether loading a save or restarting) -> script-id comes from the selected script
- Generated a new script -> the new script-id written by Phase 1

Phase 2 uses the same script-id for all state CLI commands throughout.

`
}

/**
 * Platform scope notice: inserted between the intro and Phase -1 so the
 * LLM sees the hard runtime requirements before it starts any work.
 *
 * The skill requires the soulkiller binary to be installed. The binary
 * embeds its own bun runtime, so no separate shell or bun installation
 * is needed — works identically on macOS, Linux, and Windows.
 */
function buildPlatformNotice(): string {
  return `# Platform Scope

This skill requires the \`soulkiller\` CLI to be installed. Supported platforms:

- ✅ **macOS** (Apple Silicon / Intel)
- ✅ **Linux** (x86_64 / arm64)
- ✅ **Windows** (x64)

If \`soulkiller\` is not available, Phase -1 Step 0 will provide installation instructions.
`
}

/**
 * Phase -1: Script library menu.
 *
 * Runs before Phase 0 every time the skill is loaded. Lets the user pick from
 * previously persisted scripts (continue a save, retry, rename, delete) or
 * generate a new script. The actual script files live at
 * \`${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.json\` and are written by
 * Phase 1 via the Write tool.
 */
function buildPhaseMinusOne(): string {
  return `# Phase -1: Script Library Menu

**Enter this phase first** every time the skill is loaded. This phase determines whether to reuse a previously generated script or generate a new one.

## Step 0: Runtime Health Check (Must Execute First)

**Before any other Phase -1 actions**, run the soulkiller runtime doctor:

\`\`\`
soulkiller runtime doctor
\`\`\`

This command returns structured stdout, one \`KEY: value\` pair per line. Parse the \`STATUS\` field:

### STATUS: OK

Everything is ready. Record \`SOULKILLER_VERSION\` and \`BUN_VERSION\` for debugging, then proceed directly to **Step -1.1**.

### Command not found (soulkiller is not installed)

Use **AskUserQuestion** to present installation instructions:

**Question body (must contain the following content verbatim)**:

\`\`\`
This skill requires the soulkiller CLI. One-time installation:

- macOS/Linux: curl -fsSL https://raw.githubusercontent.com/Xeonice/soul-killer/main/scripts/install.sh | sh
- Windows: irm https://raw.githubusercontent.com/Xeonice/soul-killer/main/scripts/install.ps1 | iex

After installation, open a new terminal and retry.
\`\`\`

**Options (must be these two, in this order)**:

1. **"I've installed it"** — when selected, re-run \`soulkiller runtime doctor\`. If STATUS: OK -> continue. Otherwise show error and offer retry.
2. **"Cancel (enter read-only mode)"** — when selected, enter read-only mode (see below)

### Read-only mode

Enter **read-only mode** — skip the write portions of Steps -1.1 through -1.4, only allowing:

- List existing scripts via \`soulkiller runtime scripts\` (use Read to view header fields)
- List existing saves (use Glob to scan \`runtime/saves/*/auto/meta.yaml\`)
- View the Phase 3 gallery for a previously reached ending

Prohibited:

- Any writes (init / apply / reset / rebuild / save)
- Entering Phase 1 (new script creation)
- Entering Phase 2 (scene transitions)

## Step -1.1: List Existing Scripts

Run the following command and parse the JSON output:

\`\`\`
soulkiller runtime scripts
\`\`\`

- **If \`count\` is 0** -> skip Step -1.2, proceed directly to **Phase 0** (first playthrough, no menu needed)
- **If \`count\` > 0** -> proceed to Step -1.2, using the \`scripts\` array entries for each script's metadata

## Step -1.2: Parse Each Script's Header Fields

For each \`script-*.json\`, use the Read tool to read the file and parse it as JSON. Each script JSON's top-level fields SHALL include:

\`\`\`json
{
  "id": "<8-char short hash>",
  "title": "<short script title>",
  "generated_at": "<ISO 8601 timestamp>",
  "user_direction": "<user direction text from Phase 0, may be empty>",
  "acts": 3,
  "state_schema": { "...": "..." },
  "initial_state": { "...": "..." },
  "scenes": { "...": "..." },
  "endings": [ "..." ]
}
\`\`\`

If a file cannot be JSON.parse'd (corrupted), mark it as \`(corrupted)\` — **do not abort the entire Step**. Continue parsing other files.

## Step -1.3: Get Each Script's Save Status

For each successfully parsed script, call the state CLI's list subcommand:

\`\`\`bash
soulkiller runtime list <script-id>
\`\`\`

This command returns JSON:

\`\`\`json
{
  "scriptId": "<id>",
  "auto": { "currentScene": "scene-12", "lastPlayedAt": "2026-04-10T15:30:00Z" },
  "manual": [
    { "timestamp": "1712345678", "currentScene": "scene-5", "lastPlayedAt": "2026-04-10T14:00:00Z" }
  ]
}
\`\`\`

If \`auto\` is \`null\`, the script has no saves.

## Step -1.4: Main Menu (Flat Script List)

Use AskUserQuestion to present the main menu. List all scripts directly, with save status annotations on each entry:

\`\`\`
question: "Select a script to begin, or create a new journey."
options:
  - "<title> [🔄 <current_scene> · <relative_time>]"    # script with auto-save
  - "<title> [no saves]"                                  # script without saves
  - "✨ Generate new script"                               # always shown
  - "📋 Manage scripts"                                    # rename/delete entry
\`\`\`

Based on the user's selection, enter the corresponding sub-flow:

### Selected a Script with Saves -> Save Sub-Menu

Use AskUserQuestion to show all saves for that script:

\`\`\`
options:
  - "🔄 Auto-save — <scene> · <time>"            # auto save
  - "💾 Manual save 1 — <scene> · <time>"         # manual[0] (if exists)
  - "💾 Manual save 2 — <scene> · <time>"         # manual[1] (if exists)
  - "💾 Manual save 3 — <scene> · <time>"         # manual[2] (if exists)
  - "🆕 Start from beginning"                     # always shown
\`\`\`

### Selected a Script without Saves -> Start Directly

Call \`soulkiller runtime init <script-id>\` -> proceed directly to **Phase 2** first scene.

### Load a Save

After the user selects a save from the save sub-menu (auto or a manual save):

1. Determine save-type: \`auto\` or \`manual:<timestamp>\`
2. Call \`soulkiller runtime validate <script-id> <save-type> --continue\`
3. validate returns structured JSON to stdout. On success:

\`\`\`json
{ "ok": true, "errors": [] }
\`\`\`

On failure:

\`\`\`json
{
  "ok": false,
  "errors": [
    { "code": "DANGLING_SCRIPT_REF", "message": "script file not found: ..." }
  ]
}
\`\`\`

4. Parse the returned JSON; if \`ok: false\`, handle according to the error code table below
4. After validation passes: Read \`runtime/scripts/script-<id>.json\` to load the script into context; Read the corresponding save directory's \`state.yaml\` to load state into context
5. Proceed directly to **Phase 2**, continuing from the \`current_scene\` in state

### Start from Beginning

After the user selects "🆕 Start from beginning":

- Call \`soulkiller runtime init <script-id>\`
  - The script internally handles: Read target script.json, copy initial_state to auto/state.yaml, write auto/meta.yaml (script_ref + current_scene = first scene)
  - Script stdout returns an \`INITIALIZED\` summary line
- Call \`soulkiller runtime validate <script-id>\` for a sanity check
- Read \`runtime/scripts/script-<id>.json\` to load the script into context
- Proceed directly to **Phase 2** first scene

### Pre-Load Validation — Error Code Table

| code | Meaning | LLM Action |
|---|---|---|
| \`DANGLING_SCRIPT_REF\` | meta.yaml references a script file that does not exist | Mark save as \`(orphaned)\`; offer "delete save" option; return to main menu |
| \`STATE_SCHEMA_MISSING\` | script.json is missing the state_schema block | Mark script as \`(legacy, cannot replay)\`; offer "delete script" option only; hard fail |
| \`INITIAL_STATE_MISMATCH\` | initial_state field set does not match schema | Mark script as \`(corrupted)\`; offer "delete script" option |
| \`CONSEQUENCES_UNKNOWN_KEY\` | A scene references a key not declared in schema | Mark script as \`(corrupted)\`; offer "delete script" option |
| \`SHARED_AXES_INCOMPLETE\` | A character is missing one or more of the 3 shared axes | Mark script as \`(corrupted)\`; offer "delete script" option |
| \`FLAGS_SET_MISMATCH\` | Script's flags do not match story-spec | Mark script as \`(corrupted)\`; offer "delete script" option |
| \`FIELD_MISSING\` | state.yaml is missing a schema field | Show **repair menu** (see below) |
| \`FIELD_EXTRA\` | state.yaml has extra fields | Show **repair menu** |
| \`FIELD_TYPE_MISMATCH\` | A field in state.yaml has the wrong type | Show **repair menu** |
| \`MALFORMED\` | File is corrupted and cannot be parsed | Mark as \`(corrupted)\`; offer "delete" option |

### Repair Menu (when FIELD_*/MALFORMED occurs during continue)

Use AskUserQuestion to ask the user:

\`\`\`
options:
  - "Keep usable fields, auto-fill missing / reset to defaults"     # -> soulkiller runtime rebuild <script-id> [<save-type>]
  - "Fully reset to initial_state"                                   # -> soulkiller runtime reset <script-id> [<save-type>]
  - "Cancel loading, return to main menu"
\`\`\`

**Never** use Read + Edit / Write to manually patch state.yaml. Repair actions **may only** be performed via \`soulkiller runtime rebuild\` or \`soulkiller runtime reset\`.

### 📋 Manage Scripts

Use AskUserQuestion to show a sub-menu:

\`\`\`
options:
  - "Rename script"
  - "Delete script"
  - "Return to main menu"
\`\`\`

#### Rename Script

1. List all scripts (including corrupted ones) for the user to select
2. Use AskUserQuestion to ask for the new \`title\`
3. Read the target script (JSON), modify the top-level \`title\` field in memory
4. Write back to the original file path (filename unchanged), output must be valid JSON
5. After completion, return to **Step -1.4** main menu

#### Delete Script

1. List all scripts for the user to select
2. Use AskUserQuestion for a confirmation prompt (options: "Confirm delete" / "Cancel")
3. Delete \`runtime/scripts/script-<id>.json\`
4. Delete the entire \`runtime/saves/<id>/\` directory (cascade cleanup of all saves for that script)
5. Output summary: "Deleted script '\${title}' and associated saves"
6. After completion, return to **Step -1.4** main menu

### ✨ Generate New Script

Proceed directly to **Phase 0** (same flow as when no scripts exist).

## Handling Corrupted Scripts

If any scripts were marked as \`(corrupted)\` in Step -1.2:
- List them alongside normal scripts in the "📋 Manage scripts" sub-menu, distinguished by the \`(corrupted)\` suffix
- Do not list corrupted scripts in the main menu's script list (they cannot be run)
- Encourage the user to delete corrupted files
`
}

/**
 * State schema section: defines the rules for the `state_schema` block that
 * Phase 1 LLM must produce inside every script.json. This block is the
 * single source of truth for "what state fields this script tracks".
 *
 * Three pillars:
 *   1. Naming constraints (ASCII / snake_case / dot / quoted) — eliminates
 *      free-form key generation that would cause replay drift.
 *   2. Type set (int / bool / enum / string only, first version) — keeps
 *      the apply algorithm tractable and the lint rules simple.
 *   3. Required field metadata (desc / type / default + range/values) —
 *      gives both the LLM (semantic anchor) and the validator (typed
 *      contract) something to work with.
 *
 * Three-layer state model (story-level-state change):
 *   - Layer 1 (shared axes): every character has `bond` + 2 story-defined
 *     shared axes identical across the cast. Enables cross-character
 *     aggregation via `all_chars` / `any_char` DSL primitives.
 *   - Layer 2 (specific axes): each character may declare 0–2 unique axes
 *     (`affinity.<char>.<axis>`) for their individual arc.
 *   - Layer 3 (flags): a story-level whitelist defined once in
 *     `story_state.flags`. Phase 1 must copy every flag verbatim and may
 *     not invent new ones. Phase -1's validation 5 checks shared-axes
 *     completeness; validation 6 checks flag-set equality.
 */
function buildStateSchemaSection(): string {
  return `## state_schema Creation Constraints (Three-Layer Structure)

The top-level \`"state_schema"\` field of each script.json **must** contain an object serving as the explicit contract for all state fields that script may track. The schema is a flat dictionary — top-level keys are complete literal strings with **no** intermediate nesting layers for affinity / flags / custom.

### Three-Layer Structure (Must Understand)

State is divided into **3 layers**:

1. **Shared axes layer** — every character has these 3 axes
   - \`bond\` is platform-fixed (shared across all soulkiller stories)
   - The other 2 are declared in \`story-spec.md\`'s **Story State** section under \`shared_axes_custom\` (read story-spec to find them)
   - **Every character must have all 3 shared axes**, no opt-out
   - Shared axes are the foundation of the \`all_chars\` / \`any_char\` cross-character aggregation DSL

2. **Character-specific axes layer** — 0-2 per character, used only by that character
   - Sourced from each character's \`axes\` list in \`story-spec.md\`'s \`characters\` section
   - Pure flavor, does not participate in cross-character aggregation, but can be used in ending conditions as character-specific branches

3. **Flags layer** — key event markers
   - **Must** be copied character-for-character from \`story-spec.md\`'s **Story State** section's \`flags\` list
   - You **may not** create new flags, rename them, or add/remove any
   - Any missing or extra flags in the flag set will cause Phase -1 load validation to fail

### Field Naming Constraints (Hard Rules)

- **ASCII**: only English letters + digits + underscores + dots; no CJK characters, spaces, or special characters
- **snake_case**: words separated by underscores, no camelCase
- **Dot-separated namespaces**
- **Must be quoted**: every key must be written as \`"affinity.judy.trust":\`, not \`affinity.judy.trust:\` (unquoted keys would be parsed as nested objects by yaml)

**Namespace conventions** (recommended prefixes):
- \`affinity.<char_slug>.<axis>\` — character affinity axes (shared or specific)
- \`flags.<event_name>\` — key event boolean markers

### Type Set (4 types)

| type | Purpose | Required fields | consequences semantics |
|------|---------|-----------------|----------------------|
| \`int\` | Numeric axes (shared or specific) | \`range: [min, max]\` | delta (add/subtract) |
| \`bool\` | Event markers (flags) | — | absolute overwrite |
| \`enum\` | Discrete options (rarely used) | \`values: [...]\` | absolute overwrite |
| \`string\` | Arbitrary short text (rarely used) | — | absolute overwrite |

**Not supported**: list / float / datetime / nested object.

### Field Metadata (Required for Every Field)

Each schema field is an object that **must** contain:

- \`desc: string\` — semantic description of the field, required
- \`type\` — one of the four types above
- \`default\` — default value for the field, type-matched. For shared axes, if the character has \`shared_initial_overrides\` set via \`set_character_axes\`, the default should be the overridden value
- Depending on type:
  - \`int\` -> must include \`range\`
  - \`enum\` -> must include \`values\`, and \`default\` must be within values

### Complete Example (3 characters + 2 flags)

Assume story-spec declares \`shared_axes_custom: [trust, rivalry]\` and 2 flags:

\`\`\`json
"state_schema": {
  "affinity.illya.bond":       { "desc": "Illya's closeness",                    "type": "int", "range": [0, 10], "default": 5 },
  "affinity.illya.trust":      { "desc": "Illya's trust toward the player",      "type": "int", "range": [0, 10], "default": 5 },
  "affinity.illya.rivalry":    { "desc": "Illya's sense of rivalry with player",  "type": "int", "range": [0, 10], "default": 2 },
  "affinity.illya.self_worth": { "desc": "Illya's self-worth (character-specific)", "type": "int", "range": [0, 10], "default": 3 },

  "affinity.rin.bond":    { "desc": "Rin's closeness",                    "type": "int", "range": [0, 10], "default": 5 },
  "affinity.rin.trust":   { "desc": "Rin's trust toward the player",      "type": "int", "range": [0, 10], "default": 5 },
  "affinity.rin.rivalry": { "desc": "Rin's competitive spirit",            "type": "int", "range": [0, 10], "default": 3 },

  "affinity.kotomine.bond":    { "desc": "Kotomine's closeness (villain, starts very low)",      "type": "int", "range": [0, 10], "default": 1 },
  "affinity.kotomine.trust":   { "desc": "Kotomine's trust toward player (villain, starts very low)", "type": "int", "range": [0, 10], "default": 1 },
  "affinity.kotomine.rivalry": { "desc": "Kotomine's hostility (villain, starts high)",           "type": "int", "range": [0, 10], "default": 8 },

  "flags.met_illya":              { "desc": "Player formally met Illya for the first time", "type": "bool", "default": false },
  "flags.truth_of_grail_revealed": { "desc": "The truth of the Grail has been revealed",    "type": "bool", "default": false }
}
\`\`\`

JSON has no comment syntax. If you want to note something like "this default comes from shared_initial_overrides" for a field, put it in the \`desc\` string (e.g., \`"desc": "Kotomine's hostility (villain override to 8)"\`).

### initial_state Must Strictly Align with Schema

The \`"initial_state"\` field immediately follows \`"state_schema"\`:
- Field set **strictly ==** state_schema field set (no missing, no extra)
- Each field value **typically equals** schema.default

\`\`\`json
"initial_state": {
  "affinity.illya.bond": 5,
  "affinity.illya.trust": 5,
  "affinity.illya.rivalry": 2,
  "affinity.illya.self_worth": 3,
  "affinity.rin.bond": 5,
  "affinity.rin.trust": 5,
  "affinity.rin.rivalry": 3,
  "affinity.kotomine.bond": 1,
  "affinity.kotomine.trust": 1,
  "affinity.kotomine.rivalry": 8,
  "flags.met_illya": false,
  "flags.truth_of_grail_revealed": false
}
\`\`\`

### Shared Axes Completeness Self-Check (Mandatory Before Write)

Before you Write script.json, you **must** complete the following self-check:

1. Read \`shared_axes_custom\` from story-spec.md's **Story State** section (2 non-bond axis names)
2. Expected shared axis set = \`{bond, <shared_axes_custom[0]>, <shared_axes_custom[1]>}\` (3 total)
3. For each character \`<char_slug>\`, verify state_schema contains these 3 fields:
   - \`"affinity.<char_slug>.bond"\`
   - \`"affinity.<char_slug>.<shared_axis_1>"\`
   - \`"affinity.<char_slug>.<shared_axis_2>"\`
4. If any character is missing any shared axis -> fix and rewrite

### Flags Set Consistency Self-Check (Mandatory Before Write)

1. Read the name set of the \`flags\` list from story-spec.md's **Story State** section
2. Extract the name set of all \`"flags.<name>"\` keys from state_schema (strip the \`flags.\` prefix)
3. The two sets **must be strictly equal** (no missing, no extra)
4. Inconsistency -> fix scene consequences references -> rewrite

**Absolutely not allowed**: creating flag names not declared in story-spec. Even if you feel the story needs an additional flag, it must be resolved by re-exporting (having the export agent update story_state), not by inventing your own.
`
}

/**
 * Endings DSL section: structured condition language for ending selection.
 * Each ending's condition is a tree of comparison + boolean nodes that the
 * runtime can evaluate mechanically without semantic interpretation. The
 * last ending in the array MUST use \`condition: default\` as a guaranteed
 * fall-through.
 */
function buildEndingsDslSection(): string {
  return `## Endings Condition Structured DSL

The \`condition\` field of each ending in the endings array **must** be a structured DSL node. **Natural language string expressions are not accepted**.

### Node Types

**Comparison node** — references a schema field for comparison:
\`\`\`yaml
{ key: "<schema field literal key>", op: "<operator>", value: <value> }
\`\`\`

Supported operators:
- \`>= / <= / > / <\` — only for \`int\` fields
- \`== / !=\` — for all types

**Logical combination nodes** — can be nested arbitrarily:
\`\`\`yaml
{ all_of: [ <node>, <node>, ... ] }   # AND
{ any_of: [ <node>, <node>, ... ] }   # OR
{ not: <node> }                       # NOT
\`\`\`

**Cross-character aggregation nodes** (only valid for **shared axes**):
\`\`\`yaml
# For all characters (minus the except list), the shared axis meets the condition
all_chars:
  axis: bond
  op: ">="
  value: 7
  except: [<char_slug>, ...]   # optional, exclude specific characters

# At least one character (minus the except list) meets the condition on the shared axis
any_char:
  axis: trust
  op: ">="
  value: 8
  except: [<char_slug>, ...]   # optional
\`\`\`

**Key restriction**: \`all_chars\` / \`any_char\`'s \`axis\` may only be a **shared axis** (\`bond\` or the 2 declared in story-spec's \`shared_axes_custom\`). It **cannot** reference character-specific axes (specific axes have different names per character and cannot be aggregated across characters).

**Fallthrough literal**:
\`\`\`yaml
condition: default
\`\`\`
(string literal \`default\`, always evaluates to true)

### Complete Example

Assume story-spec's shared_axes_custom = [trust, rivalry], character slugs = [illya, rin, kotomine] (where kotomine is the antagonist):

\`\`\`yaml
endings:
  # Example 1: Universal acceptance — all_chars aggregates all characters (excluding antagonist)
  - id: "ending-unity"
    title: "United We Stand"
    condition:
      all_of:
        - all_chars:
            axis: bond
            op: ">="
            value: 7
            except: [kotomine]
        - { key: "flags.truth_of_grail_revealed", op: "==", value: true }
    body: |
      (All characters stand by the protagonist's side...)

  # Example 2: Two-character conflict — references specific character's shared + specific axes
  - id: "ending-illya-route"
    title: "Illya's Exclusive Ending"
    condition:
      all_of:
        - { key: "affinity.illya.bond", op: ">=", value: 8 }
        - { key: "affinity.illya.self_worth", op: ">=", value: 7 }  # specific axis
        - { key: "affinity.rin.rivalry", op: ">=", value: 6 }       # Rin's high hostility
    body: |
      ...

  # Example 3: Any character's awakening — any_char
  - id: "ending-breakthrough"
    title: "At Least One Awakens"
    condition:
      any_char:
        axis: trust
        op: ">="
        value: 9
    body: |
      ...

  # Example 4: Complex nesting — all_chars inside all_of
  - id: "ending-rebel"
    title: "Rebellion Ending"
    condition:
      any_of:
        - all_of:
            - { key: "affinity.illya.bond", op: ">=", value: 8 }
            - { key: "flags.truth_of_grail_revealed", op: "==", value: true }
        - all_chars:
            axis: rivalry
            op: "<="
            value: 3
            except: [kotomine]

  - id: "ending-default"
    title: "Default Ending"
    condition: default
    body: |
      (Fallthrough ending)
\`\`\`

### Mandatory Rules

- **The last ending must** use \`condition: default\` as the unconditional fallthrough
- Comparison node \`key\` must exist in \`state_schema\`
- Comparison node \`value\` type must match \`state_schema[key].type\`
- enum field \`value\` must be within \`schema.values\` list
- bool fields cannot use \`>= / <= / > / <\`, only \`== / !=\`
- \`all_chars\` / \`any_char\`'s \`axis\` **must** be a shared axis, not a character-specific axis
- Names in \`all_chars\` / \`any_char\`'s \`except\` list must be actual existing character slugs

### Evaluation Algorithm (Execute This When Triggering Endings in Phase 3)

\`\`\`
evaluate(node, state, schema, characters):
  if node === "default":
    return true

  if node has all_of:
    return all children evaluate true
  if node has any_of:
    return any child evaluates true
  if node has not:
    return not evaluate(child)

  if node has key/op/value:
    if schema[key] is None: return false
    current = state[key]
    return apply_op(current, op, value)

  if node has all_chars:
    included = characters - (node.all_chars.except or [])
    for char in included:
      key = \`affinity.\${char}.\${node.all_chars.axis}\`
      if schema[key] is None: return false
      current = state[key]
      if not apply_op(current, node.all_chars.op, node.all_chars.value):
        return false
    return true

  if node has any_char:
    included = characters - (node.any_char.except or [])
    for char in included:
      key = \`affinity.\${char}.\${node.any_char.axis}\`
      if schema[key] is None: continue
      current = state[key]
      if apply_op(current, node.any_char.op, node.any_char.value):
        return true
    return false

# Iterate through endings array in order; the first ending that evaluates to true is triggered
for ending in endings:
  if evaluate(ending.condition, state, schema, characters):
    present ending -> exit
\`\`\`
`
}

export function generateSkillMd(config: SkillTemplateConfig): string {
  const {
    skillName,
    storyName,
    worldDisplayName,
    description,
    characters,
    acts_options,
    default_acts,
    expectedFileCount,
    expectedTextSizeKb,
    routeCharacters,
  } = config

  const hasRoutes = !!routeCharacters && routeCharacters.length > 0

  const isMultiCharacter = !!characters && characters.length > 1
  // For the multi-character intro display, we use the original (possibly CJK) name.
  const protagonistDisplayName =
    characters?.find((c) => c.role === 'protagonist')?.name
    ?? characters?.[0]?.name
    ?? storyName
  // For the single-character engine's path references, we pass the ASCII slug.
  // Without a CharacterSpecWithSlug entry (zero characters configured), fall
  // back to a slug derived from the storyName so the legacy single-character
  // template still produces ASCII paths.
  const protagonistSlug =
    characters?.find((c) => c.role === 'protagonist')?.slug
    ?? characters?.[0]?.slug
    ?? skillName

  // Build the act selection prompt content
  const actOptionsList = acts_options.map((o) => {
    const marker = o.acts === default_acts ? ' [recommended]' : ''
    return `  - "${o.label_zh} (${o.acts} acts, ${o.rounds_total} rounds, ${o.endings_count} endings)${marker}"`
  }).join('\n')

  const defaultOption = acts_options.find((o) => o.acts === default_acts) ?? acts_options[0]!

  const phase0 = `# Phase 0: Startup Configuration

Ask the user in the following order at startup. Each step is completed via AskUserQuestion.

## Step 0.1: Choose Story Length

Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`'s frontmatter to find \`acts_options\` and \`default_acts\`.

Use AskUserQuestion to ask:

question: "How long of a story would you like?"
options:
${actOptionsList}

If the user presses Enter without switching, use the default: ${defaultOption.acts} acts (${defaultOption.label_zh}).

Based on the user's selection, **initialize runtime state in your internal context**:

\`\`\`
state.chosen_acts = <acts from the user's selected ActOption>
state.rounds_budget = <rounds_total from the user's selected ActOption>
state.target_endings_count = <endings_count from the user's selected ActOption>
\`\`\`

All subsequent structural metrics (scene count, ending count, character appearance acts) are based on these runtime values.

## Step 0.2: Story Seeds Prompt

Use AskUserQuestion to ask:

question: "What kind of story would you like?"
options:
  - "Let fate decide"
  - "I have some ideas"

If the user selects "Let fate decide", seeds are empty — proceed directly to Phase 1.
If the user selects "I have some ideas", ask them to describe their desired story direction in natural language.
After collection, proceed to Phase 1.

## appears_from Truncation Rule

If a character's \`appears_from\` in story-spec exceeds \`state.chosen_acts\`:
- Truncate to first appearance in the final act (\`act_{state.chosen_acts}\`)
- No error — introduce naturally`

  const intro = isMultiCharacter
    ? `You are a multi-character visual novel engine. You will run the story "${storyName}" — an interactive story set in ${worldDisplayName}, featuring ${characters!.map((c) => c.display_name ?? c.name).join(', ')} as main characters.

Execution has five phases: Phase -1 (Script Library Menu) -> Phase 0 (Length & Seeds) -> Phase 1 (Script Generation & Persistence) -> Phase 2 (Multi-Character Story Runtime) -> Phase 3 (Ending Gallery).`
    : `You are a visual novel engine. You will run the story "${storyName}" — an interactive story set in ${worldDisplayName}.

Execution has five phases: Phase -1 (Script Library Menu) -> Phase 0 (Length & Seeds) -> Phase 1 (Script Generation & Persistence) -> Phase 2 (Story Runtime) -> Phase 3 (Ending Gallery).`

  // Build a path mapping table when there are multi-character cast members.
  // The Anthropic Skill spec requires ASCII-only directory names, but the
  // user-facing character names may be CJK ("远坂凛"). The packager turns
  // each name into a slug ("skill-abc12345") and we surface that mapping
  // here so the LLM knows that to read 远坂凛's identity it must open
  // souls/skill-abc12345/identity.md, not souls/远坂凛/identity.md.
  const characterPathMapping = characters && characters.length > 0
    ? `\n## Character Path Mapping (Important)\n\nAll character file paths in this skill use ASCII slugs because the Anthropic Skill spec requires archive paths to be ASCII-only. When you need to read a character's identity / style / capabilities / milestones / behaviors, you **must** use the slug from the table below:\n\n${characters.map((c) => `- **${c.display_name ?? c.name}** → \`souls/${c.slug}/\``).join('\n')}\n\nFor example: to read ${characters[0]!.display_name ?? characters[0]!.name}'s identity, call \`Read \${CLAUDE_SKILL_DIR}/souls/${characters[0]!.slug}/identity.md\`.\n\nWhen the rest of this document refers to \`souls/{character}/...\`, {character} is a placeholder — **use the slug from the table above for the actual path**.\n`
    : ''

  let enginePart = isMultiCharacter
    ? buildMultiCharacterEngine(characters!, { expectedFileCount, expectedTextSizeKb })
    : buildSingleCharacterEngine(
        storyName,
        worldDisplayName,
        protagonistSlug,
        protagonistDisplayName,
        { expectedFileCount, expectedTextSizeKb },
      )

  // When routes are defined, strengthen route instructions from conditional to mandatory
  if (hasRoutes) {
    const routeNames = routeCharacters!.map(r => r.name).join(', ')
    const routeCount = routeCharacters!.length
    enginePart = enginePart.replace(
      /\*\*Route Structure \(if story-spec defines routes\):\*\*/g,
      `**Route Structure (MANDATORY — story-spec defines ${routeCount} routes: ${routeNames}):**\n\n**You MUST create an affinity_gate scene and ${routeCount} route-specific scene groups. A plan without routes will be REJECTED by the CLI validator.**`,
    )
  }

  return `---
name: ${skillName}
description: ${description}
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

${intro}
${characterPathMapping}

${buildPlatformNotice()}

${buildPhaseMinusOne()}

${buildSaveSystemSection()}

${phase0}

# Phase 1 Creation Constraints (Must Be Followed When Generating Scripts)

${buildStateSchemaSection()}

${buildEndingsDslSection()}

${enginePart}
`
}

/**
 * Generate the engine-only template for runtime/engine.md.
 * This is content-independent — no character names, paths, or story config.
 * Where content is needed, it references SKILL.md.
 */
export function generateEngineTemplate(): string {
  // Build multi-character engine with placeholder references
  // Use a generic reading list that references SKILL.md
  const genericReadingList = `## Required Reading List

See the **Required Reading List** section in SKILL.md for the complete list of character personality files, worldview files, and story-spec to read. Every file must be Read in full (no offset/limit).

When reading worldview files, first use \`Glob \${CLAUDE_SKILL_DIR}/world/**/*.md\` to list all files, then call Read on each one (without offset/limit) to ensure nothing is missed.

## Chronicle Consistency Requirements
- All time anchors referenced in the script must match \`display_time\` in \`history/timeline.md\`
- Do not fabricate event details that conflict with \`history/events/\` descriptions

## Character Scheduling
See the **Character Scheduling** section in SKILL.md for character appearance timing (\`appears_from\` values).`

  const genericProseStyle = `## Prose Style Constraints (Hard Constraints on All Phase 2 Output)

See the **Prose Style Constraints** section in SKILL.md for target language, voice anchor, and forbidden patterns. These constraints are mandatory for all narrative output.`

  return `# Soulkiller Visual Novel Engine — Execution Protocol

This document defines the complete execution protocol for all phases.
Story-specific content (characters, world, configuration) is in SKILL.md.

${buildPlatformNotice()}

${buildPhaseMinusOne()}

${buildSaveSystemSection()}

# Phase 0: Startup Configuration

Ask the user in the following order at startup. Each step is completed via AskUserQuestion.

## Step 0.1: Choose Story Length

Read \`\${CLAUDE_SKILL_DIR}/story-spec.md\`'s frontmatter to find \`acts_options\` and \`default_acts\`.

Use AskUserQuestion to present the available options. If the user presses Enter without switching, use the default.

Based on the user's selection, **initialize runtime state in your internal context**:

\`\`\`
state.chosen_acts = <acts from the user's selected ActOption>
state.rounds_budget = <rounds_total from the user's selected ActOption>
state.target_endings_count = <endings_count from the user's selected ActOption>
\`\`\`

## Step 0.2: Story Seeds Prompt

Use AskUserQuestion to ask:

question: "What kind of story would you like?"
options:
  - "Let fate decide"
  - "I have some ideas"

If the user selects "Let fate decide", seeds are empty — proceed directly to Phase 1.
If the user selects "I have some ideas", ask them to describe their desired story direction in natural language.
After collection, proceed to Phase 1.

## appears_from Truncation Rule

If a character's \`appears_from\` in story-spec exceeds \`state.chosen_acts\`:
- Truncate to first appearance in the final act (\`act_\${state.chosen_acts}\`)
- No error — introduce naturally

# Phase 1 Creation Constraints (Must Be Followed When Generating Scripts)

${buildStateSchemaSection()}

${buildEndingsDslSection()}

# Phase 1: Generate Script and Persist

${buildReadBudgetDeclaration({})}

## Phase 0 Contamination Fix (Mandatory)

Phase 0 likely only Read the first 50 lines of \`story-spec.md\` to extract \`acts_options\`. However, the **Story State section, Prose Style Anchor section, and characters configuration** are further down in the file. Phase 0's partial read did not include this critical information.

**As the very first action of Phase 1**, re-Read the entire \`\${CLAUDE_SKILL_DIR}/story-spec.md\` **without offset/limit parameters**.

${genericReadingList}

Using the above materials and the seeds collected from the user in Phase 0 (if any), create a complete visual novel script following story-spec.md's specifications.

The script must follow story-spec.md's multi-character cast scheduling rules, choice tradeoff constraints, and character appearance timing (see SKILL.md's Character Scheduling section).

## Script Building (Incremental)

Script generation uses an incremental plan-then-build approach. You do NOT write the complete script in a single call. Instead:

**Step A — Plan**: Generate a plan.json (narrative blueprint with scene outlines, character arcs, context_refs, and route structure). Call \`soulkiller runtime script plan <id>\` to validate.

**Step B — Scenes**: Generate each scene individually in topological order. Call \`soulkiller runtime script scene <id> <scene-id>\` after each.

**Step C — Endings**: Generate endings after all scenes. Call \`soulkiller runtime script ending <id> <ending-id>\` after each.

**Step D — Build**: Call \`soulkiller runtime script build <id>\` to merge into final script.json.

**Step E — Self-check**: Verify prose style compliance and data coverage.

# Phase 2: Run Story

${genericProseStyle}

## Scene Rendering Rules

Each scene render must:
1. Read the scene text from the loaded script
2. Render the narrative in the target language following prose style constraints
3. Present choices via AskUserQuestion (max 3 story choices + 💾 save option)

## State Tracking Rules

- User selects a story choice -> call \`soulkiller runtime apply <script-id> <scene-id> <choice-id>\` to handle all state transitions -> immediately render the next scene
- User selects "💾 Save current progress" -> call \`soulkiller runtime save <script-id>\` -> re-present the same choices
- Free-text reply -> treat as in-character dialogue, then re-present the same choices (no state change)

## apply_consequences Standard Flow

**Core contract**: delta calculation, clamping, type validation, and transactional writes are **all handled internally by \`soulkiller runtime apply\`**. You do not need to calculate deltas or edit state.yaml.

\`\`\`
soulkiller runtime apply <script-id> <current-scene-id> <choice-id>
\`\`\`

If state apply returns a non-zero exit code, **do not** attempt to manually fix state.yaml. Use \`soulkiller runtime rebuild\` or \`soulkiller runtime reset\`.

## Phase 2 Initialization

\`\`\`
soulkiller runtime init <script-id>
\`\`\`

**Before rendering the first scene**, call \`soulkiller runtime viewer tree <script-id>\` to start the branch tree visualization server. Parse VIEWER_URL from stdout and inform the user:
"分支线可视化已就绪：<VIEWER_URL> — 在浏览器中打开即可实时查看选择路径。"

## Scene Transition Rules

4 stop situations:
1. Scene ends with choices -> AskUserQuestion
2. 💾 save flow
3. Free-text reply -> re-present choices
4. Ending reached -> Phase 3

## Reset

\`\`\`
soulkiller runtime reset <script-id>
\`\`\`

## Route System

When the current scene is an \`affinity_gate\`:
1. Do NOT present choices via AskUserQuestion
2. Call \`soulkiller runtime route <script-id> <gate-scene-id>\`
3. Parse output for matched route and next scene
4. Render transition narration and proceed

# Phase 3: Ending Gallery

## 1. Ending Performance
Render the matched ending's narrative.

## 2. Journey Recap
Summarize the player's journey through key decisions.

## 3. Ending Gallery (All Endings)
Show all possible endings with discovery status.

## 4. Replay Options
Offer: replay from beginning, generate new script, or quit.

# Replay Rules

"Start over" -> \`soulkiller runtime reset <script-id>\` -> re-enter Phase 2.
"Generate new script" -> re-enter Phase 0 for new configuration.

# Prohibited Actions

## Story Structure
- Do not generate more scenes/acts than the user selected
- Do not exceed 3 choices per scene (+ 💾 = max 4 AskUserQuestion options)

## Control Flow Self-Pausing (Strictly Prohibited)
- Never pause between scenes with "Shall I continue?" or "Ready for the next scene?"
- Scene transitions are immediate after state apply

## Progress/Save Exposure (Fourth Wall)
- Never show "story has entered Act N" or progress indicators
- Never show scene IDs or save write details
- Do not reveal state values or field names during the story

## Chatbot-Style Meta-Narration
- Do not use transitions like "The above was X, now let me..."
- Narration enters the scene directly without preamble

## Option Label Contamination
- AskUserQuestion option text must be verbatim copy of script choices[i].text
- Do not add suffix hints like "(friendly route)" or "(will increase trust)"

## Direct State File Writes (Hard Red Line)
- **Never** use Edit/Write to modify state.yaml or meta.yaml
- **All** state writes must go through \`soulkiller runtime {init,apply,reset,rebuild,save}\`
`
}

