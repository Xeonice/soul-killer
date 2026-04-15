import type { SoulManifest } from '../../soul/manifest.js'
import type { WorldManifest } from '../../world/manifest.js'
import type {
  ActOption,
  CharacterAxis,
  CharacterAxisOverrides,
  CharacterRole,
  CharacterSpec,
  ProseStyle,
  RouteCharacter,
  StorySpecConfig,
  StoryState,
} from '../spec/story-spec.js'
import { BOND_AXIS } from '../spec/story-spec.js'
import { logger } from '../../infra/utils/logger.js'

// Character cap removed (was 4). The original limit was a conservative early
// guardrail with no documented motivation; in practice the real bottleneck is
// the initial prompt size, not a fixed character count. Authors are now free
// to add as many characters as their model context can carry — large casts
// will fail naturally with a context-overflow error from the LLM provider
// rather than a hard packager error.

// --- ExportBuilder: accumulator for staged tool calls ---

export interface StoryMetadata {
  genre: string
  tone: string
  constraints: string[]
  acts_options: ActOption[]
  default_acts: number
  /**
   * README catalog display fields (skill-catalog-autogen). LLM produces
   * candidates in set_story_metadata; user confirms / edits them via the
   * entering-catalog-info wizard step before packageSkill writes
   * soulkiller.json. Optional so legacy / test paths can skip them without
   * TypeScript errors; format validation happens at the tool layer.
   */
  world_slug?: string
  world_name?: string
  summary?: string
}

export interface CatalogCandidates {
  world_slug: string
  world_name: string
  summary: string
}

export interface CharacterDraft {
  name: string
  display_name?: string
  role: CharacterRole
  appears_from?: string
  dynamics_note?: string
  /**
   * 0-2 character-specific axes. Shared axes (bond + story_state's two
   * axes) are NOT stored here — they are implicit from the story state.
   */
  specific_axes?: CharacterAxis[]
  /**
   * Per-character overrides for the 3 shared axes' initial values. Keys
   * must be either `bond` or one of story_state.shared_axes_custom.
   */
  shared_initial_overrides?: CharacterAxisOverrides
  /**
   * Optional Chinese voice summary provided by the export agent when the
   * character's source style.md contains heavy non-target-language content.
   * Max 200 chars. Merged into story_spec.prose_style.character_voice_summary
   * at build time.
   */
  voice_summary?: string
}

/**
 * Soft cap used to warn the export agent when it declares an excessive
 * number of story-level flags. Not enforced — exceeding it only writes a
 * warning to the logger, the tool call still succeeds.
 */
export const FLAGS_SOFT_CAP = 8

// ── Tool-loop step cap configuration ────────────────────────────────────
//
// The export agent runs in a vercel AI SDK ToolLoopAgent. The `stopWhen`
// contains two conditions combined by OR:
//   (1) hasToolCall('finalize_export')  → successful termination
//   (2) stepCountIs(N)                   → dead-loop guard
//
// The guard N used to be a magic number 20 back when the workflow had
// 4 tool calls (set_story_metadata + add_character + set_character_axes +
// finalize_export) and characters were capped at 4. Subsequent changes
// expanded the workflow but nobody revisited the constant:
//
//   story-level-state        → added set_story_state        (+1 setup step)
//   prose-style-anchor       → added set_prose_style        (+1 setup step)
//   story-level-state        → removed character-count cap
//
// A 9-character export now needs AT LEAST 3 (setup) + 9×2 + 1 (finalize)
// = 22 steps, which is mathematically impossible under the old cap of 20.
// The scaling formula below ensures the cap always has headroom relative
// to the actual workflow length.

/**
 * Baseline setup tool calls before character registration begins:
 *   1. set_story_metadata
 *   2. set_story_state
 *   3. set_prose_style
 *
 * Must be updated when new story-level setup tools are added to the
 * workflow. The export-agent spec tracks the canonical step list.
 */
const STEP_SETUP_BASELINE = 3

/**
 * Per-character tool calls:
 *   1. add_character
 *   2. set_character_axes
 */
const STEP_PER_CHARACTER = 2

