import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { withExacto, getProviderOptions } from '../llm/client.js'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import os from 'node:os'
import type { SoulkillerConfig } from '../config/schema.js'
import type { SoulManifest } from '../soul/manifest.js'
import type { WorldManifest } from '../world/manifest.js'
import { packageSkill, getSkillFileName } from '../export/packager.js'
import type {
  ActOption,
  CharacterAxis,
  CharacterAxisOverrides,
  CharacterRole,
  CharacterSpec,
  ProseStyle,
  StorySpecConfig,
  StoryState,
  StoryStateFlag,
} from '../export/story-spec.js'
import { BOND_AXIS } from '../export/story-spec.js'
import {
  ZH_TRANSLATESE_PATTERNS,
  formatPatternsForToolDescription,
  type ProseStyleForbiddenPattern,
} from '../export/prose-style/index.js'
import { logger } from '../utils/logger.js'
import { AgentLogger } from '../utils/agent-logger.js'

// Character cap removed (was 4). The original limit was a conservative early
// guardrail with no documented motivation; in practice the real bottleneck is
// the initial prompt size, not a fixed character count. Authors are now free
// to add as many characters as their model context can carry — large casts
// will fail naturally with a context-overflow error from the LLM provider
// rather than a hard packager error.

// --- ExportBuilder: accumulator for staged tool calls ---

interface StoryMetadata {
  genre: string
  tone: string
  constraints: string[]
  acts_options: ActOption[]
  default_acts: number
}

