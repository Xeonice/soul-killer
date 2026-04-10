import { formatPathSegment } from './format/index.js'
import {
  topForbiddenPatterns,
  type ProseStyleForbiddenPattern,
} from './prose-style/index.js'

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
  target_language: 'zh'
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
  const charNames = characters.map((c) => c.name).join('、')
  const protagonist = characters.find((c) => c.role === 'protagonist')?.name ?? characters[0]?.name ?? ''

  return `
## 多角色编排（Cast）

本剧本包含 ${characters.length} 个核心角色：${charNames}。

### 角色定位

${characters.map((c) => {
  const roleLabel = c.role === 'protagonist' ? '主角'
    : c.role === 'deuteragonist' ? '次主角/对位角色'
    : c.role === 'antagonist' ? '对立角色'
    : '配角'
  const axes = c.axes.map((a) => `${a.name}(${a.english})`).join(' / ')
  const appearsLine = c.appears_from && c.appears_from !== 'act_1' ? `从 ${c.appears_from} 开始登场` : '全程出场'
  const dynamicsLine = c.dynamics_note ? `\n  - 动态: ${c.dynamics_note}` : ''
  return `- **${c.name}** [${roleLabel}]
  - 好感轴: ${axes}
  - 出场: ${appearsLine}${dynamicsLine}`
}).join('\n')}

### Cast 调度规则

每个场景必须显式标注 cast（在场角色），不在场角色不参与该场景对话，其好感轴不受该场景选项影响。

\`\`\`
[scene: 场景ID]

[narration]
旁白...

[cast]
- ${protagonist}: { mood: ..., stance: ... }
- {其他在场角色}: { mood: ..., stance: ... }

[dialogue]
${protagonist}: "..."
{其他角色}: "..."
（旁白可穿插）

[choices]
- "选项文字" -> scene:{下一场景} | ${protagonist}.${characters[0]?.axes[0]?.english ?? 'trust'} +2, {其他角色}.{轴} +/- N
- ...
\`\`\`

### 选项 Tradeoff 约束（重要）

- 每个选项必须对**不同角色产生差异化好感影响**（一个上升另一个下降，或不同强度）
- **禁止**所有选项对所有角色产生相同方向的影响（这是无意义选项）
- 至少有一个选项要让 protagonist 和 deuteragonist 之间产生张力
- 配角好感影响幅度通常小于主要角色

### 角色出场时机

${characters.filter((c) => c.appears_from && c.appears_from !== 'act_1').length > 0
  ? characters.filter((c) => c.appears_from && c.appears_from !== 'act_1')
      .map((c) => `- ${c.name}: 从 ${c.appears_from} 开始登场，首次出场必须有自然引入`)
      .join('\n')
  : '所有角色全程出场。'}
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
      schemaExampleLines.push(`    desc: "${c.name} 的${axis}（共享轴）"`)
      schemaExampleLines.push(`    type: int`)
      schemaExampleLines.push(`    range: [0, 10]`)
      schemaExampleLines.push(`    default: ${initial}`)
    }
    // Specific axes
    for (const a of c.axes) {
      schemaExampleLines.push(`  "affinity.${slug}.${a.english}":`)
      schemaExampleLines.push(`    desc: "${c.name} — ${a.name}（特异轴）"`)
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
      ? '(无特异轴)'
      : c.axes.map((a) => `\`${a.english}\`(${a.name})=${a.initial}`).join(', ')
    return `- **${c.name}** (slug: \`${slug}\`)\n  - 共享轴 initial: ${sharedParts}\n  - 特异轴: ${specificParts}`
  }).join('\n')

  const flagsListing = flagsList.length === 0
    ? '(本故事未通过 set_story_state 声明 flags — 本字段应由 export agent 填写)'
    : flagsList.map((f) => `- \`flags.${f.name}\` — ${f.desc} (initial: ${f.initial})`).join('\n')

  return `
## 状态系统（多角色，三层结构）

剧本所有运行时状态字段必须在 \`script.yaml\` 顶部的 \`state_schema\` 块中**显式声明**——key 是带引号的字面字符串，含 type / range / default / desc。详细约束见 SKILL.md 的「state_schema 创作约束」节。

**重要**: schema key **必须使用 ASCII slug**（小写字母 / 数字 / 连字符 / 下划线）作为角色命名空间，不允许 CJK 字符。每个角色对应的 slug 见 SKILL.md 顶部的「角色路径映射」表。

状态分**三层**：**共享 axes**（所有角色都有）、**角色特异 axes**（每角色 0-2 个）、**flags**（故事级预定义）。

### Layer 1: 共享 axes（每个角色必须全部 3 个）

本故事的共享 axes 是 \`${sharedAxes.join(' / ')}\`，其中 \`bond\` 是平台固定、另外 2 个由 export agent 在 \`set_story_state\` 时声明。
每个角色**必须**有完整的 3 个共享 axes 字段，**没有 opt-out**。共享 axes 用于 ending DSL 的跨角色聚合（\`all_chars\` / \`any_char\`）。

### Layer 2: 角色特异 axes（每角色 0-2 个）

特异 axes 是该角色独有的情感 / 成长维度，纯 flavor，不参与跨角色聚合，但仍可在 ending condition 中作为该角色专属分支条件。

### Layer 3: Flags（故事级预定义）

关键事件 flags 在 \`set_story_state\` 时**一次性声明**。**Phase 1 LLM 不能创造新 flag**，只能引用本节列出的 flag 名。

本故事声明的 flags：

${flagsListing}

### 各角色 state 设置

${charactersListingLines}

★ 标记表示该共享轴的 initial 被 per-character 覆盖（shared_initial_overrides）。

### state_schema 示例（本故事 — 由 Phase 1 LLM 在 script.yaml 中逐字复制）

\`\`\`yaml
state_schema:
${schemaExampleLines.join('\n')}
\`\`\`

### 选项状态影响（consequences）

每个 \`choice.consequences\` **必须**只引用 schema 中已声明的字段，且 key 必须**逐字符复制**。一个选项可以同时影响多个角色的共享轴、特异轴，以及 flags。

\`\`\`yaml
choices:
  - text: "选项文字"
    consequences:
      "affinity.${sampleCharA}.bond": -2                # 共享轴 delta
      "affinity.${sampleCharB}.${sampleSharedAxis}": +1  # 另一角色另一共享轴
      "flags.${sampleFlagName}": true                    # 故事级 flag 触发
    next: "scene-next"
\`\`\`

不同选项必须对**不同角色**产生差异化好感影响（这是 story-spec 的硬约束）。
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
## 结局判定（多角色组合，结构化 DSL）

至少 ${minEndings} 个不同结局（取决于运行时所选幕数），由多角色好感轴的组合 + 关键事件标记决定。

每个结局的 \`condition\` 字段**必须**用结构化 DSL（不接受自然语言字符串表达式）。
详细语法见 SKILL.md 的「endings condition 结构化 DSL」节。

按 endings 数组顺序遍历，第一个 \`evaluate(condition) === true\` 的 ending 触发。
**最后一个结局必须** \`condition: default\` 兜底。

DSL 中引用的所有 \`affinity.<slug>.<axis>\` key 必须使用角色的 ASCII slug（见 SKILL.md 顶部「角色路径映射」表），不允许 CJK。

### 可用 DSL 节点

- **比较节点**: \`{ key, op, value }\` — 引用任意 schema 字段（共享/特异轴、flags、custom）
- **布尔组合**: \`all_of: [...]\` / \`any_of: [...]\` / \`not: {...}\`
- **跨角色聚合**（仅对**共享轴**有效）:
  - \`all_chars: { axis, op, value, except? }\` — 所有角色（去掉 except 列表）该共享轴都满足条件
  - \`any_char: { axis, op, value, except? }\` — 至少一个角色（去掉 except 列表）该共享轴满足条件
- **兜底**: \`condition: default\`

**重要**: \`all_chars\` / \`any_char\` 的 \`axis\` 只能引用**共享轴**（\`bond\` 或 story_state.shared_axes_custom 里的 2 个），**不能**引用角色特异轴（特异轴各角色不同名，不能跨角色聚合）。

格式示例（在 script.yaml 中）：
\`\`\`yaml
endings:
  # 示例 1: 全体接纳 —— 用 all_chars 聚合所有角色的共享轴
  - id: "ending-unity"
    title: "众志成城"
    condition:
      all_of:
        - all_chars: { axis: "bond", op: ">=", value: 7, except: ["${villainSlug}"] }
        - { key: "flags.${sampleFlag}", op: "==", value: true }
    body: |
      ...

  # 示例 2: 双角色对立 —— ${displayA} 得分高而 ${displayB} 彻底敌对
  - id: "ending-${slugA}-route"
    title: "${displayA} 专属结局"
    condition:
      all_of:
        - { key: "affinity.${slugA}.bond", op: ">=", value: 8 }${specificAxisA ? `
        - { key: "affinity.${slugA}.${specificAxisA}", op: ">=", value: 7 }` : ''}
        - { key: "affinity.${slugB}.${sampleSharedAxis}", op: "<=", value: 2 }
    body: |
      ...

  # 示例 3: 任一角色达成觉悟 —— 用 any_char
  - id: "ending-breakthrough"
    title: "至少一人觉悟"
    condition:
      any_char: { axis: "${sampleSharedAxis}", op: ">=", value: 9 }
    body: |
      ...

  - id: "ending-default"
    title: "默认结局"
    condition: default
    body: |
      ...
\`\`\`

### 结局设计指引

- 不同结局应该反映**不同角色组合**的最终状态
- 至少要有：
  - 1 个偏向 protagonist 的结局
  - 1 个偏向 deuteragonist 的结局
  - 1 个所有角色都达到高好感的"完美"结局
  - 1 个默认/失败结局
- 结局之间必须有明显的情感差异

## 结局图鉴展示

到达结局时按以下顺序展示：

### 1. 结局演绎
结局旁白 + 在场角色的完整演绎（与普通场景格式一致）。

### 2. 旅程回顾

按角色分组展示每个角色的好感轴最终值：

\`\`\`
${characters.map((c) => {
  const axesLines = c.axes.map((a) => `  ${a.name.padEnd(8)} {bar} {value}/10`).join('\n')
  return `${c.name}:\n${axesLines}`
}).join('\n')}
\`\`\`

进度条格式：\`'█'.repeat(value) + '░'.repeat(10-value)\`

### 3. 关键事件标记

\`\`\`
{事件名} ✓  (已触发)
{事件名} ✗  (未触发)
\`\`\`

### 4. 结局图鉴（所有结局）

列出**所有**结局，每个包含：
- 标题（达成的标 ★，未达成标 ☆）
- 触发条件概述（如"需要诸葛亮信任 ≥ 7 且分享了秘密"）
- 一句预览文字（该结局开头第一句话）

格式示例：
\`\`\`
★ 星落五丈原 (已达成)
  "你守到了最后..."

☆ 卧龙凤雏 (未达成)
  条件: 诸葛亮.bond ≥ 8 AND 黄月英.warmth ≥ 8
  "如果你更早认识她..."
\`\`\`

### 5. 重玩选项

使用 AskUserQuestion 提供：
- "从头再来" — **复用当前剧本**，重置 affinity 和 flags 到剧本声明的 \`initial_state\`，清空当前 slot 的 state.yaml，从 Phase 2 第一场景重新开始；不重新进入 Phase 0/1，不重新生成剧本
- "结束故事" — 故事完结

如需玩全新剧本，请结束故事后重启 skill，在 Phase -1 菜单选择「生成新剧本」。
`
}