/**
 * Closing tool calls after all characters are registered:
 *   1. finalize_export
 */
const STEP_FINALIZE = 1

/**
 * Compute the dynamic step cap for the export agent's tool-loop, based on
 * the character count. The cap is a dead-loop guard, not a budget — the
 * formula guarantees normal flows finish well before the limit.
 *
 *   minimalSteps = STEP_SETUP_BASELINE + N × STEP_PER_CHARACTER + STEP_FINALIZE
 *   safetyBuffer = max(5, N)
 *   stepCap      = minimalSteps + safetyBuffer
 *
 * Examples:
 *   1  character  → 11 steps   (6 minimal + 5 buffer)
 *   4  characters → 17 steps   (12 minimal + 5 buffer)
 *   9  characters → 31 steps   (22 minimal + 9 buffer)
 *   12 characters → 40 steps   (28 minimal + 12 buffer)
 *
 * The buffer is `max(5, N)` because small skills need a minimum headroom
 * for occasional LLM retries, while large skills benefit from proportional
 * scaling since they have more intermediate steps where retries can happen.
 *
 * Exported for unit tests. Used internally by runExportAgent when
 * constructing the stopWhen condition.
 */
export function computeExportStepCap(characterCount: number): number {
  const safeCount = Math.max(0, characterCount)
  const minimalSteps = STEP_SETUP_BASELINE + safeCount * STEP_PER_CHARACTER + STEP_FINALIZE
  const safetyBuffer = Math.max(5, safeCount)
  return minimalSteps + safetyBuffer
}

/**
 * Test-only named export of the ExportBuilder class. The class is kept
 * module-private for runExportAgent, but unit tests need to exercise the
 * accumulator logic in isolation without spinning up a mock LLM. Consumers
 * should continue to use `runExportAgent` directly.
 */
export { ExportBuilder as __TEST_ONLY_ExportBuilder }

export class ExportBuilder {
  private metadata?: StoryMetadata
  private storyState?: StoryState
  private proseStyle?: ProseStyle
  private routeCharacters?: RouteCharacter[]
  private authorVersion?: string
  private readonly characters: Map<string, CharacterDraft> = new Map()
  private readonly insertionOrder: string[] = []

  constructor(
    private readonly preSelectedSouls: string[],
    private readonly worldName: string,
  ) {}

  setMetadata(m: StoryMetadata): void {
    if (!m.acts_options || m.acts_options.length === 0) {
      throw new Error('acts_options must be a non-empty array')
    }
    if (!m.acts_options.some((o) => o.acts === m.default_acts)) {
      throw new Error(`default_acts (${m.default_acts}) must match one of acts_options[i].acts`)
    }
    this.metadata = m
  }

  /**
   * Read the LLM-produced catalog display candidates after set_story_metadata
   * has run. Used by finalize.ts to feed the entering-catalog-info wizard
   * step (skill-catalog-autogen). Returns empty strings when metadata is not
   * yet set (caller is responsible for ordering).
   */
  getCatalogCandidates(): CatalogCandidates {
    return {
      world_slug: this.metadata?.world_slug ?? '',
      world_name: this.metadata?.world_name ?? '',
      summary: this.metadata?.summary ?? '',
    }
  }