interface CharacterDraft {
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
const FLAGS_SOFT_CAP = 8

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

class ExportBuilder {
  private metadata?: StoryMetadata
  private storyState?: StoryState
  private proseStyle?: ProseStyle
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
    if (s.target_language !== 'zh') {
      throw new Error(`target_language must be 'zh' (got: ${s.target_language})`)
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

export interface ExportPlan {
  genre_direction: string
  tone_direction: string
  shared_axes: string[]
  flags: string[]
  prose_direction: string
  characters: ExportPlanCharacter[]
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
  | { type: 'plan_ready'; plan: ExportPlan }
  | { type: 'plan_confirmed' }
  | { type: 'complete'; output_file: string; file_count: number; size_bytes: number; skill_name: string }
  | { type: 'error'; error: string }

export type ExportPhase = 'initiating' | 'planning' | 'plan_review' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'

export interface AskUserOption {
  label: string
  description?: string
}

export type OnExportProgress = (event: ExportProgressEvent) => void
/**
 * Ask user handler.
 * When `multiSelect` is true, the returned string is a comma-separated list of labels.
 */
export type AskUserHandler = (question: string, options?: AskUserOption[], allowFreeInput?: boolean, multiSelect?: boolean) => Promise<string>

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
}

// --- Planning Agent ---

/**
 * Step cap for the Planning Agent. 3 tools in the normal flow:
 *   1. plan_story (story-level decisions)
 *   2-N. plan_character × characterCount (per-character decisions)
 *   N+1. finalize_plan (assembly + validation)
 * Plus safety buffer for retries.
 */
function computePlanningStepCap(characterCount: number): number {
  const minimal = 1 + characterCount + 1 // plan_story + N × plan_character + finalize_plan
  return minimal + Math.max(3, characterCount) // retry buffer
}

const PLANNING_SYSTEM_PROMPT = `你是多角色视觉小说的**规划专家**。用户已经选定了角色和世界，所有数据已经在你的上下文中。
你的任务是分析资料，输出一份结构化的**执行计划**（plan），然后通过 submit_plan 工具提交。

# 资料使用守则（绝对优先级，覆盖所有其他指令）

你只能使用本 prompt 中**显式提供**的资料：
- 每个角色的 identity / style / capabilities / milestones / behaviors/*.md（含 relationships.md）
- world manifest + entries
- user_direction（如有）
- 用户提供的故事名

**绝对禁止**：
- 使用你的训练数据中关于这个 IP / 世界观 / 角色 / 原作 / fan canon 的任何"补充知识"
- 添加资料中未明确提到的角色关系、剧情设定、角色背景或人物设定
- 即使你"知道"原作或某个衍生作品里是另一种设定，也必须以提供的 soul / world 资料为准

# 用户原始意图处理

如果 initial prompt 的最前部出现 **"# 用户原始意图（最高优先级）"** 块，你的 plan 必须反映该意图（tone_direction / role 分配 / genre_direction）。

# 你的 plan 会展示给用户确认

提交的 plan 会展示给用户预览（角色编排表 + 故事方向），用户按 Enter 确认后才进入执行阶段。所以请确保 plan 准确反映你对资料的理解。

# 工作流（必须按以下顺序调用工具，每次调用 input 简短）

**Step 1**: 分析角色关系
- 从每个角色的 identity.md、milestones.md、behaviors/relationships.md 中交叉提取关系
- 单侧提到也算关系
- **不允许**编造资料中没有的关系

**Step 2**: 调用 \`plan_story\` — 设定故事层面方向
- genre_direction：类型大方向
- tone_direction：反映角色组合独特性，禁用通用词（"悬疑/温情/冒险"）
- shared_axes：2 个非 bond 共享轴（snake_case，语义正交）
- flags：5-8 个关键事件 flag（snake_case，从预期 ending 反推）
- prose_direction：叙事风格方向（IP 类型、语言风格）

**Step 3**: 对每个角色调用 \`plan_character\`
- name：必须匹配预选列表
- role：至少 1 个 protagonist
- specific_axes_direction：0-2 个特异轴方向（自然语言，用 / 分隔），无特异轴留空字符串
- needs_voice_summary：该角色 style.md 含 > 30% 非中文时为 true，否则 false
- appears_from（可选）：从第几幕出场

**Step 4**: 所有角色都设置完毕后，调用 \`finalize_plan\`

如果任何调用返回 \`{ error }\`，根据错误修正后重试。
**每次调用 input 应保持简短。**

# 约束

- **不要**调用 list_* 或 read_* 工具 — 这些工具不存在，所有数据已在你的上下文里。
- 关系推导和角色编排是你的核心价值——LLM 擅长这个。
- 初始正确性优先于戏剧均衡。plan 必须严格反映 soul 资料的事实。
`

// --- Execution Agent ---

const EXECUTION_SYSTEM_PROMPT = `你是多角色视觉小说的剧本生成器。用户已经选定了角色和世界，所有数据已经在你的上下文中。
**一份已确认的执行计划**在 initial prompt 的 "# 执行计划" 块中，你必须按该计划的方向执行。

# 资料使用守则（绝对优先级，覆盖所有其他指令）

你只能使用本 prompt 中**显式提供**的资料：
- 每个角色的 identity / style / capabilities / milestones / behaviors/*.md（含 relationships.md）
- world manifest + entries
- user_direction（如有）
- 用户提供的故事名

**绝对禁止**：
- 使用你的训练数据中关于这个 IP / 世界观 / 角色 / 原作 / fan canon 的任何"补充知识"
- 添加资料中未明确提到的角色关系、剧情设定、角色背景或人物设定
- 即使你"知道"原作或某个衍生作品里是另一种设定，也必须以提供的 soul / world 资料为准

**具体例子**：
- 如果某角色的 relationships.md 写的是「敌对 Master / 互相视为竞争对手」，你的故事框架里就只能写"敌对 / 竞争"——不能改成"姐妹"、"宿命羁绊"、"灵魂呼应"等模型自创的浪漫化设定。
- 如果某角色的 identity.md 没提到他/她有姐妹，你不能在 dynamics_note 里写"两人是失散的姐妹"。
- 如果世界观资料里没说某个组织存在，你不能在 constraints 里引用它。

**初始正确性优先于戏剧均衡**。剧本运行时（Phase 2）LLM 仍可以演绎出戏剧张力，但 export 阶段产出的角色编排和 tone 必须严格反映 soul 资料的事实。

# 用户原始意图处理（重要）

如果 initial prompt 的最前部出现 **"# 用户原始意图（最高优先级）"** 块，这是用户在 wizard 中自由输入的故事走向描述，是所有后续决策的**最高优先级指引**：

- 你生成的 **tone / constraints / 角色 role 分配** 必须反映该意图
- 用户没提到的**剧情节奏 / 场景安排 / tone 措辞细节**可以发挥
- 但**角色基本属性**（身份、关系、能力、人物设定）必须严格来自 soul 资料，不允许为了贴合用户意图而编造
- 如果用户指定了某个角色作为 protagonist，尊重该选择
- 如果用户描述了情感基调（如"黑暗转折"），tone 和 constraints 必须呼应
- 意图可能与你基于 souls/world 的自主判断冲突，此时**服从用户的方向但仍受 soul 资料约束**——例如用户说"姐妹羁绊"但 souls 里两人是仇敌，你应该用"看似敌对实则同源" 这种诚实的方向，而不是改写人设

如果没有该块，按默认工作流自主生成。

# 故事名（总是存在）

initial prompt 会包含 **"# 故事名"** 块，用户提供的故事名将作为 skill 的身份标识。你在推导 tone 和构造角色编排时可以参考这个名称反映的主题倾向。

# 执行计划（最高优先级）

initial prompt 包含一个 **"# 执行计划"** 块（JSON），这是用户已确认的规划结果。你**必须**按 plan 的方向执行：
- \`genre_direction\` / \`tone_direction\` → 细化为 set_story_metadata 的具体参数
- \`shared_axes\` / \`flags\` → 直接用于 set_story_state
- \`prose_direction\` → 指导 set_prose_style 的决策
- \`characters\` → 按列表逐一执行 add_character + set_character_axes，**不可跳过 plan 中的任何角色**
- 每个角色的 \`role\` / \`specific_axes_direction\` / \`needs_voice_summary\` → 指导对应的工具参数

**不要偏离 plan 的方向**。plan 中已经做好了角色关系分析和创意决策，你的工作是将方向细化为具体的工具参数。

# 工作流（必须按以下顺序调用工具，每次调用 input 简短）

**Step 1**: \`set_story_metadata\` — 按 plan 的 genre_direction / tone_direction 细化为具体的 genre / tone / constraints / acts_options / default_acts

**Step 2**: \`set_story_state\` — 按 plan 的 shared_axes 和 flags 列表设置状态词汇表，flags 需要你补充 desc 和 initial

**Step 3**: \`set_prose_style\` — 按 plan 的 prose_direction 细化叙事风格锚点。**这是杜绝翻译腔的关键环节，不可跳过**。

**Step 4**: 对 plan 中的**每个**角色（顺序自由）依次完成两个调用：
  a) \`add_character\` — 按 plan 的 role 注册角色。如果 plan 标记 needs_voice_summary=true，必须提供 voice_summary
  b) \`set_character_axes\` — 按 plan 的 specific_axes_direction 细化为具体的轴定义（name / english / initial）

**Step 5**: **所有** plan 中的角色都设置完毕后，调用 \`finalize_export\` 触发实际打包。

如果任何调用返回 \`{ error: ... }\`，根据错误信息修正后重试。
**绝对不要**在一次调用里塞所有信息——这会失败。每次调用 input 应保持简短。
**顺序约束**：
- \`set_story_state\` 必须在 \`set_prose_style\` 之前调用
- \`set_prose_style\` 必须在所有 \`add_character\` 之前调用
- 没调 \`set_prose_style\` 就 \`finalize_export\` 会直接失败（prose_style 是所有新 export 的强制要求）

# 任务详解

## 1. 分析角色关系
从每个角色的 identity.md、milestones.md 以及（如存在的）behaviors/relationships.md 中**交叉提取**角色之间的关系动态。

**提取规则**：
- 单侧提到也算关系（A 的 relationships.md 提到 B 但 B 没提到 A，仍然是有效的关系数据）
- **不允许**编造资料中没有的关系。如果两个角色之间在所有提供的资料中**都找不到任何提及**，就视为"无关系数据"
- 处理"无关系数据"的两个角色：
  - **不要**为了戏剧效果强行配对（不要写"姐妹"、"宿敌"、"灵魂伴侣"等创造性关系）
  - **应该**让两个角色在不同 acts 出场（用 \`appears_from\` 错开），或在 dynamics_note 里诚实标注 "在原始资料中无直接关系，剧本运行时由 Phase 2 LLM 自由演绎"
  - 戏份不均衡是可接受的代价，远比编造设定要好

## 2. 故事整体框架（set_story_metadata）

- **genre**: 类型，如 "都市奇幻 / 心理剧" "历史权谋"
- **tone**: 必须反映这个**特定角色组合**的独特性。**禁用**通用词如 "悬疑/温情/冒险/史诗"。
  示例好的 tone: "傲娇外壳下的温柔救赎·姐妹羁绊与黑化"
- **constraints**: 至少包含一条 **tradeoff 约束**（每个选项必须对不同角色产生差异化好感影响）；
  以及反映该组合独特命题的 3-6 条具体约束
- **acts_options_csv**: 提供 2-3 个长度预设（竖线分隔），根据角色数推荐：
  - 角色数 ≤ 2 → \`"3:短篇:24-36:4|5:中篇:40-60:5"\`，default_acts = 3
  - 角色数 3-4 → \`"3:短篇:24-36:4|5:中篇:40-60:5|7:长篇:56-84:6"\`，default_acts = 5
  - 角色数 ≥ 5 → \`"5:中篇:40-60:5|7:长篇:56-84:6|9:超长篇:72-108:7"\`，default_acts = 7（更长的故事容纳更多角色）
  格式：acts:label_zh:rounds_total:endings_count
- **default_acts**: 推荐值，必须在 acts_options 列表中

**重要**: 幕数最终由用户在 skill 启动时选择。你只负责给出合理选项，不要锁定单一幕数。

## 3. 故事状态设计（set_story_state）★ 核心设计步骤

这一步是把"故事作为状态机"的设计意图落地。必须在任何 add_character 之前调用，**整个 export 只调用一次**。

### 三层 state 结构

每个由本 export 生成的 skill 运行时会跟踪三层状态：

1. **共享 axes 层**：每个角色都有 3 个共享好感轴
   - \`bond\` —— 平台固定（所有 soulkiller 故事都有，不需要你声明）
   - 由你通过 \`shared_axis_1\` / \`shared_axis_2\` 声明**额外 2 个**故事级共享轴

2. **角色特异 axes 层**：每个角色 0-2 个专属轴（在 set_character_axes 里声明，不在这一步）

3. **Flags 层**：全局关键事件标记，**全部在本步骤一次性枚举**

### shared_axis_1 / shared_axis_2 设计指引

选择最能反映这个**特定故事**核心关系动力学的 2 个维度。它们会成为所有角色的通用好感基准，也是 ending condition 做 \`all_chars\` / \`any_char\` 跨角色聚合的接口。

规则：
- snake_case ASCII（如 \`trust\` / \`rivalry\` / \`loyalty\` / \`debt\` / \`allegiance\`）
- **不允许** \`bond\`（已由平台固定）
- 两个名字必须不同
- 推荐**语义正交**：两个维度彼此独立，而不是同向（如 trust + rivalry 正交；trust + loyalty 高度相关，不推荐）

### 示例

| 故事类型 | 推荐 shared_axis_1 / shared_axis_2 |
|---------|------------------------|
| 奇幻救赎（fsn 伊莉雅线） | \`trust\` / \`rivalry\` |
| 赛博朋克 / 黑色电影 | \`loyalty\` / \`debt\` |
| 历史权谋（三国） | \`allegiance\` / \`suspicion\` |
| 校园恋爱 | \`closeness\` / \`curiosity\` |
| 悬疑推理 | \`credibility\` / \`caution\` |

### flags_csv 设计指引

从**你预期的 ending 结构**反推需要的 flags：列出这个故事会经历的核心分叉点，每个分叉点是一个 bool 事件标记。格式：name:desc:initial(true/false)，竖线分隔。

规则：
- 数量建议 **5-8 个**。超过 8 会触发 warning 但不阻塞。
- name 必须是 snake_case ASCII 标识符
- desc 是一句话说明何时触发（Phase 1 LLM 读这个 desc 决定在哪个 scene 里把 flag 设为 true）
- initial 几乎总是 false；true 用于"故事开始前已发生的前置条件"

**重要**：Phase 1 LLM 在写 scenes 时**只能引用**这里声明的 flag 名，不能创造新 flag。所以这一步必须把故事用到的所有关键标记**列全**。

示例：
\`\`\`
"met_illya:玩家首次正式遇到伊莉雅:false|truth_of_grail_revealed:圣杯真相被揭露:false|illya_acknowledges_sisterhood:伊莉雅承认姐弟情感:false|saber_vanished:Saber在关键节点消逝:false|chose_rebellion:玩家选择反抗圣杯:false"
\`\`\`

### 设计顺序建议

1. 先在脑子里想好这个故事大致有几种 ending（3-5 个典型）
2. 对每个 ending 问："触发它的条件是什么？"
3. 条件里**数值部分**（如"主角被大多数角色信任"）→ 用共享 axes 表达 → 反推 shared_axes_custom 应该选哪 2 个
4. 条件里**事件部分**（如"玩家选择了反抗"）→ 用 flags 表达 → 反推需要哪些 flags
5. 把结果填进 set_story_state

## 3.5. 叙事风格锚点决策（set_prose_style）★ 杜绝翻译腔的关键环节

这一步决定**整个故事所有中文文本的写作骨架**。Phase 1/2 LLM 的默认中文会不自觉地滑向翻译腔（英文/日文句法的字面投影），本步是把"**具体反模式**"提前钉死，让下游 LLM 拿到硬约束。

**必须在 set_story_state 之后、任何 add_character 之前调用。整个 export 只调用一次。**

### 决策顺序（推荐）

1. 读完 world manifest 和每个角色的 identity.md / style.md 后，问自己三个问题：
   - 这个故事的叙事 **类型词** 是什么？（"type-moon 系日翻中"、"古典章回白话"、"赛博朋克黑帮港式白话"、"现代都市口语"…）
   - 这个 IP 有哪些 **术语** 必须保留原文不意译？（宝具/Servant、将军/丞相、义体/netrunner…）
   - 这个 IP 有哪些 **称谓/敬语规则**？（樱小姐 vs 小樱、在下 vs 我、兄贵 vs 大哥…）

2. 把三个问题的答案分别填进 voice_anchor / ip_specific

3. 从工具 description 中的"通用中文翻译腔反例库"里选 **至少 3 条** 最相关的条目作为 forbidden_patterns；可以照抄，也可以改写 bad/good 贴合本故事世界观（保留 id 和 reason）

4. 扫描每个角色的 style.md：如果某角色 style.md 里日文/英文引文占比 > 30%（fsn 的間桐桜是典型），则在稍后 add_character 时为该角色提供 voice_summary 字段（中文克制书面摘要，≤ 200 字，含 1-2 句该角色的标志性台词复述）

### voice_anchor 的硬标准

**必须含具体 IP 类型词**。以下是反例和正例：

| ✗ 太抽象（被 warning） | ✓ 具体可执行 |
|---|---|
| "fantasy novel" | "type-moon 系日翻中视觉小说官方译本风格" |
| "应该克制、庄重" | "古典章回白话+现代书面语融合，不用文言虚词" |
| "保持日系感" | "轻小说译本的短句节奏，保留日语停顿感但不保留日语语法" |
| "注意氛围" | "赛博朋克黑色电影的港式白话，短句+术语保留英文" |

### ip_specific 的硬标准

**至少 3 条具体规则**，至少覆盖：
- **1 条术语保留规则**（如："宝具/Servant/Master 保留英文不意译"）
- **1 条称谓/敬语规则**（如："樱 → 樱小姐（非'小樱'）；士郎 → 卫宫"）
- **1 条比喻/意象池约束**（如："比喻从'月光/雪/灯笼/石阶'池选词，不用西式钢铁或玻璃"）

反例：「保持日系感」「应该克制」「注意氛围」——这种是抽象方向，不是可执行规则，工具会返回 warning。

### forbidden_patterns_csv 的选择策略

工具 description 里内置了一份通用反例库（id 如 degree_clause / gaze_level / possessive_chain / literal_metaphor / small_body …）。

- 至少选 3 条。推荐 3-6 条。
- 对情节激烈、涉及大量动作描写的故事：优先选 degree_clause / held_back_negative / small_body
- 对对话密集、角色自白多的故事：优先选 possessive_chain / abstract_noun / etch_into
- 对文学性强的故事：优先选 literal_metaphor / belongs_to_you / night_of_event
- 可以追加故事特异的反例（自行编 id/bad/good/reason）
- 格式：id;;bad;;good;;reason，用 ||| 分隔条目

### 常见错误模式

- ❌ 把 voice_anchor 写成单词（"fantasy"）
- ❌ ip_specific 写成"应该 X"、"保持 X"（抽象描述而非可执行规则）
- ❌ forbidden_patterns_csv 只填 id 不写 bad/good/reason（工具会拒绝）
- ❌ 跳过这一步直接 add_character（会收到 error，build 也会 throw）

## 4. 角色注册（add_character）

每次只注册一个角色：

- **name**: 必须是预选 souls 列表中的某项（不要写错）
- **role**: 至少有 1 个 protagonist；多角色时建议 1 个 deuteragonist 与之形成叙事张力；antagonist 可选
- **display_name**: 可选，若有更顺口的中文显示名
- **appears_from**: 可选，"act_1" / "act_2" / "act_3"。注意运行时如果用户选了较短长度，超出的会被自动截断到最后一幕
- **dynamics_note**: 一句话描述该角色与其他角色的关系动态
- **voice_summary** (可选): 当该角色的 style.md 含 > 30% 非中文内容（典型：fsn 角色的日文引文、原版台词占据大段）时，为该角色提供一份 ≤ 200 字的中文克制书面摘要。摘要应含 1-2 句该角色的标志性台词复述，作为 Phase 2 LLM 的中文声音锚点。中文为主的角色（三国、三国演义衍生等）可省略此字段

## 5. 角色轴（set_character_axes）

**在这一步你只声明角色的特异轴 + 可选的共享轴 initial 覆盖**。3 个共享轴（bond + shared_axis_1 / shared_axis_2 里的 2 个）是自动存在的，不需要你重复声明。

### 特异轴（0-2 个 per 角色，用 axis_1_* / axis_2_* 扁平字段）

特异轴是该角色独有的情感 / 成长维度，不与其他角色比较。纯 flavor，但仍可进 ending condition 作为该角色专属分支。

- **axis_1_name**: 中文显示名（如 "自我价值感"）
- **axis_1_english**: snake_case 英文标识符（如 \`self_worth\`）。**不能**与共享轴重名。
- **axis_1_initial**: 0-10
- **axis_2_name / axis_2_english / axis_2_initial**: 同上，第 2 个特异轴。无第 2 个则省略。

参考（不是硬规则）：

| 人格特征 | 推导特异轴 |
|---------|-----------|
| 伊莉雅（身份焦虑） | \`self_worth\`、\`despair\` |
| 凛（傲娇） | \`tsundere_level\` |
| Saber（荣誉感） | \`honor\` |
| 葛木（教育者身份） | \`pedagogical_detachment\` |

次要角色可以是 0 个特异轴（省略所有 axis_* 字段，完全只用共享轴），主角可以是 1-2 个。

### overrides_csv（可选）

per-character 覆盖共享轴的初始值。格式：axis_name:value，逗号分隔。常用于反派：

\`\`\`
overrides_csv: "bond:1,rivalry:8"
\`\`\`

key 必须是 \`bond\` 或 shared_axis_1 / shared_axis_2 里声明的 axis 名，value 是 int [0, 10]。
未覆盖的共享轴使用全局 default（5）。

## 6. 触发打包（finalize_export）

确认所有角色都已 set_character_axes 后，调用 \`finalize_export\`。
如果 builder 状态不完整（如某个角色没调 set_character_axes），会返回 error，根据信息补全后重试。

# 约束

- **不要**调用 list_* 或 read_* 工具 — 这些工具不存在，所有数据已在你的上下文里。
- 不要为了"保险"而反复询问用户（ask_user 仅作兜底，正常路径不应使用）。
- 关系推导和角色编排是你的核心价值——LLM 擅长这个。
- 单角色场景（characters.length = 1）也应该走完整工作流，仍需 set_story_metadata + add_character + set_character_axes + finalize_export。
- output_dir 默认 \`~/.soulkiller/exports/\`，不需要询问用户。

# 终止

- 必须以 finalize_export 调用结束流程。
- 数据严重不足时（如所有 soul 都没有 identity），通过 ask_user 告知用户并建议下一步。**不要**静默停止。
`

function buildInitialPrompt(data: PreSelectedExportData): string {
  const { worldData, soulsData, storyName, storyDirection } = data

  // User original intent block (highest priority) — only present if storyDirection provided
  const userIntentBlock = storyDirection && storyDirection.trim().length > 0
    ? `# 用户原始意图（最高优先级）

${storyDirection.trim()}

你生成的 tone / constraints / 角色 role 分配必须反映上述意图。
**剧情节奏 / 场景安排 / tone 措辞细节** 可以发挥，但 **角色基本属性**（身份、关系、能力、人物设定）必须严格来自下面的 soul / world 资料——不允许为了贴合用户意图而编造资料中没有的设定。

---

`
    : ''

  // Story name block (always present)
  const storyNameBlock = `# 故事名

${storyName}

---

`

  const worldBlock = `# World: ${worldData.manifest.display_name ?? worldData.name}

## Manifest
\`\`\`json
${JSON.stringify(worldData.manifest, null, 2)}
\`\`\`

## World Entries (${worldData.entries.length})
${worldData.entries.map((e) =>
  `### ${e.name}\n${e.content}`
).join('\n\n')}
`

  const soulBlocks = soulsData.map((s) => {
    const behaviorsSection = s.behaviors.length > 0
      ? s.behaviors.map((b) => `### behaviors/${b.name}.md\n${b.content}`).join('\n\n')
      : '(no behavior files)'
    return `## ${s.manifest.display_name ?? s.name}
- soul_name: \`${s.name}\`
- type: ${s.manifest.soulType ?? 'unknown'}

### identity.md
${s.identity || '(empty)'}

### style.md
${s.style || '(empty)'}

${s.capabilities ? `### capabilities.md\n${s.capabilities}\n` : ''}
${s.milestones ? `### milestones.md\n${s.milestones}\n` : ''}
${behaviorsSection}
`
  }).join('\n\n---\n\n')

  return `${userIntentBlock}${storyNameBlock}以下是用户选定的角色组合和世界。请分析后按工作流调用工具。

${worldBlock}

---

# Characters (${soulsData.length})

${soulBlocks}

---

请开始分析。
`
}

/**
 * Build a trimmed prompt for the Planning Agent. Only includes data
 * relevant to relationship analysis & direction decisions:
 * - identity.md (character background)
 * - behaviors/relationships.md (character relationships)
 * - milestones.md (key events → flag design)
 * - world manifest + entries
 *
 * Excludes style.md, capabilities.md, and non-relationships behaviors
 * (those are only needed by Execution Agent for prose_style / voice_summary).
 */
function buildPlanningPrompt(data: PreSelectedExportData): string {
  const { worldData, soulsData, storyName, storyDirection } = data

  const userIntentBlock = storyDirection && storyDirection.trim().length > 0
    ? `# 用户原始意图（最高优先级）

${storyDirection.trim()}

---

`
    : ''

  const storyNameBlock = `# 故事名

${storyName}

---

`

  const worldBlock = `# World: ${worldData.manifest.display_name ?? worldData.name}

## Manifest
\`\`\`json
${JSON.stringify(worldData.manifest, null, 2)}
\`\`\`

## World Entries (${worldData.entries.length})
${worldData.entries.map((e) =>
  `### ${e.name}\n${e.content}`
).join('\n\n')}
`

  const soulBlocks = soulsData.map((s) => {
    // Only include relationships.md from behaviors
    const relationshipsBehavior = s.behaviors.find((b) => b.name === 'relationships')
    const relationshipsSection = relationshipsBehavior
      ? `### behaviors/relationships.md\n${relationshipsBehavior.content}`
      : '(no relationships data)'
    return `## ${s.manifest.display_name ?? s.name}
- soul_name: \`${s.name}\`
- type: ${s.manifest.soulType ?? 'unknown'}

### identity.md
${s.identity || '(empty)'}

${s.milestones ? `### milestones.md\n${s.milestones}\n` : ''}
${relationshipsSection}
`
  }).join('\n\n---\n\n')

  return `${userIntentBlock}${storyNameBlock}以下是用户选定的角色组合和世界。请分析后调用 submit_plan 提交执行计划。