function buildSingleCharacterStateSystem(storyState?: StoryState): string {
  const sharedAxes = storyState
    ? [BOND_AXIS, ...storyState.shared_axes_custom]
    : [BOND_AXIS, 'trust', 'respect']
  const flagsList = storyState?.flags ?? []

  const flagsListing = flagsList.length === 0
    ? '(本故事未通过 set_story_state 声明 flags — 本字段应由 export agent 填写)'
    : flagsList.map((f) => `- \`flags.${f.name}\` — ${f.desc} (initial: ${f.initial})`).join('\n')

  return `
## 状态系统（单角色，三层结构）

剧本所有运行时状态字段必须在 \`script.yaml\` 顶部的 \`state_schema\` 块中**显式声明**——key、type、default、desc。详细约束见 SKILL.md 的「state_schema 创作约束」节。

状态分**三层**：**共享 axes**、**角色特异 axes**、**flags**。单角色模式下只有一个角色但仍按三层结构组织，以便与多角色模式行为一致。

### Layer 1: 共享 axes（3 个）

本故事的共享 axes 是 \`${sharedAxes.join(' / ')}\`，其中 \`bond\` 是平台固定、另外 2 个由 export agent 在 \`set_story_state\` 时声明。schema 中 key 形态：\`"affinity.<slug>.<axis>"\`。

### Layer 2: 角色特异 axes（0-2 个）

该主角独有的情感 / 成长维度，纯 flavor，不参与跨角色聚合（单角色模式下没有跨角色概念），但仍可进 ending condition。

### Layer 3: Flags（故事级预定义）

关键事件 flags 在 \`set_story_state\` 时**一次性声明**。**Phase 1 LLM 不能创造新 flag**。

本故事声明的 flags：

${flagsListing}

### 选项状态影响（consequences）

每个场景的 \`choices[*].consequences\` **必须**只引用 \`state_schema\` 中已声明的字段，且 key 必须从 schema **逐字符复制**。
- \`int\` 字段的 value 是 **delta**（加减），如 \`"affinity.<slug>.bond": -2\`
- \`bool\` 字段的 value 是**绝对覆盖**，如 \`"flags.<name>": true\`

不同选项应该对状态产生不同方向的影响，避免所有选项都加同一个轴。
`
}