  /**
   * Lock in the story-level state vocabulary: the two non-bond shared axes
   * (`shared_axes_custom`) and the full list of key-event flags. This must
   * be called after `setMetadata` and before any `addCharacter` call,
   * because per-character axis overrides can only reference axes that
   * exist in the story state.
   */
  setStoryState(s: StoryState): void {
    if (!this.metadata) {
      throw new Error('call set_story_metadata before set_story_state')
    }
    if (this.characters.size > 0) {
      throw new Error('set_story_state must be called before any add_character')
    }
    if (!s.shared_axes_custom || s.shared_axes_custom.length !== 2) {
      throw new Error('shared_axes_custom must be exactly 2 elements')
    }
    const [a, b] = s.shared_axes_custom
    // Reject bond in the custom list — it's platform-fixed.
    if (a === BOND_AXIS || b === BOND_AXIS) {
      throw new Error(`shared_axes_custom must not contain "${BOND_AXIS}" (platform-fixed axis is implicit)`)
    }
    // Custom axes must themselves be valid identifiers and distinct.
    if (a === b) {
      throw new Error('shared_axes_custom entries must be distinct')
    }
    const identPattern = /^[a-z][a-z0-9_]*$/
    for (const axis of [a, b]) {
      if (!identPattern.test(axis)) {
        throw new Error(`shared_axes_custom entry "${axis}" must be snake_case ASCII identifier`)
      }
    }
    if (!Array.isArray(s.flags)) {
      throw new Error('flags must be an array')
    }
    // Validate each flag shape.
    const seenFlagNames = new Set<string>()
    for (const f of s.flags) {
      if (!f.name || !identPattern.test(f.name)) {
        throw new Error(`flag name "${f.name}" must be snake_case ASCII identifier`)
      }
      if (seenFlagNames.has(f.name)) {
        throw new Error(`duplicate flag name: ${f.name}`)
      }
      seenFlagNames.add(f.name)
      if (typeof f.desc !== 'string' || f.desc.length === 0) {
        throw new Error(`flag "${f.name}" missing desc`)
      }
      if (typeof f.initial !== 'boolean') {
        throw new Error(`flag "${f.name}" initial must be boolean`)
      }
    }
    // Soft cap: warn but don't block.
    if (s.flags.length > FLAGS_SOFT_CAP) {
      logger.warn(
        `[export-agent] flags count (${s.flags.length}) exceeds soft cap (${FLAGS_SOFT_CAP}). Consider consolidating.`,
      )
    }
    this.storyState = s
  }

  /**
   * Lock in the story-level prose style anchor: target_language, voice_anchor,
   * forbidden_patterns, ip_specific rules, and optional per-character voice
   * summaries. This MUST be called after `setStoryState` and before any
   * `addCharacter` call. Every new export is required to call this — the
   * build() method throws when it's missing.
   *
   * Validation:
   * - target_language must be 'zh' (first version)
   * - voice_anchor length >= 20 chars
   * - forbidden_patterns length >= 3
   * - ip_specific length >= 3
   * - Each ip_specific entry length >= 10 chars (soft heuristic — abstract
   *   one-word rules are warned but not blocked)
   */
  setProseStyle(s: ProseStyle): void {
    if (!this.metadata) {
      throw new Error('call set_story_metadata before set_prose_style')
    }
    if (!this.storyState) {
      throw new Error('call set_story_state before set_prose_style')
    }
    if (this.characters.size > 0) {
      throw new Error('set_prose_style must be called before any add_character')
    }
    const validLanguages = ['zh', 'en', 'ja']
    if (!validLanguages.includes(s.target_language)) {
      throw new Error(`target_language must be one of ${validLanguages.join(', ')} (got: ${s.target_language})`)
    }
    if (typeof s.voice_anchor !== 'string' || s.voice_anchor.length < 20) {
      throw new Error('voice_anchor must be at least 20 characters')
    }
    if (!Array.isArray(s.forbidden_patterns) || s.forbidden_patterns.length < 3) {
      throw new Error('forbidden_patterns must have at least 3 entries')
    }
    // Validate each forbidden_pattern shape.
    const seenIds = new Set<string>()
    for (const p of s.forbidden_patterns) {
      if (!p.id || typeof p.id !== 'string') {
        throw new Error('forbidden_pattern entries must have an id')
      }
      if (seenIds.has(p.id)) {
        throw new Error(`duplicate forbidden_pattern id: ${p.id}`)
      }
      seenIds.add(p.id)
      for (const key of ['bad', 'good', 'reason'] as const) {
        if (typeof p[key] !== 'string' || p[key].length === 0) {
          throw new Error(`forbidden_pattern "${p.id}" missing ${key}`)
        }
      }
    }
    if (!Array.isArray(s.ip_specific) || s.ip_specific.length < 3) {
      throw new Error('ip_specific must have at least 3 entries')
    }
    for (const rule of s.ip_specific) {
      if (typeof rule !== 'string' || rule.length === 0) {
        throw new Error('ip_specific entries must be non-empty strings')
      }
    }
    // Soft heuristic: warn when ip_specific entries look abstract (too
    // short, or start with the common abstract phrasing openers).
    for (const rule of s.ip_specific) {
      if (rule.length < 10 || /^(应该|保持|避免|注意)/.test(rule.trim())) {
        logger.warn(
          `[export-agent] ip_specific rule looks abstract: "${rule}". Prefer concrete rules (e.g. "宝具/Servant 保留英文").`,
        )
      }
    }
    // Optional character_voice_summary validation.
    if (s.character_voice_summary) {
      for (const [charName, summary] of Object.entries(s.character_voice_summary)) {
        if (typeof summary !== 'string' || summary.length === 0) {
          throw new Error(`character_voice_summary["${charName}"] must be a non-empty string`)
        }
        if (summary.length > 200) {
          throw new Error(`character_voice_summary["${charName}"] exceeds 200 chars`)
        }
      }
    }
    this.proseStyle = s
  }