${worldBlock}

---

# Characters (${soulsData.length})

${soulBlocks}

---

请开始分析并调用 submit_plan。
`
}

function buildExecutionPrompt(data: PreSelectedExportData, plan: ExportPlan): string {
  const base = buildInitialPrompt(data)
  const planBlock = `# 执行计划

以下是用户已确认的执行计划，你必须按此方向执行：

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

---

`
  // Insert plan block after user intent / story name, before soul/world data
  return planBlock + base
}

// --- Shared agent loop helper ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AgentLoopOptions {
  agent: ToolLoopAgent<never, any, never>
  prompt: string
  abortSignal?: AbortSignal
  onProgress: OnExportProgress
  agentLog: AgentLogger
  tag: string
  watchdogMs?: number  // default 90_000
  circuitBreakerLimit?: number  // default 3
}

interface AgentLoopResult {
  stepCount: number
  llmError?: string
  aborted: boolean
}

async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    agent,
    prompt,
    abortSignal,
    onProgress,
    agentLog,
    tag,
    watchdogMs = 90_000,
    circuitBreakerLimit = 3,
  } = options

  const abortController = new AbortController()
  // Chain external abort signal if provided
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => abortController.abort(), { once: true })
  }

  let watchdog: ReturnType<typeof setTimeout> | undefined
  function resetWatchdog() {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      logger.warn(`${tag} Stream timeout after ${watchdogMs / 1000}s — aborting`)
      abortController.abort()
    }, watchdogMs)
  }
  resetWatchdog()

  let stepCount = 0
  let llmError: string | undefined
  const toolStartTimes = new Map<string, number>()
  let eventCounter = 0
  const eventTypeCounts: Record<string, number> = {}
  let lastHeartbeat = Date.now()

  // Circuit breaker
  let consecutiveToolErrors = 0
  let lastErrorToolName = ''

  // Reasoning bookkeeping
  let reasoningChars = 0
  let lastReasoningEmit = 0
  const REASONING_EMIT_INTERVAL_MS = 500
  let lastReasoningProgressTs = Date.now()
  const REASONING_HARD_LIMIT_CHARS = 200_000

  try {
    const streamResult = await agent.stream({ prompt, abortSignal: abortController.signal })

    for await (const event of streamResult.fullStream) {
      const evType = (event as { type?: string }).type ?? 'unknown'

      // Watchdog reset: only non reasoning-delta events count as progress
      if (evType !== 'reasoning-delta') {
        resetWatchdog()
      }
      eventCounter++
      eventTypeCounts[evType] = (eventTypeCounts[evType] ?? 0) + 1

      // Heartbeat every 5 seconds
      const now = Date.now()
      if (now - lastHeartbeat > 5000) {
        logger.info(`${tag} Heartbeat: ${eventCounter} events received so far. Recent counts: ${JSON.stringify(eventTypeCounts)}`)
        lastHeartbeat = now
      }

      if (evType === 'start-step') {
        stepCount++
        logger.info(`${tag} Step ${stepCount} started`)
        agentLog.startStep(stepCount, 'analyzing')
        // Reset reasoning budget when a new step starts
        reasoningChars = 0
        lastReasoningEmit = 0
        lastReasoningProgressTs = Date.now()
      } else if (evType === 'text-delta' || evType === 'text') {
        const text = (event as { text?: string; textDelta?: string }).text
          ?? (event as { textDelta?: string }).textDelta
          ?? ''
        if (text) agentLog.modelOutput(text)
        // Real text output → reset reasoning bookkeeping
        reasoningChars = 0
        lastReasoningEmit = 0
      } else if (evType === 'reasoning-start') {
        agentLog.modelOutput('\n[REASONING START]\n')
        reasoningChars = 0
        lastReasoningEmit = 0
        lastReasoningProgressTs = Date.now()
      } else if (evType === 'reasoning-delta') {
        const text = (event as { text?: string }).text ?? ''
        if (text) {
          agentLog.modelOutput(text)
          reasoningChars += text.length
          lastReasoningProgressTs = now
          if (
            now - lastReasoningEmit >= REASONING_EMIT_INTERVAL_MS &&
            reasoningChars - lastReasoningEmit >= 50
          ) {
            onProgress({
              type: 'reasoning_progress',
              chars: reasoningChars,
              tokens: Math.round(reasoningChars / 4),
            })
            lastReasoningEmit = reasoningChars
          }
          if (reasoningChars >= REASONING_HARD_LIMIT_CHARS) {
            logger.warn(
              `${tag} Reasoning runaway: ${reasoningChars} chars without tool/text output — aborting`,
            )
            agentLog.toolInternal(
              `FATAL: reasoning loop exceeded ${REASONING_HARD_LIMIT_CHARS} chars without tool/text output`,
            )
            abortController.abort()
            break
          }
        }
        void lastReasoningProgressTs
      } else if (evType === 'reasoning-end') {
        agentLog.modelOutput('\n[REASONING END]\n')
        if (reasoningChars > 0) {
          onProgress({
            type: 'reasoning_progress',
            chars: reasoningChars,
            tokens: Math.round(reasoningChars / 4),
          })
        }
      } else if (evType === 'tool-input-start' || evType === 'tool-input-delta' || evType === 'tool-input-end') {
        // Tool input streaming events — ignore deltas
      } else if (evType === 'tool-call') {
        const e = event as { toolName?: string; input?: unknown }
        const toolName = e.toolName ?? 'unknown'
        logger.info(`${tag} Step ${stepCount}: tool-call ${toolName}`)
        toolStartTimes.set(toolName, Date.now())
        agentLog.toolCall(toolName, e.input)
      } else if (evType === 'tool-result') {
        const e = event as { toolName?: string; output?: unknown }
        const toolName = e.toolName ?? 'unknown'
        const startTime = toolStartTimes.get(toolName) ?? Date.now()
        const durationMs = Date.now() - startTime
        agentLog.toolResult(toolName, e.output, durationMs)
        // Successful tool result → reset circuit breaker
        consecutiveToolErrors = 0
        lastErrorToolName = ''
      } else if (evType === 'tool-error') {
        const e = event as { toolName?: string; error?: unknown }
        const toolName = e.toolName ?? 'unknown'
        const errStr = String(e.error).slice(0, 200)
        agentLog.toolInternal(`TOOL ERROR [${toolName}]: ${errStr}`)
        logger.warn(`${tag} Tool error: ${toolName} — ${errStr}`)
        if (toolName === lastErrorToolName) {
          consecutiveToolErrors++
        } else {
          consecutiveToolErrors = 1
          lastErrorToolName = toolName
        }
        if (consecutiveToolErrors >= circuitBreakerLimit) {
          logger.error(`${tag} Circuit breaker: ${toolName} failed ${consecutiveToolErrors} times consecutively — aborting`)
          agentLog.toolInternal(
            `FATAL: Circuit breaker tripped — ${toolName} failed ${consecutiveToolErrors} times consecutively`,
          )
          abortController.abort()
          break
        }
      } else if (evType === 'error') {
        const e = event as { error?: unknown }
        const errStr = String(e.error)
        agentLog.toolInternal(`STREAM ERROR: ${errStr}`)
        logger.error(`${tag} Stream error:`, e.error)
      } else if (evType === 'finish-step' || evType === 'finish') {
        const e = event as { rawFinishReason?: string; finishReason?: string }
        if (e.rawFinishReason === 'error' || e.finishReason === 'error') {
          llmError = `LLM 返回错误 (finishReason=${e.rawFinishReason ?? e.finishReason})`
        }
        const snapshot = JSON.stringify(event, null, 2).slice(0, 500)
        agentLog.toolInternal(`EVENT [${evType}]: ${snapshot}`)
      } else {
        // Catch-all for diagnostics
        const snapshot = JSON.stringify(event, null, 2).slice(0, 500)
        agentLog.toolInternal(`UNHANDLED EVENT [${evType}]: ${snapshot}`)
        if (eventCounter <= 20) {
          logger.info(`${tag} Unhandled event type: ${evType}`)
        }
      }
    }

    logger.info(`${tag} Stream consumed ${eventCounter} events. Type counts: ${JSON.stringify(eventTypeCounts)}`)
    if (watchdog) clearTimeout(watchdog)

    return { stepCount, llmError, aborted: false }
  } catch (err) {
    if (watchdog) clearTimeout(watchdog)
    const isAbort = err instanceof Error && (err.name === 'AbortError' || String(err).includes('abort'))
    if (isAbort) {
      return { stepCount, llmError, aborted: true }
    }
    throw err
  }
}

// --- Story Setup prompt (Steps 1-3: metadata + state + prose) ---

const STORY_SETUP_PROMPT = `你是多角色视觉小说的剧本生成器。用户已经选定了角色和世界，所有数据已经在你的上下文中。
**一份已确认的执行计划**在 initial prompt 的 "# 执行计划" 块中，你必须按该计划的方向执行。