function buildSingleCharacterEnding(): string {
  return `
## 结局判定（结构化 DSL）

每个结局的 \`condition\` 字段**必须**用结构化 DSL（不接受自然语言字符串表达式）。
详细语法见 SKILL.md 的「endings condition 结构化 DSL」节。

按 endings 数组顺序遍历，第一个 \`evaluate(condition) === true\` 的 ending 触发。
**最后一个结局必须** \`condition: default\` 兜底。

格式示例（在 script.yaml 中）：
\`\`\`yaml
endings:
  - id: "ending-trust-route"
    title: "信任结局"
    condition:
      all_of:
        - { key: "axes.trust", op: ">=", value: 7 }
        - { key: "flags.shared_secret", op: "==", value: true }
    body: |
      ...

  - id: "ending-understanding"
    title: "理解结局"
    condition:
      { key: "axes.understanding", op: ">=", value: 7 }
    body: |
      ...

  - id: "ending-default"
    title: "默认结局"
    condition: default
    body: |
      ...
\`\`\`

## 结局展示

每个结局必须包含：
1. 结局旁白和角色演绎（与普通场景格式一致）
2. 旅程回顾数据：列出最终的数值轴值和触发的事件标记
3. 所有其他结局的预览：标题 + 触发条件概述 + 一句预览文字

## 重玩选项

使用 AskUserQuestion 提供：
- "从头再来" — **复用当前剧本**，重置 axes 和 flags 到剧本声明的 \`initial_state\`，清空当前 slot 的 state.yaml，从 Phase 2 第一场景重新开始；不重新进入 Phase 0/1，不重新生成剧本
- "结束故事" — 故事完结

如需玩全新剧本，请结束故事后重启 skill，在 Phase -1 菜单选择「生成新剧本」。
`
}