  /**
   * Set route focus characters. Called after all add_character calls.
   * Each route character must reference an already-added character by name.
   * Typical count: 2-3 characters with interesting conflict/growth potential.
   */
  setRouteCharacters(chars: RouteCharacter[]): void {
    if (chars.length === 0) {
      throw new Error('route_characters must be non-empty')
    }
    if (chars.length > 5) {
      throw new Error('route_characters should have at most 5 entries')
    }
    for (const rc of chars) {
      if (!rc.slug || !rc.name || !rc.reason) {
        throw new Error(`route character entry missing required fields: slug, name, reason`)
      }
    }
    this.routeCharacters = chars
  }

  addCharacter(
    c: Omit<CharacterDraft, 'specific_axes' | 'shared_initial_overrides' | 'voice_summary'> & {
      voice_summary?: string
    },
  ): void {
    if (!this.storyState) {
      throw new Error('call set_story_state before add_character')
    }
    if (!this.proseStyle) {
      throw new Error('call set_prose_style before add_character')
    }
    if (this.characters.has(c.name)) {
      throw new Error(`Character '${c.name}' already added`)
    }
    if (!this.preSelectedSouls.includes(c.name)) {
      throw new Error(`'${c.name}' not in pre-selected souls (${this.preSelectedSouls.join(', ')})`)
    }
    if (c.voice_summary !== undefined) {
      if (typeof c.voice_summary !== 'string' || c.voice_summary.length === 0) {
        throw new Error('voice_summary must be a non-empty string when provided')
      }
      if (c.voice_summary.length > 200) {
        throw new Error('character_voice_summary 不超过 200 字')
      }
    }
    this.characters.set(c.name, { ...c })
    this.insertionOrder.push(c.name)
  }

  /**
   * Set the character-specific (non-shared) axes and optional shared-axis
   * initial overrides. Specific axes are 0-2 per character; overrides keys
   * must be valid shared axes (bond or one of story_state.shared_axes_custom).
   */
  setAxes(
    name: string,
    specific_axes: CharacterAxis[],
    shared_initial_overrides?: CharacterAxisOverrides,
  ): void {
    const char = this.characters.get(name)
    if (!char) {
      throw new Error(`Character '${name}' not added yet — call add_character first`)
    }
    if (!this.storyState) {
      throw new Error('Internal: storyState missing despite character being registered')
    }
    if (specific_axes.length > 2) {
      throw new Error('specific_axes must have 0-2 elements')
    }
    // Validate specific axis shape.
    const specificAxisNames = new Set<string>()
    for (const a of specific_axes) {
      if (!a.english || !/^[a-z][a-z0-9_]*$/.test(a.english)) {
        throw new Error(`specific axis english "${a.english}" must be snake_case ASCII identifier`)
      }
      if (specificAxisNames.has(a.english)) {
        throw new Error(`duplicate specific axis: ${a.english}`)
      }
      specificAxisNames.add(a.english)
      if (typeof a.initial !== 'number' || a.initial < 0 || a.initial > 10) {
        throw new Error(`specific axis "${a.english}" initial must be number in [0, 10]`)
      }
    }
    // Reject specific axes that collide with shared axis names.
    const sharedAxes = new Set<string>([BOND_AXIS, ...this.storyState.shared_axes_custom])
    for (const a of specific_axes) {
      if (sharedAxes.has(a.english)) {
        throw new Error(`specific axis "${a.english}" collides with a shared axis name`)
      }
    }
    // Validate shared_initial_overrides keys.
    if (shared_initial_overrides) {
      for (const key of Object.keys(shared_initial_overrides)) {
        if (!sharedAxes.has(key)) {
          throw new Error(
            `unknown shared axis: ${key} (expected one of: ${[...sharedAxes].join(', ')})`,
          )
        }
        const value = shared_initial_overrides[key]
        if (typeof value !== 'number' || value < 0 || value > 10) {
          throw new Error(`shared_initial_overrides[${key}] must be number in [0, 10]`)
        }
      }
    }
    char.specific_axes = specific_axes
    char.shared_initial_overrides = shared_initial_overrides
  }