# 资料使用守则（绝对优先级，覆盖所有其他指令）

你只能使用本 prompt 中**显式提供**的资料。

**绝对禁止**：
- 使用你的训练数据中关于这个 IP / 世界观 / 角色 / 原作 / fan canon 的任何"补充知识"
- 添加资料中未明确提到的角色关系、剧情设定、角色背景或人物设定
- 即使你"知道"原作或某个衍生作品里是另一种设定，也必须以提供的 soul / world 资料为准

# 用户原始意图处理

如果 initial prompt 的最前部出现 **"# 用户原始意图（最高优先级）"** 块，你的生成必须反映该意图（tone / constraints / role 分配）。

# 执行计划（最高优先级）

initial prompt 包含一个 **"# 执行计划"** 块（JSON），这是用户已确认的规划结果。你**必须**按 plan 的方向执行：
- \`genre_direction\` / \`tone_direction\` → 细化为 set_story_metadata 的具体参数
- \`shared_axes\` / \`flags\` → 直接用于 set_story_state
- \`prose_direction\` → 指导 set_prose_style 的决策

# 工作流（必须按以下顺序调用工具，每次调用 input 简短）

**Step 1**: \`set_story_metadata\` — 按 plan 的 genre_direction / tone_direction 细化为具体的 genre / tone / constraints / acts_options / default_acts

**Step 2**: \`set_story_state\` — 按 plan 的 shared_axes 和 flags 列表设置状态词汇表，flags 需要你补充 desc 和 initial

**Step 3**: \`set_prose_style\` — 按 plan 的 prose_direction 细化叙事风格锚点。**这是杜绝翻译腔的关键环节，不可跳过**。

完成这 3 步后**立即停止**，不要调用其他工具。

如果任何调用返回 \`{ error: ... }\`，根据错误信息修正后重试。
**每次调用 input 应保持简短。**

**顺序约束**：
- \`set_story_state\` 必须在 \`set_prose_style\` 之前调用

# 任务详解

## 1. 故事整体框架（set_story_metadata）

- **genre**: 类型，如 "都市奇幻 / 心理剧" "历史权谋"
- **tone**: 必须反映这个**特定角色组合**的独特性。**禁用**通用词如 "悬疑/温情/冒险/史诗"。
  示例好的 tone: "傲娇外壳下的温柔救赎·姐妹羁绊与黑化"
- **constraints**: 至少包含一条 **tradeoff 约束**（每个选项必须对不同角色产生差异化好感影响）；
  以及反映该组合独特命题的 3-6 条具体约束
- **acts_options_csv**: 提供 2-3 个长度预设（竖线分隔），根据角色数推荐：
  - 角色数 ≤ 2 → \`"3:短篇:24-36:4|5:中篇:40-60:5"\`，default_acts = 3
  - 角色数 3-4 → \`"3:短篇:24-36:4|5:中篇:40-60:5|7:长篇:56-84:6"\`，default_acts = 5
  - 角色数 ≥ 5 → \`"5:中篇:40-60:5|7:长篇:56-84:6|9:超长篇:72-108:7"\`，default_acts = 7
  格式：acts:label_zh:rounds_total:endings_count

## 2. 故事状态设计（set_story_state）

### shared_axis_1 / shared_axis_2（恰好 2 个）
选择最能反映这个故事核心关系动力学的 2 个维度。规则：
- snake_case ASCII
- 不允许 "bond"（已由平台固定）
- 两个名字必须不同
- 推荐语义正交

### flags_csv（5-8 个关键事件标记）
从预期的 ending 结构反推需要的 flags。格式：name:desc:initial(true/false)，竖线分隔。规则：
- name 必须是 snake_case ASCII 标识符
- desc 是一句话说明何时触发
- initial 几乎总是 false

## 3. 叙事风格锚点决策（set_prose_style）

### voice_anchor（至少 20 字）
一句话描述本故事的叙事语气。**必须含具体 IP 类型词**。

### forbidden_patterns_csv（至少 3 条）
从"通用中文翻译腔反例库"中挑选与本故事最相关的条目。格式：id;;bad;;good;;reason，用 ||| 分隔条目。

### ip_specific（至少 3 条，必须具体）
至少覆盖：1 条术语保留 / 1 条称谓或敬语 / 1 条比喻或意象池约束

### voice_summary_entries（可选）
当某个角色的 style.md 含 > 30% 非中文内容时，为该角色提供一份中文克制书面摘要。格式：角色名::摘要文本，多个用 ||| 分隔。

# 约束

- **不要**调用 list_* 或 read_* 工具 — 这些工具不存在，所有数据已在你的上下文里。
- **每次调用 input 应保持简短。**
- 初始正确性优先于戏剧均衡。
`