function formatActOptionsBlock(options: ActOption[]): string {
  return options.map((o) =>
    `  - { acts: ${o.acts}, label_zh: "${o.label_zh}", rounds_total: "${o.rounds_total}", endings_count: ${o.endings_count} }`
  ).join('\n')
}

function formatActOptionsSummary(options: ActOption[], defaultActs: number): string {
  return options.map((o) => {
    const marker = o.acts === defaultActs ? ' [推荐]' : ''
    return `- **${o.label_zh}** (${o.acts} 幕，${o.rounds_total} 轮，${o.endings_count} 结局)${marker}`
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
  return `\n## Story State\n\n本块由 export agent 在 \`set_story_state\` 时声明。Phase 1 LLM 在写 script.yaml 的 state_schema 时**必须**严格复用这里的 flag 列表（key: \`flags.<name>\`），不能增删或改名；Phase -1 加载时会做一致性验证。\n\n\`\`\`yaml\n${axesLine}\n${flagsLines}\n\`\`\`\n`
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

  return `\n## 叙事风格锚点\n\n本块由 export agent 在 \`set_prose_style\` 时声明。Phase 1 写 \`narration\`/\`dialogue\` 和 Phase 2 即兴演绎时**必须**遵守 forbidden_patterns 作为硬约束；ip_specific 是本故事的术语和称谓规范；character_voice_summary（如有）是对应角色的中文声音锚点，优先级高于 style.md 中可能存在的非中文引文。\n\n\`\`\`yaml\ntarget_language: ${proseStyle.target_language}\nvoice_anchor: "${escapeYaml(proseStyle.voice_anchor)}"\nforbidden_patterns:\n${forbiddenYaml}\nip_specific:\n${ipSpecificYaml}${voiceSummaryYaml}\n\`\`\`\n`
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
  return `\n## 叙事风格锚点（fallback）\n\n本故事未通过 \`set_prose_style\` 声明叙事风格锚点（legacy archive）。Phase 1/2 LLM 使用以下通用中文写作约束作为 fallback：所有产出的中文文本必须避免下列通用翻译腔模式。\n\n\`\`\`yaml\ntarget_language: zh\nvoice_anchor: "通用克制书面中文，避免英文/日文句法的字面投影"\nforbidden_patterns:\n${fallbackYaml}\n\`\`\`\n`
}

export function generateStorySpec(config: StorySpecConfig): string {
  const { story_name, user_direction, genre, tone, constraints, acts_options, default_acts, characters, story_state, prose_style } = config

  const isMultiCharacter = !!characters && characters.length > 1

  // Use the smallest endings_count from acts_options as the multi-char min baseline
  const minEndings = acts_options.length > 0
    ? Math.min(...acts_options.map((o) => o.endings_count))
    : 4

  const constraintsBlock = constraints.length > 0
    ? `\n## 额外约束\n\n${constraints.map((c) => `- ${c}`).join('\n')}\n`
    : ''

  const charactersFrontmatter = characters && characters.length > 0
    ? `\ncharacters:\n${formatCharactersBlock(characters)}\n`
    : ''

  const actOptionsFrontmatter = `\nacts_options:\n${formatActOptionsBlock(acts_options)}\ndefault_acts: ${default_acts}\n`

  const userDirectionFrontmatter = user_direction && user_direction.trim().length > 0
    ? formatUserDirectionBlock(user_direction.trim())
    : ''

  const storyIdentityBlock = `\n# 故事身份

- **故事名**: ${story_name}${user_direction && user_direction.trim().length > 0 ? `\n- **用户原始意图**:\n\n> ${user_direction.trim().split('\n').join('\n> ')}\n` : ''}
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
    : '\n## Story State\n\n(本故事未通过 set_story_state 声明。Phase -1 加载验证会把此视为 legacy，请重新 export。)\n'

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

此处由 Skill 运行时 Phase 0 收集的用户 seeds 动态填充。
如果用户选择"让命运来决定"，则此段为空，完全随机生成。

# 故事长度（运行时选择）

故事长度由用户在 Phase 0 选择，可选项：

${formatActOptionsSummary(acts_options, default_acts)}

引擎在用户选择后，将所选项的 acts 写入 \`state.chosen_acts\`，rounds_total 写入 \`state.rounds_budget\`，endings_count 写入 \`state.target_endings_count\`。后续所有结构性指标都以这些 runtime 值为准。

## appears_from 截断规则

如果某角色的 \`appears_from\` 大于用户所选 \`chosen_acts\`：
- 截断到最后一幕（act_{chosen_acts}）首次出场
- 不报错，自然引入

# 剧本生成规约

## 结构要求

- 幕数: 用户在 Phase 0 选择的 \`state.chosen_acts\`，每幕 2-4 个场景
- 结局数: 至少 \`state.target_endings_count\` 个
- 总交互轮数: \`state.rounds_budget\`
- 每个场景结尾必须有 2-3 个选项

## 场景格式

每个场景必须包含：

\`\`\`
[narration]
第二人称沉浸式旁白，描述环境、氛围、角色状态。

[character: {角色名}]
state: 角色当前的情绪/身体状态
attitude: 对用户的态度
key_info: 本场景必须透露的关键信息
tone: 对话的情绪基调

[choices]
- "选项文字" -> scene:{下一场景ID} | {状态影响}
- "选项文字" -> scene:{下一场景ID} | {状态影响}
\`\`\`

状态影响格式示例：\`trust +1, understanding +2\` 或 \`shared_secret = true\`

## 叙事约束

- 类型为「${genre}」，整体风格为「${tone}」
- 开场必须自然引入角色与用户的相遇
- 选项必须产生实质性的剧情分歧，不能殊途同归
- 结局之间要有明显的情感差异
- 世界观元素要自然融入场景，不要说教式展示

## 角色约束

- 角色行为必须符合 souls/{角色名}/identity.md 中的人格描述
- 说话方式必须符合 souls/{角色名}/style.md
- 角色不会无条件信任用户，信任需要通过选择建立
${storyStateSection}${proseStyleSection}${castSection}${stateSection}${endingSection}
## 幕间过渡

- 每次 Act 切换必须有过渡旁白（总结上一幕情绪余韵）
- 过渡后附带一个反思性选择（不影响剧情走向，影响下一幕情绪入口）

## 禁止

- 不要生成超过 \`state.chosen_acts × 5\` 个场景（运行时上限）
- 不要生成单选项场景（死路）
- 不要在前 \`floor(state.chosen_acts / 2)\` 幕就出现结局分支
- 不要让角色主动打破第四面墙
- 静态参考: 最长剧本不超过 ${maxActs * 5} 个场景
${constraintsBlock}`
}