  characterCount(): number {
    return this.characters.size
  }

  preSelectedCount(): number {
    return this.preSelectedSouls.length
  }

  /**
   * Set the author-declared skill version (skill-author-version change).
   * Must be a non-empty string; the wizard guards empty values at the UI layer.
   * Callable at any point before `build()`.
   */
  setAuthorVersion(v: string): void {
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error('author_version must be a non-empty string')
    }
    this.authorVersion = v
  }

  build(): { souls: string[]; world_name: string; story_spec: StorySpecConfig } {
    if (!this.metadata) throw new Error('Missing set_story_metadata — call it before finalize_export')
    if (!this.storyState) throw new Error('Missing set_story_state — call it before finalize_export')
    if (!this.proseStyle) {
      throw new Error(
        'prose_style is required — call set_prose_style before finalize_export',
      )
    }
    if (this.characters.size === 0) throw new Error('No characters added — call add_character at least once')

    const charactersList: CharacterSpec[] = []
    // Merge per-character voice_summary into prose_style.character_voice_summary.
    const mergedVoiceSummary: Record<string, string> = {
      ...(this.proseStyle.character_voice_summary ?? {}),
    }
    for (const name of this.insertionOrder) {
      const draft = this.characters.get(name)!
      if (draft.specific_axes === undefined) {
        throw new Error(`Character '${draft.name}' missing set_character_axes call`)
      }
      if (draft.voice_summary) {
        mergedVoiceSummary[draft.name] = draft.voice_summary
      }
      charactersList.push({
        name: draft.name,
        display_name: draft.display_name,
        role: draft.role,
        axes: draft.specific_axes,
        shared_initial_overrides: draft.shared_initial_overrides,
        appears_from: draft.appears_from,
        dynamics_note: draft.dynamics_note,
        voice_summary: draft.voice_summary,
      })
    }

    const finalProseStyle: ProseStyle = {
      ...this.proseStyle,
      character_voice_summary:
        Object.keys(mergedVoiceSummary).length > 0 ? mergedVoiceSummary : undefined,
    }

    return {
      souls: [...this.insertionOrder],
      world_name: this.worldName,
      story_spec: {
        // story_name is filled in by finalize_export (from preSelected.storyName)
        story_name: '',
        genre: this.metadata.genre,
        tone: this.metadata.tone,
        constraints: this.metadata.constraints,
        acts_options: this.metadata.acts_options,
        default_acts: this.metadata.default_acts,
        characters: charactersList,
        story_state: this.storyState,
        prose_style: finalProseStyle,
        route_characters: this.routeCharacters,
        author_version: this.authorVersion ?? '0.0.0',
      },
    }
  }
}

// --- Export Plan types (output of Planning Agent, input to Execution Agent) ---

export interface ExportPlanCharacter {
  name: string
  role: 'protagonist' | 'deuteragonist' | 'antagonist'
  specific_axes_direction: string[]
  needs_voice_summary: boolean
  appears_from?: number
  shared_initial_overrides_hint?: Record<string, number>
}