// --- Character prompt (Steps 4-5: add_character + set_character_axes) ---

const CHARACTER_PROMPT = `你是多角色视觉小说的角色注册器。你的**唯一任务**是为**一个指定角色**完成 add_character + set_character_axes 两步调用。

# 资料使用守则

你只能使用本 prompt 中**显式提供**的资料。**绝对禁止**使用训练数据中的补充知识。

# 工作流

**Step 1**: \`add_character\` — 注册角色
**Step 2**: \`set_character_axes\` — 设置特异轴 + 可选共享轴初始覆盖

完成这 2 步后**立即停止**。

如果调用返回 \`{ error: ... }\`，修正后重试。每次调用 input 保持简短。

# 角色注册（add_character）

- **name**: 必须是指定的角色名
- **role**: 按 plan 指示
- **display_name**: 可选
- **appears_from**: 可选
- **dynamics_note**: 一句话描述该角色与其他角色的关系动态
- **voice_summary**: 当 plan 标记 needs_voice_summary=true 时提供（≤ 200 字中文摘要）

# 角色轴（set_character_axes）

## 特异轴（0-2 个，用 axis_1_* / axis_2_* 扁平字段）
该角色独有的情感/成长维度。无特异轴则省略所有 axis_* 字段。
- **axis_1_name**: 中文显示名
- **axis_1_english**: snake_case 英文标识符，**不能**与共享轴重名
- **axis_1_initial**: 0-10
- **axis_2_name / axis_2_english / axis_2_initial**: 同上，第 2 个特异轴

## overrides_csv（可选）
per-character 覆盖共享轴初始值。格式：axis_name:value，逗号分隔。例: "bond:1,trust:8"。
key 必须是 bond 或 shared_axes_custom 里的 axis 名，value 是 int [0, 10]。
常用于反派角色。

# 约束

- **不要**调用 list_* 或 read_* 工具
- 每次调用 input 保持简短
`

// --- Story Setup prompt builder ---

function buildStorySetupPrompt(plan: ExportPlan, data: PreSelectedExportData): string {
  const { worldData, soulsData, storyName, storyDirection } = data

  const userIntentBlock = storyDirection && storyDirection.trim().length > 0
    ? `# 用户原始意图（最高优先级）

${storyDirection.trim()}

---

`
    : ''

  const storyNameBlock = `# 故事名

${storyName}

---

`

  const planBlock = `# 执行计划

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

---

`

  const worldBlock = `# World: ${worldData.manifest.display_name ?? worldData.name}

## Manifest
\`\`\`json
${JSON.stringify(worldData.manifest, null, 2)}
\`\`\`

## World Entries (${worldData.entries.length})
${worldData.entries.map((e) =>
  `### ${e.name}\n${e.content}`
).join('\n\n')}
`

  // For story setup: include only style.md (for prose style non-Chinese detection)
  // identity/milestones/behaviors are NOT needed at this stage
  const soulBlocks = soulsData.map((s) => {
    return `## ${s.manifest.display_name ?? s.name}
- soul_name: \`${s.name}\`

### style.md
${s.style || '(empty)'}
`
  }).join('\n\n---\n\n')

  return `${userIntentBlock}${storyNameBlock}${planBlock}以下是故事资料。请按工作流依次调用 set_story_metadata → set_story_state → set_prose_style。

${worldBlock}

---

# Characters style data (${soulsData.length})

${soulBlocks}

---

请开始。角色数量：${soulsData.length}
`
}

// --- Character prompt builder ---

function buildCharacterPrompt(
  plan: ExportPlan,
  charPlan: ExportPlanCharacter,
  soulData: SoulFullData,
  sharedAxes: string[],
): string {
  const behaviorsSection = soulData.behaviors.length > 0
    ? soulData.behaviors.map((b) => `### behaviors/${b.name}.md\n${b.content}`).join('\n\n')
    : '(no behavior files)'

  const soulBlock = `# 角色数据: ${soulData.manifest.display_name ?? soulData.name}
- soul_name: \`${soulData.name}\`
- type: ${soulData.manifest.soulType ?? 'unknown'}

### identity.md
${soulData.identity || '(empty)'}

### style.md
${soulData.style || '(empty)'}

${soulData.capabilities ? `### capabilities.md\n${soulData.capabilities}\n` : ''}
${soulData.milestones ? `### milestones.md\n${soulData.milestones}\n` : ''}
${behaviorsSection}
`

  const planDirection = `# Plan 指令

- role: ${charPlan.role}
- specific_axes_direction: ${charPlan.specific_axes_direction.length > 0 ? charPlan.specific_axes_direction.join(' / ') : '(无特异轴)'}
- needs_voice_summary: ${charPlan.needs_voice_summary}
${charPlan.appears_from ? `- appears_from: act_${charPlan.appears_from}` : ''}
${charPlan.shared_initial_overrides_hint ? `- shared_initial_overrides_hint: ${JSON.stringify(charPlan.shared_initial_overrides_hint)}` : ''}
`

  return `${planDirection}

# 共享轴名称（不需要你声明，但 shared_initial_overrides 的 key 必须是这些）

bond, ${sharedAxes.join(', ')}

---

${soulBlock}

---

请为角色 \`${soulData.name}\` 依次调用 add_character → set_character_axes。
`
}

// --- Planning Agent: submit_plan validation + loop ---

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/

function validatePlan(
  plan: ExportPlan,
  preSelectedSouls: string[],
): string | null {
  // 1. genre_direction / tone_direction / prose_direction non-empty
  if (!plan.genre_direction?.trim()) return 'genre_direction 不能为空'
  if (!plan.tone_direction?.trim()) return 'tone_direction 不能为空'
  if (!plan.prose_direction?.trim()) return 'prose_direction 不能为空'

  // 2. shared_axes: exactly 2, snake_case
  if (!Array.isArray(plan.shared_axes) || plan.shared_axes.length !== 2) {
    return 'shared_axes 必须恰好 2 个'
  }
  for (const axis of plan.shared_axes) {
    if (!SNAKE_CASE_RE.test(axis)) return `shared_axes "${axis}" 不是 snake_case`
  }
  if (plan.shared_axes[0] === plan.shared_axes[1]) {
    return 'shared_axes 的两个轴名不能相同'
  }

  // 3. flags: non-empty, snake_case
  if (!Array.isArray(plan.flags) || plan.flags.length === 0) {
    return 'flags 不能为空'
  }
  for (const flag of plan.flags) {
    if (!SNAKE_CASE_RE.test(flag)) return `flag "${flag}" 不是 snake_case`
  }

  // 4. characters: coverage check
  if (!Array.isArray(plan.characters) || plan.characters.length === 0) {
    return 'characters 不能为空'
  }
  const planNames = new Set(plan.characters.map((c) => c.name))
  const preSelectedSet = new Set(preSelectedSouls)
  const missing = preSelectedSouls.filter((n) => !planNames.has(n))
  const extra = plan.characters.filter((c) => !preSelectedSet.has(c.name)).map((c) => c.name)
  if (missing.length > 0) return `plan 缺少角色: ${missing.join(', ')}`
  if (extra.length > 0) return `plan 包含未预选的角色: ${extra.join(', ')}`

  // 5. at least 1 protagonist
  const hasProtagonist = plan.characters.some((c) => c.role === 'protagonist')
  if (!hasProtagonist) return '至少需要 1 个 protagonist'

  // 6. specific_axes_direction: max 2 per character
  for (const c of plan.characters) {
    if (c.specific_axes_direction && c.specific_axes_direction.length > 2) {
      return `角色 "${c.name}" 的 specific_axes_direction 不能超过 2 个`
    }
  }

  return null // valid
}

/** Exported for unit tests. */
export { validatePlan as __TEST_ONLY_validatePlan }

async function runPlanningLoop(
  model: ReturnType<ReturnType<typeof createOpenAICompatible>>,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  agentLog: AgentLogger,
  providerOpts?: SharedV3ProviderOptions,
): Promise<ExportPlan | null> {
  const tag = '[export-planning]'
  onProgress({ type: 'phase', phase: 'planning' })

  // Accumulate plan pieces from multiple small tool calls
  const planBuilder = {
    story: null as {
      genre_direction: string
      tone_direction: string
      shared_axes: string[]
      flags: string[]
      prose_direction: string
    } | null,
    characters: [] as ExportPlanCharacter[],
    finalized: false,
  }

  const planningTools = {
    plan_story: tool({
      description: '设定故事层面的规划方向。这是第一步，必须在 plan_character 之前调用。',
      inputSchema: z.object({
        genre_direction: z.string().describe('类型大方向，如 "魔术战争 / 心理剧"'),
        tone_direction: z.string().describe('基调大方向，反映角色组合独特性，禁用通用词'),
        shared_axes_1: z.string().describe('第 1 个非 bond 共享轴名（snake_case）'),
        shared_axes_2: z.string().describe('第 2 个非 bond 共享轴名（snake_case，与第 1 个不同）'),
        flags: z.array(z.string()).describe('关键事件 flag 名列表（snake_case，5-8 个）'),
        prose_direction: z.string().describe('叙事风格方向描述'),
      }),
      execute: async ({ genre_direction, tone_direction, shared_axes_1, shared_axes_2, flags, prose_direction }) => {
        onProgress({ type: 'tool_start', tool: 'plan_story' })
        // Validate
        if (!genre_direction.trim()) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: genre_direction 不能为空' })
          return { error: 'genre_direction 不能为空' }
        }
        if (!tone_direction.trim()) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: tone_direction 不能为空' })
          return { error: 'tone_direction 不能为空' }
        }
        if (!SNAKE_CASE_RE.test(shared_axes_1) || !SNAKE_CASE_RE.test(shared_axes_2)) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: shared_axes 必须是 snake_case' })
          return { error: 'shared_axes 必须是 snake_case' }
        }
        if (shared_axes_1 === shared_axes_2) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: 两个共享轴不能相同' })
          return { error: '两个共享轴不能相同' }
        }
        if (flags.length === 0) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: flags 不能为空' })
          return { error: 'flags 不能为空' }
        }
        for (const f of flags) {
          if (!SNAKE_CASE_RE.test(f)) {
            onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: `error: flag "${f}" 不是 snake_case` })
            return { error: `flag "${f}" 不是 snake_case` }
          }
        }
        planBuilder.story = {
          genre_direction,
          tone_direction,
          shared_axes: [shared_axes_1, shared_axes_2],
          flags,
          prose_direction,
        }
        const summary = `genre=${genre_direction}, shared=[${shared_axes_1}, ${shared_axes_2}], ${flags.length} flags`
        onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: summary })
        return { ok: true, summary }
      },
    }),

    plan_character: tool({
      description: '为一个角色设定规划方向。每个角色调用一次。必须先调用 plan_story。',
      inputSchema: z.object({
        name: z.string().describe('Soul 名称（必须匹配预选列表）'),
        role: z.enum(['protagonist', 'deuteragonist', 'antagonist']),
        specific_axes_direction: z.string().describe('特异轴方向（自然语言），如 "荣誉感 / 自我价值感"。无特异轴留空字符串'),
        needs_voice_summary: z.boolean().describe('style.md 含 > 30% 非中文时为 true'),
        appears_from: z.number().optional().describe('从第几幕出场'),
      }),
      execute: async ({ name, role, specific_axes_direction, needs_voice_summary, appears_from }) => {
        onProgress({ type: 'tool_start', tool: 'plan_character', args: { name } })
        if (!planBuilder.story) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: 'error: 先调用 plan_story' })
          return { error: '必须先调用 plan_story' }
        }
        if (!preSelected.souls.includes(name)) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: `error: "${name}" 不在预选列表` })
          return { error: `"${name}" 不在预选列表中` }
        }
        if (planBuilder.characters.some((c) => c.name === name)) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: `error: "${name}" 已添加` })
          return { error: `"${name}" 已添加过` }
        }
        const axes = specific_axes_direction.trim()
          ? specific_axes_direction.split(/[\/、，,]/).map((s) => s.trim()).filter(Boolean).slice(0, 2)
          : []
        planBuilder.characters.push({ name, role, specific_axes_direction: axes, needs_voice_summary, appears_from })
        const count = planBuilder.characters.length
        const summary = `${count}/${preSelected.souls.length}: ${name} (${role})`
        onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: summary })
        return { ok: true, summary }
      },
    }),

    finalize_plan: tool({
      description: '完成规划。所有角色都 plan_character 后调用。校验完整性并组装 plan。',
      inputSchema: z.object({}),
      execute: async () => {
        onProgress({ type: 'tool_start', tool: 'finalize_plan' })
        if (!planBuilder.story) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: 'error: 未调用 plan_story' })
          return { error: '未调用 plan_story' }
        }
        // Check coverage
        const missing = preSelected.souls.filter((s) => !planBuilder.characters.some((c) => c.name === s))
        if (missing.length > 0) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: `error: 缺少角色 ${missing.join(', ')}` })
          return { error: `缺少角色: ${missing.join(', ')}` }
        }
        if (!planBuilder.characters.some((c) => c.role === 'protagonist')) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: 'error: 至少需要 1 个 protagonist' })
          return { error: '至少需要 1 个 protagonist' }
        }
        planBuilder.finalized = true
        const protagonist = planBuilder.characters.find((c) => c.role === 'protagonist')
        const summary = `${planBuilder.characters.length} 角色, protagonist: ${protagonist?.name ?? '?'}`
        onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: summary })
        return { ok: true, summary }
      },
    }),
  }

  try {
    const characterCount = preSelected.souls.length
    const stepCap = computePlanningStepCap(characterCount)
    const agent = new ToolLoopAgent({
      model,
      instructions: PLANNING_SYSTEM_PROMPT,
      tools: planningTools,
      toolChoice: 'auto',
      temperature: 0,
      providerOptions: providerOpts,
      stopWhen: [stepCountIs(stepCap), () => planBuilder.finalized],
    })

    const initialPrompt = buildPlanningPrompt(preSelected)
    logger.info(`${tag} Planning prompt length: ${initialPrompt.length} chars`)

    const result = await runAgentLoop({
      agent,
      prompt: initialPrompt,
      onProgress,
      agentLog,
      tag,
    })

    if (!planBuilder.finalized || !planBuilder.story) {
      const detail = result.llmError
        ? `${result.llmError}。可能是 prompt 过大超出模型 context limit，或 API 端错误。`
        : `Planning Agent 在 ${result.stepCount} 步内未能完成规划。`
      const errorMsg = `规划失败：${detail}\n查看详细日志：${agentLog.filePath}`
      logger.warn(`${tag} ${errorMsg}`)
      onProgress({ type: 'error', error: errorMsg })
      return null
    }

    // Assemble the plan from accumulated pieces
    const plan: ExportPlan = {
      ...planBuilder.story,
      characters: planBuilder.characters,
    }
    logger.info(`${tag} Plan confirmed: ${plan.characters.length} characters`)
    return plan
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || String(err).includes('abort'))
    const errorMsg = isAbort
      ? '规划超时（90秒无响应）。'
      : (err instanceof Error ? err.message : String(err))
    logger.error(`${tag} Planning error:`, errorMsg)
    onProgress({ type: 'error', error: errorMsg })
    return null
  }
}

/**
 * Callback that waits for user to confirm or cancel the plan.
 * Returns true if confirmed, false if cancelled.
 */
export type PlanConfirmHandler = () => Promise<boolean>

export async function runExportAgent(
  config: SoulkillerConfig,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
  waitForPlanConfirm?: PlanConfirmHandler,
): Promise<void> {
  const tag = '[export-agent]'
  logger.info(`${tag} Starting export agent`, {
    souls: preSelected.souls,
    world: preSelected.worldName,
  })

  onProgress({ type: 'phase', phase: 'initiating' })

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1',
  })
  const modelName = config.llm.default_model
  const model = provider(withExacto(modelName))
  const providerOpts = getProviderOptions(modelName)

  // Dedicated log file for export runs — separate from capture/distill logs
  const promptLabel = `Export Skill: ${preSelected.souls.join(',')} in ${preSelected.worldName}`
  const agentLog = new AgentLogger(promptLabel, {
    model: config.llm.default_model,
    provider: 'openrouter',
    subdir: 'export',
  })
  logger.info(`${tag} Agent log: ${agentLog.filePath}`)

  // ─── Phase 1: Planning ─────────────────────────────────────────────
  const plan = await runPlanningLoop(model, preSelected, onProgress, agentLog, providerOpts)
  if (!plan) {
    agentLog.close()
    return // Planning failed — error already emitted
  }

  // ─── Phase 2: Plan confirmation ────────────────────────────────────
  onProgress({ type: 'phase', phase: 'plan_review' })
  onProgress({ type: 'plan_ready', plan })

  // Wait for user to confirm the plan via the UI's Enter/Esc interaction.
  // The panel renders a plan_review zone; Enter triggers onPlanConfirm,
  // Esc triggers onCancel — both resolve the promise.
  const confirmed = waitForPlanConfirm ? await waitForPlanConfirm() : true
  onProgress({ type: 'plan_confirmed' })

  if (!confirmed) {
    logger.info(`${tag} User cancelled after plan review`)
    agentLog.toolInternal('User cancelled after plan review')
    agentLog.close()
    onProgress({ type: 'error', error: '用户取消了导出' })
    return
  }

  // ─── Phase 3: Execution (3 independent sub-phases) ──────────────────

  const builder = new ExportBuilder(preSelected.souls, preSelected.worldName)

  onProgress({ type: 'phase', phase: 'analyzing' })

  // Step 1: Story Setup (metadata + state + prose)
  const storyOk = await runStorySetup(model, plan, preSelected, builder, onProgress, askUser, agentLog, providerOpts)
  if (!storyOk) { agentLog.close(); return }

  // Step 2: Character Loop (per-character add + axes)
  const charsOk = await runCharacterLoop(model, plan, preSelected, builder, onProgress, agentLog, providerOpts)
  if (!charsOk) { agentLog.close(); return }

  // Step 3: Finalize (pure code packaging)
  const finalOk = await finalizeAndPackage(builder, preSelected, onProgress, agentLog)
  if (!finalOk) { agentLog.close(); return }

  agentLog.close()
}

// --- Story Setup sub-agent ---