export interface RouteCandidate {
  slug: string
  name: string
  reason: string
}

export interface ExportPlan {
  genre_direction: string
  tone_direction: string
  shared_axes: string[]
  flags: string[]
  prose_direction: string
  characters: ExportPlanCharacter[]
  route_candidates?: RouteCandidate[]
}

// --- Progress event types ---

export type ExportProgressEvent =
  | { type: 'phase'; phase: ExportPhase }
  | { type: 'tool_start'; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; result_summary: string }
  | { type: 'ask_user_start'; question: string; options?: AskUserOption[]; allow_free_input?: boolean; multi_select?: boolean }
  | { type: 'ask_user_end'; answer: string }
  | { type: 'package_step'; step: string; status: 'pending' | 'running' | 'done' }
  /**
   * Emitted while a reasoning model (e.g. glm-5-turbo) streams its internal
   * thinking. The UI can show "推理中 (N tokens)" instead of the generic
   * "思考中" so the user knows the model is actively reasoning rather than
   * stuck on the network. Approximate token count = char count / 4.
   */
  | { type: 'reasoning_progress'; chars: number; tokens: number }
  | { type: 'plan_ready'; plan: ExportPlan; storyDirection?: string; exportLanguage?: string }
  | { type: 'plan_confirmed' }
  /**
   * skill-catalog-autogen: after agent finalize_export but before packageSkill
   * writes soulkiller.json, finalize emits this event with the LLM-produced
   * catalog candidates. The UI is expected to render the entering-catalog-info
   * wizard step and resolve with the user-confirmed values (see
   * OnCatalogConfirm).
   */
  | { type: 'catalog_confirm_request'; candidates: CatalogCandidates }
  | { type: 'complete'; output_file: string; file_count: number; size_bytes: number; skill_name: string }
  | { type: 'error'; error: string }

export type ExportPhase = 'initiating' | 'planning' | 'plan_review' | 'selecting' | 'analyzing' | 'configuring' | 'route_selection' | 'packaging' | 'complete' | 'error'

export interface AskUserOption {
  label: string
  description?: string
  preSelected?: boolean
}

export type OnExportProgress = (event: ExportProgressEvent) => void
/**
 * Ask user handler.
 * When `multiSelect` is true, the returned string is a comma-separated list of labels.
 */
export type AskUserHandler = (question: string, options?: AskUserOption[], allowFreeInput?: boolean, multiSelect?: boolean, maxSelect?: number) => Promise<string>

/**
 * Bridges finalize.ts → export.tsx wizard for catalog info confirmation
 * (skill-catalog-autogen). Returns the user-confirmed fields, or `null` when
 * the user pressed Esc (signal to cancel packaging).
 */
export type OnCatalogConfirm = (candidates: CatalogCandidates) => Promise<CatalogCandidates | null>

// --- Pre-selected export data (passed in from CLI layer) ---

export interface SoulFullData {
  name: string
  manifest: SoulManifest
  identity: string
  style: string
  capabilities: string
  milestones: string
  behaviors: { name: string; content: string }[]
}

export interface WorldFullData {
  name: string
  manifest: WorldManifest
  entries: { name: string; meta: Record<string, unknown>; content: string }[]
}

export interface PreSelectedExportData {
  souls: string[]
  worldName: string
  soulsData: SoulFullData[]
  worldData: WorldFullData
  /** Story name provided by the user (required) — used as skill identity */
  storyName: string
  /** Optional free-form user direction (injected as highest priority into agent prompt) */
  storyDirection?: string
  /** Absolute parent directory where the skill dir will be created */
  outputBaseDir: string
  /** Target language for exported skill content (zh/en/ja). Defaults to config.language. */
  exportLanguage: 'zh' | 'en' | 'ja'
  /**
   * Author-declared skill version (skill-author-version change) — the string
   * the author typed into the wizard's version step. Written into the
   * archive's `soulkiller.json.version` field.
   */
  authorVersion: string
}

/**
 * Callback that waits for user to confirm or cancel the plan.
 * Returns true if confirmed, false if cancelled.
 */
export type PlanConfirmHandler = () => Promise<boolean>