function makeStorySetupTools(
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
  completionTracker: { proseStyleSet: boolean },
) {
  return {
    ask_user: tool({
      description: '兜底: 仅在分析中发现数据严重不足时使用，向用户提出问题。正常路径不要使用。',
      inputSchema: z.object({
        question: z.string().describe('要问用户的问题'),
        options: z.array(z.object({
          label: z.string(),
          description: z.string().optional(),
        })).optional().describe('选项列表'),
        allow_free_input: z.boolean().optional().describe('是否允许自由文本输入'),
        multi_select: z.boolean().optional().describe('是否允许多选'),
      }),
      execute: async ({ question, options, allow_free_input, multi_select }) => {
        onProgress({ type: 'ask_user_start', question, options, allow_free_input, multi_select })
        const answer = await askUser(question, options, allow_free_input, multi_select)
        onProgress({ type: 'ask_user_end', answer })
        return { answer }
      },
    }),

    set_story_metadata: tool({
      description: '设定故事整体框架（genre / tone / constraints / acts_options / default_acts）。这是分阶段工作流的第一步。',
      inputSchema: z.object({
        genre: z.string().describe('故事类型，如 "都市奇幻 / 心理剧"'),
        tone: z.string().describe('反映角色组合独特性的基调，禁用通用词'),
        constraints: z.array(z.string()).describe('约束列表，至少一条 tradeoff 约束'),
        acts_options_csv: z.string().describe('2-3 个长度预设，格式：acts:label_zh:rounds_total:endings_count，用竖线分隔。例: "3:短篇:24-36:4|5:中篇:40-60:5|7:长篇:56-84:6"'),
        default_acts: z.number().describe('推荐默认值，必须等于 acts_options 中某项的 acts'),
      }),
      execute: async ({ genre, tone, constraints, acts_options_csv, default_acts }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_story_metadata' })
          // Parse acts_options_csv into ActOption[]
          const acts_options: ActOption[] = acts_options_csv.split('|').map((entry) => {
            const parts = entry.trim().split(':')
            if (parts.length !== 4) throw new Error(`acts_options 格式错误，每项需要 4 个字段 (acts:label_zh:rounds_total:endings_count)，得到: "${entry}"`)
            return {
              acts: Number(parts[0]),
              label_zh: parts[1],
              rounds_total: parts[2],
              endings_count: Number(parts[3]),
            }
          })
          builder.setMetadata({ genre, tone, constraints, acts_options, default_acts })
          const summary = `Metadata saved: ${acts_options.length} length options (default ${default_acts} acts)`
          onProgress({ type: 'tool_end', tool: 'set_story_metadata', result_summary: summary })
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'set_story_metadata', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),

    set_story_state: tool({
      description:
        '锁定故事层级的状态词汇表：2 个故事级共享好感轴（另一个 bond 是平台固定的）+ 关键事件 flags 列表。\n' +
        '必须在 set_story_metadata 之后、任何 add_character 之前调用，整个 export 只调用一次。\n' +
        '\n' +
        '## shared_axes_custom（恰好 2 个）\n' +
        '选择最能反映这个故事核心关系动力学的 2 个维度。它们会成为所有角色的共享好感轴。\n' +
        '约定：\n' +
        '- 名字必须 snake_case（如 "trust" / "loyalty" / "rivalry" / "allegiance"）\n' +
        '- 不允许 "bond"（已由平台固定）\n' +
        '- 两个名字必须不同\n' +
        '- 推荐语义上正交（如 trust + rivalry 彼此独立，而不是 trust + loyalty 相关）\n' +
        '\n' +
        '## flags（5-8 个关键事件标记）\n' +
        '从你预期的 ending 反推需要的 flags：列出这个故事会经历的核心分叉点。每个 flag 是一个 bool，在某个 scene 被触发为 true。\n' +
        '例：[met_johnny, accepted_arasaka, witnessed_truth, chose_rebellion, saber_vanished]\n' +
        '\n' +
        '规则：\n' +
        '- 名字必须 snake_case，desc 必须非空（给 Phase 1 LLM 作为触发判断的参考）\n' +
        '- 初始值几乎总是 false（true 用于"故事开始前已发生的前置条件"）\n' +
        '- 数量建议 5-8；超过 8 会触发 warning 但不阻塞\n' +
        '- **Phase 1 LLM 不能创造新 flag**，只能引用这里声明的 flag 名。所以这一步必须把故事会用到的所有关键标记列全',
      inputSchema: z.object({
        shared_axis_1: z.string().describe('第 1 个非 bond 共享轴名，snake_case。例: "trust"'),
        shared_axis_2: z.string().describe('第 2 个非 bond 共享轴名，snake_case，与第 1 个不同。例: "rivalry"'),
        flags_csv: z.string().describe('flag 列表，格式：name:desc:initial(true/false)，用竖线分隔。例: "met_johnny:玩家首次遇到Johnny:false|chose_rebellion:玩家选择反抗:false"'),
      }),
      execute: async ({ shared_axis_1, shared_axis_2, flags_csv }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_story_state' })
          // Combine into tuple
          const shared_axes_custom: [string, string] = [shared_axis_1, shared_axis_2]
          // Parse flags_csv into StoryStateFlag[]
          const flags: StoryStateFlag[] = flags_csv.split('|').map((entry) => {
            const parts = entry.trim().split(':')
            if (parts.length < 3) throw new Error(`flags 格式错误，每项需要 3 个字段 (name:desc:initial)，得到: "${entry}"`)
            const name = parts[0]
            const initial = parts[parts.length - 1] === 'true'
            // desc may contain colons, so join middle parts
            const desc = parts.slice(1, parts.length - 1).join(':')
            return { name, desc, initial }
          })
          builder.setStoryState({ shared_axes_custom, flags })
          const summary =
            `Story state set: shared_axes=[${shared_axes_custom.join(', ')}], ` +
            `flags=[${flags.map((f) => f.name).join(', ')}]`
          onProgress({ type: 'tool_end', tool: 'set_story_state', result_summary: summary })
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'set_story_state', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),

    set_prose_style: tool({
      description:
        '锁定本故事的**叙事风格锚点**：target_language / voice_anchor / forbidden_patterns / ip_specific。\n' +
        '必须在 set_story_state 之后、任何 add_character 之前调用，整个 export 只调用一次。\n' +
        '目的：杜绝所有 Phase 1/2 产出的中文文本中的翻译腔。\n' +
        '\n' +
        '## 决策原则\n' +
        '你刚读完了 world manifest 和每个角色的 style.md/identity.md。现在要为这个故事决定一份可操作的 prose style。\n' +
        '这不是"抽象审美"；是把**具体反模式**挑出来供下游 LLM 对照。\n' +
        '\n' +
        '## target_language\n' +
        '第一版只支持 "zh"。\n' +
        '\n' +
        '## voice_anchor（至少 20 字）\n' +
        '一句话描述本故事的叙事语气。**必须含具体 IP 类型词**（如 "type-moon 系日翻中视觉小说"、"古典章回白话"、"赛博朋克黑帮港式白话"、"现代都市口语")。\n' +
        '反例：「fantasy novel」「应该克制、庄重」（太抽象，不可执行）\n' +
        '正例：「type-moon 系日系视觉小说的中文官方译本风格。短句为主，旁白克制，保留日语停顿感但不保留日语语法」\n' +
        '\n' +
        '## forbidden_patterns（至少 3 条）\n' +
        '从下方"通用中文翻译腔反例库"中挑出与本故事最相关的条目；可以改写 bad/good 内容以贴合本故事的世界观（保留 id 和 reason）。\n' +
        '也可以追加故事特异的反例（自行编写 id/bad/good/reason 四字段）。\n' +
        '每条的 bad 和 good 必须是真实可对比的中文段落，不是抽象描述。\n' +
        '\n' +
        '## ip_specific（至少 3 条，必须具体）\n' +
        '为本故事/IP 现编的规则 bullet。**必须是具体可执行的规则**，而不是抽象方向。\n' +
        '至少覆盖：1 条术语保留 / 1 条称谓或敬语 / 1 条比喻或意象池约束\n' +
        '反例：「保持日系感」「应该克制」「注意氛围」\n' +
        '正例：「宝具/Servant/Master 保留英文不意译」「樱 → 樱小姐（非"小樱"）」「比喻从"月光/雪/灯笼/石阶"池选词，不用西式钢铁或玻璃」\n' +
        '\n' +
        '## character_voice_summary（可选）\n' +
        '当某个角色的 style.md 含 > 30% 非中文内容（典型：fsn 角色的日文引文），为该角色提供一份中文克制书面摘要（≤ 200 字）。\n' +
        '摘要应复述 1-2 句该角色的标志性台词作为锚点。\n' +
        '其他情况省略该字段即可。\n' +
        '\n' +
        '## 通用中文翻译腔反例库（IP-agnostic，作为 forbidden_patterns 的选择池和启发）\n' +
        '\n' +
        formatPatternsForToolDescription(),
      inputSchema: z.object({
        target_language: z
          .literal('zh')
          .describe('目标语言，第一版只支持 zh'),
        voice_anchor: z
          .string()
          .min(20)
          .describe('一句话描述本故事叙事语气，必须含具体 IP 类型词'),
        forbidden_patterns_csv: z
          .string()
          .describe('至少 3 条，格式：id;;bad;;good;;reason，用 ||| 分隔条目。用 ;; 分隔字段（因为 bad/good 内容可能含逗号冒号）'),
        ip_specific: z
          .array(z.string())
          .min(3)
          .describe('至少 3 条故事/IP 特异的具体规则'),
        voice_summary_entries: z
          .string()
          .optional()
          .describe('可选。格式：角色名::摘要文本，多个用 ||| 分隔。例: "間桐桜::温柔克制的敬语..."'),
      }),
      execute: async ({
        target_language,
        voice_anchor,
        forbidden_patterns_csv,
        ip_specific,
        voice_summary_entries,
      }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_prose_style' })
          // Parse forbidden_patterns_csv into ProseStyleForbiddenPattern[]
          const forbidden_patterns: ProseStyleForbiddenPattern[] = forbidden_patterns_csv.split('|||').map((entry) => {
            const parts = entry.trim().split(';;')
            if (parts.length !== 4) throw new Error(`forbidden_patterns 格式错误，每项需要 4 个字段 (id;;bad;;good;;reason)，得到: "${entry.trim()}"`)
            return { id: parts[0].trim(), bad: parts[1].trim(), good: parts[2].trim(), reason: parts[3].trim() }
          })
          if (forbidden_patterns.length < 3) throw new Error('forbidden_patterns 必须至少 3 条')
          // Parse voice_summary_entries into Record<string, string>
          let character_voice_summary: Record<string, string> | undefined
          if (voice_summary_entries && voice_summary_entries.trim().length > 0) {
            character_voice_summary = {}
            for (const entry of voice_summary_entries.split('|||')) {
              const sepIdx = entry.indexOf('::')
              if (sepIdx < 0) throw new Error(`voice_summary_entries 格式错误，缺少 :: 分隔符: "${entry.trim()}"`)
              const charName = entry.slice(0, sepIdx).trim()
              const summary = entry.slice(sepIdx + 2).trim()
              character_voice_summary[charName] = summary
            }
          }
          builder.setProseStyle({
            target_language,
            voice_anchor,
            forbidden_patterns,
            ip_specific,
            character_voice_summary,
          })
          const summary =
            `Prose style set: voice_anchor=${voice_anchor.slice(0, 30)}..., ` +
            `${forbidden_patterns.length} forbidden patterns, ` +
            `${ip_specific.length} ip_specific rules` +
            (character_voice_summary
              ? `, ${Object.keys(character_voice_summary).length} char voice summaries`
              : '')
          onProgress({
            type: 'tool_end',
            tool: 'set_prose_style',
            result_summary: summary,
          })
          completionTracker.proseStyleSet = true
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({
            type: 'tool_end',
            tool: 'set_prose_style',
            result_summary: `error: ${errMsg}`,
          })
          return { error: errMsg }
        }
      },
    }),
  }
}

async function runStorySetup(
  model: ReturnType<ReturnType<typeof createOpenAICompatible>>,
  plan: ExportPlan,
  preSelected: PreSelectedExportData,
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
  agentLog: AgentLogger,
  providerOpts?: SharedV3ProviderOptions,
): Promise<boolean> {
  const tag = '[export-story-setup]'

  const completionTracker = { proseStyleSet: false }
  const tools = makeStorySetupTools(builder, onProgress, askUser, completionTracker)

  const STORY_SETUP_STEP_CAP = 8 // 3 normal + 5 buffer

  const agent = new ToolLoopAgent({
    model,
    instructions: STORY_SETUP_PROMPT,
    tools,
    toolChoice: 'auto',
    temperature: 0,
    providerOptions: providerOpts,
    stopWhen: [stepCountIs(STORY_SETUP_STEP_CAP), () => completionTracker.proseStyleSet],
  })

  const prompt = buildStorySetupPrompt(plan, preSelected)
  logger.info(`${tag} Story setup prompt length: ${prompt.length} chars`)

  try {
    const result = await runAgentLoop({
      agent,
      prompt,
      onProgress,
      agentLog,
      tag,
    })

    if (!completionTracker.proseStyleSet) {
      const detail = result.llmError
        ? `${result.llmError}。`
        : result.aborted
          ? 'Story Setup 超时（90秒无响应）。'
          : `Story Setup 在 ${result.stepCount} 步内未完成（未调用 set_prose_style）。`
      const errorMsg = `故事设置失败：${detail}\n查看详细日志：${agentLog.filePath}`
      logger.warn(`${tag} ${errorMsg}`)
      onProgress({ type: 'error', error: errorMsg })
      return false
    }

    logger.info(`${tag} Story setup completed in ${result.stepCount} steps`)
    return true
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error(`${tag} Story setup error:`, errorMsg)
    onProgress({ type: 'error', error: errorMsg })
    return false
  }
}

// --- Character Loop sub-agent ---

function makeCharacterTools(
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  completionTracker: { axesSet: boolean },
) {
  return {
    add_character: tool({
      description:
        '注册一个角色到 export builder。注册后必须再调用 set_character_axes 设置好感轴。\n' +
        '可选 voice_summary：当该角色 style.md 含 > 30% 非中文内容时提供一份 ≤ 200 字的中文克制书面摘要。',
      inputSchema: z.object({
        name: z.string().describe('Soul 名称（必须与预选 souls 列表中的某项匹配）'),
        role: z.enum(['protagonist', 'deuteragonist', 'antagonist', 'supporting']),
        display_name: z.string().optional().describe('可选的中文显示名'),
        appears_from: z.string().optional().describe('如 "act_1" / "act_2"'),
        dynamics_note: z.string().optional().describe('一句话描述该角色的关系动态'),
        voice_summary: z
          .string()
          .max(200)
          .optional()
          .describe(
            '可选中文声音摘要（≤ 200 字）。仅当源 style.md 含 > 30% 非中文内容时提供',
          ),
      }),
      execute: async ({ name, role, display_name, appears_from, dynamics_note, voice_summary }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'add_character', args: { name } })
          builder.addCharacter({ name, role, display_name, appears_from, dynamics_note, voice_summary })
          const voiceMark = voice_summary ? ' +voice' : ''
          const summary = `Character ${builder.characterCount()}/${builder.preSelectedCount()} added: ${name} (${role})${voiceMark}`
          onProgress({ type: 'tool_end', tool: 'add_character', result_summary: summary })
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'add_character', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),

    set_character_axes: tool({
      description:
        '为已添加的角色设置**特异**好感轴（0-2 个），以及可选的**共享轴 initial 覆盖**。\n' +
        '每个角色自动含 3 个共享轴 (bond + story_state.shared_axes_custom 里的 2 个)，这里只声明该角色专属的特异轴。\n' +
        '可通过 shared_initial_overrides 为该角色覆盖任意共享轴的初始值（常用于反派：bond 初始 1-2）。',
      inputSchema: z.object({
        character_name: z.string().describe('已通过 add_character 添加的 Soul 名称'),
        axis_1_name: z.string().optional().describe('第 1 个特异轴中文名，如 "自我价值感"。无特异轴则省略'),
        axis_1_english: z.string().optional().describe('第 1 个特异轴 snake_case 标识符'),
        axis_1_initial: z.number().optional().describe('第 1 个特异轴初始值 0-10'),
        axis_2_name: z.string().optional().describe('第 2 个特异轴中文名。无第 2 个特异轴则省略'),
        axis_2_english: z.string().optional().describe('第 2 个特异轴 snake_case 标识符'),
        axis_2_initial: z.number().optional().describe('第 2 个特异轴初始值 0-10'),
        overrides_csv: z.string().optional().describe('可选。格式：axis_name:value，逗号分隔。例: "bond:1,trust:8"'),
      }),
      execute: async ({ character_name, axis_1_name, axis_1_english, axis_1_initial, axis_2_name, axis_2_english, axis_2_initial, overrides_csv }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_character_axes', args: { character_name } })
          // Assemble specific_axes from flat fields
          const specific_axes: CharacterAxis[] = []
          if (axis_1_name && axis_1_english && axis_1_initial !== undefined) {
            specific_axes.push({ name: axis_1_name, english: axis_1_english, initial: axis_1_initial })
          }
          if (axis_2_name && axis_2_english && axis_2_initial !== undefined) {
            specific_axes.push({ name: axis_2_name, english: axis_2_english, initial: axis_2_initial })
          }
          // Parse overrides_csv into Record<string, number>
          let shared_initial_overrides: CharacterAxisOverrides | undefined
          if (overrides_csv && overrides_csv.trim().length > 0) {
            shared_initial_overrides = {}
            for (const pair of overrides_csv.split(',')) {
              const [key, valStr] = pair.trim().split(':')
              if (!key || valStr === undefined) throw new Error(`overrides_csv 格式错误: "${pair.trim()}"`)
              shared_initial_overrides[key.trim()] = Number(valStr.trim())
            }
          }
          builder.setAxes(character_name, specific_axes, shared_initial_overrides)
          const specificNames = specific_axes.map((a) => a.name).join('/')
          const overridesSummary = shared_initial_overrides
            ? ` overrides: ${Object.entries(shared_initial_overrides)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}`
            : ''
          const summary =
            `Axes set for ${character_name}: ` +
            `specific=[${specificNames || '(none)'}]${overridesSummary}`
          onProgress({ type: 'tool_end', tool: 'set_character_axes', result_summary: summary })
          completionTracker.axesSet = true
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'set_character_axes', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),
  }
}

async function runCharacterLoop(
  model: ReturnType<ReturnType<typeof createOpenAICompatible>>,
  plan: ExportPlan,
  preSelected: PreSelectedExportData,
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  agentLog: AgentLogger,
  providerOpts?: SharedV3ProviderOptions,
): Promise<boolean> {
  const tag = '[export-char-loop]'
  const sharedAxes = plan.shared_axes
  const CHARACTER_STEP_CAP = 5 // 2 normal + 3 buffer

  for (const charPlan of plan.characters) {
    const charTag = `${tag}[${charPlan.name}]`
    logger.info(`${charTag} Starting character registration`)

    // Find the soul data for this character
    const soulData = preSelected.soulsData.find((s) => s.name === charPlan.name)
    if (!soulData) {
      const errorMsg = `角色数据缺失: "${charPlan.name}" 不在 soulsData 中`
      logger.error(`${charTag} ${errorMsg}`)
      onProgress({ type: 'error', error: errorMsg })
      return false
    }

    const charTracker = { axesSet: false }
    const charTools = makeCharacterTools(builder, onProgress, charTracker)

    const agent = new ToolLoopAgent({
      model,
      instructions: CHARACTER_PROMPT,
      tools: charTools,
      toolChoice: 'auto',
      temperature: 0,
      providerOptions: providerOpts,
      stopWhen: [stepCountIs(CHARACTER_STEP_CAP), () => charTracker.axesSet],
    })

    const prompt = buildCharacterPrompt(plan, charPlan, soulData, sharedAxes)
    logger.info(`${charTag} Character prompt length: ${prompt.length} chars`)

    try {
      const result = await runAgentLoop({
        agent,
        prompt,
        onProgress,
        agentLog,
        tag: charTag,
      })

      if (!charTracker.axesSet) {
        const detail = result.llmError
          ? `${result.llmError}。`
          : result.aborted
            ? '角色注册超时（90秒无响应）。'
            : `角色注册在 ${result.stepCount} 步内未完成。`
        const errorMsg = `角色 "${charPlan.name}" 注册失败：${detail}\n查看详细日志：${agentLog.filePath}`
        logger.warn(`${charTag} ${errorMsg}`)
        onProgress({ type: 'error', error: errorMsg })
        return false
      }

      logger.info(`${charTag} Character completed in ${result.stepCount} steps`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`${charTag} Character error:`, errorMsg)
      onProgress({ type: 'error', error: errorMsg })
      return false
    }
  }

  logger.info(`${tag} All ${plan.characters.length} characters registered`)
  return true
}

// --- Finalize and package (pure code, no LLM) ---

async function finalizeAndPackage(
  builder: ExportBuilder,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  agentLog: AgentLogger,
): Promise<boolean> {
  const tag = '[export-finalize]'

  try {
    onProgress({ type: 'tool_start', tool: 'finalize_export' })

    // Build and validate
    const { souls, world_name, story_spec } = builder.build()

    // Inject story identity from preSelected into story_spec
    story_spec.story_name = preSelected.storyName
    if (preSelected.storyDirection && preSelected.storyDirection.trim().length > 0) {
      story_spec.user_direction = preSelected.storyDirection.trim()
    }

    onProgress({ type: 'phase', phase: 'packaging' })
    const steps = ['copy_souls', 'copy_world', 'gen_story_spec', 'gen_skill']
    for (const s of steps) {
      onProgress({ type: 'package_step', step: s, status: 'pending' })
    }
    onProgress({ type: 'package_step', step: 'copy_souls', status: 'running' })

    const result = packageSkill({
      souls,
      world_name,
      story_name: preSelected.storyName,
      story_spec,
      output_base_dir: preSelected.outputBaseDir,
    })

    for (const s of steps) {
      onProgress({ type: 'package_step', step: s, status: 'done' })
    }

    const skillFileName = getSkillFileName(preSelected.storyName, world_name)
    const sizeKB = Math.round(result.size_bytes / 1024)

    onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: `${result.file_count} files, ${sizeKB} KB, ${souls.length} souls` })
    onProgress({
      type: 'complete',
      output_file: result.output_file,
      file_count: result.file_count,
      size_bytes: result.size_bytes,
      skill_name: skillFileName,
    })
    onProgress({ type: 'phase', phase: 'complete' })

    logger.info(`${tag} Package complete: ${result.file_count} files, ${sizeKB} KB`)
    return true
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(`${tag} finalize_export failed:`, errMsg)
    onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: `error: ${errMsg}` })
    agentLog.toolInternal(`FATAL: finalize failed: ${errMsg}`)
    onProgress({ type: 'error', error: `打包失败：${errMsg}\n查看详细日志：${agentLog.filePath}` })
    return false
  }
}
