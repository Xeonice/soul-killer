import { ToolLoopAgent, stepCountIs, hasToolCall, tool } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { withExacto } from '../llm/client.js'
import { z } from 'zod'
import os from 'node:os'
import type { SoulkillerConfig } from '../config/schema.js'
import type { SoulManifest } from '../soul/manifest.js'
import type { WorldManifest } from '../world/manifest.js'
import { packageSkill, getSkillFileName } from '../export/packager.js'
import type { ActOption, CharacterAxis, CharacterRole, CharacterSpec, StorySpecConfig } from '../export/story-spec.js'
import { logger } from '../utils/logger.js'
import { AgentLogger } from '../utils/agent-logger.js'

const MAX_CHARACTERS = 4

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
  axes?: CharacterAxis[]
}

class ExportBuilder {
  private metadata?: StoryMetadata
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

  addCharacter(c: Omit<CharacterDraft, 'axes'>): void {
    if (this.characters.has(c.name)) {
      throw new Error(`Character '${c.name}' already added`)
    }
    if (!this.preSelectedSouls.includes(c.name)) {
      throw new Error(`'${c.name}' not in pre-selected souls (${this.preSelectedSouls.join(', ')})`)
    }
    if (this.characters.size >= MAX_CHARACTERS) {
      throw new Error(`Maximum ${MAX_CHARACTERS} characters allowed per export`)
    }
    this.characters.set(c.name, { ...c })
    this.insertionOrder.push(c.name)
  }

  setAxes(name: string, axes: CharacterAxis[]): void {
    const char = this.characters.get(name)
    if (!char) {
      throw new Error(`Character '${name}' not added yet — call add_character first`)
    }
    if (axes.length < 2 || axes.length > 3) {
      throw new Error('axes 必须 2-3 个')
    }
    char.axes = axes
  }

  characterCount(): number {
    return this.characters.size
  }

  preSelectedCount(): number {
    return this.preSelectedSouls.length
  }

  build(): { souls: string[]; world_name: string; story_spec: StorySpecConfig } {
    if (!this.metadata) throw new Error('Missing set_story_metadata — call it before finalize_export')
    if (this.characters.size === 0) throw new Error('No characters added — call add_character at least once')

    const charactersList: CharacterSpec[] = []
    for (const name of this.insertionOrder) {
      const draft = this.characters.get(name)!
      if (!draft.axes) {
        throw new Error(`Character '${draft.name}' missing axes — call set_character_axes for it`)
      }
      charactersList.push({
        name: draft.name,
        display_name: draft.display_name,
        role: draft.role,
        axes: draft.axes,
        appears_from: draft.appears_from,
        dynamics_note: draft.dynamics_note,
      })
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
      },
    }
  }
}

// --- Progress event types ---

export type ExportProgressEvent =
  | { type: 'phase'; phase: ExportPhase }
  | { type: 'tool_start'; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; result_summary: string }
  | { type: 'ask_user_start'; question: string; options?: AskUserOption[]; allow_free_input?: boolean; multi_select?: boolean }
  | { type: 'ask_user_end'; answer: string }
  | { type: 'package_step'; step: string; status: 'pending' | 'running' | 'done' }
  | { type: 'complete'; output_file: string; file_count: number; size_bytes: number; skill_name: string }
  | { type: 'error'; error: string }

export type ExportPhase = 'initiating' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'

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

// --- Export Agent ---

const SYSTEM_PROMPT = `你是多角色视觉小说的剧本生成器。用户已经选定了角色和世界，所有数据已经在你的上下文中。

# 用户原始意图处理（重要）

如果 initial prompt 的最前部出现 **"# 用户原始意图（最高优先级）"** 块，这是用户在 wizard 中自由输入的故事走向描述，是所有后续决策的**最高优先级指引**：

- 你生成的 **tone / constraints / 角色 role 分配** 必须反映该意图
- 用户没提到的细节可以自主创作，但不要偏离用户方向
- 如果用户指定了某个角色作为 protagonist，尊重该选择
- 如果用户描述了情感基调（如"黑暗转折"），tone 和 constraints 必须呼应
- 意图可能与你基于 souls/world 的自主判断冲突，此时**服从用户**

如果没有该块，按默认工作流自主生成。

# 故事名（总是存在）

initial prompt 会包含 **"# 故事名"** 块，用户提供的故事名将作为 skill 的身份标识。你在推导 tone 和构造角色编排时可以参考这个名称反映的主题倾向。

# 工作流（必须按以下顺序调用工具，每次调用 input 简短）

**Step 1**: 调用 \`set_story_metadata\` 设定故事整体框架（genre / tone / constraints / acts_options / default_acts）

**Step 2**: 对每个角色（顺序自由）依次完成两个调用：
  a) \`add_character\` — 注册角色基本信息（name / role / display_name / appears_from / dynamics_note）
  b) \`set_character_axes\` — 设置该角色的好感轴（character_name + axes 数组）

**Step 3**: 所有角色都设置完毕后，调用 \`finalize_export\` 触发实际打包。

如果任何调用返回 \`{ error: ... }\`，根据错误信息修正后重试。
**绝对不要**在一次调用里塞所有信息——这会失败。每次调用 input 应保持简短。

# 任务详解

## 1. 分析角色关系
从每个角色的 identity.md、milestones.md 以及（如存在的）behaviors/relationships.md 中交叉提取角色之间的关系动态。
单侧提到也算关系；完全无关系数据时基于人格和世界观创意补全。

## 2. 故事整体框架（set_story_metadata）

- **genre**: 类型，如 "都市奇幻 / 心理剧" "历史权谋"
- **tone**: 必须反映这个**特定角色组合**的独特性。**禁用**通用词如 "悬疑/温情/冒险/史诗"。
  示例好的 tone: "傲娇外壳下的温柔救赎·姐妹羁绊与黑化"
- **constraints**: 至少包含一条 **tradeoff 约束**（每个选项必须对不同角色产生差异化好感影响）；
  以及反映该组合独特命题的 3-6 条具体约束
- **acts_options**: 提供 2-3 个长度预设供用户在 skill 启动时选择，根据角色数推荐：
  - 角色数 ≤ 2 → \`[{ acts: 3 }, { acts: 5 }]\`，default_acts = 3
  - 角色数 3-4 → \`[{ acts: 3 }, { acts: 5 }, { acts: 7 }]\`，default_acts = 5
  每个 ActOption 字段：
  - \`acts\`: 幕数 (3/5/7)
  - \`label_zh\`: "短篇" / "中篇" / "长篇"
  - \`rounds_total\`: ≈ acts × 8-12，例如 3 幕 → "24-36"
  - \`endings_count\`: ≈ acts + 1，例如 3 幕 → 4，5 幕 → 5，7 幕 → 6
- **default_acts**: 推荐值，必须在 acts_options 列表中

**重要**: 幕数最终由用户在 skill 启动时选择。你只负责给出合理选项，不要锁定单一幕数。

## 3. 角色注册（add_character）

每次只注册一个角色：

- **name**: 必须是预选 souls 列表中的某项（不要写错）
- **role**: 至少有 1 个 protagonist；多角色时建议 1 个 deuteragonist 与之形成叙事张力；antagonist 可选
- **display_name**: 可选，若有更顺口的中文显示名
- **appears_from**: 可选，"act_1" / "act_2" / "act_3"。注意运行时如果用户选了较短长度，超出的会被自动截断到最后一幕
- **dynamics_note**: 一句话描述该角色与其他角色的关系动态

## 4. 好感轴设计（set_character_axes）

每个角色 2-3 个轴，轴名必须反映该角色的核心人际动态。参考（不是硬规则）：

| 人格特征 | 推导轴 |
|---------|--------|
| 忠义 / 重承诺 | trust / bond / faithfulness |
| 智谋 / 善分析 | understanding / insight / respect |
| 高傲 / 对抗性 | respect / rivalry / caution |
| 温柔 / 关怀 | warmth / curiosity / comfort |
| 叛逆 / 自由 | freedom / defiance / affinity |

初始值 3-6，反映角色与陌生人的默认态度。轴的 \`name\` 是中文显示名，\`english\` 是 kebab-case 英文标识符。

## 5. 触发打包（finalize_export）

确认所有角色都已 set_character_axes 后，调用 \`finalize_export\`。
如果 builder 状态不完整，会返回 error，根据信息补全后重试。

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

你生成的 tone / constraints / 角色 role 分配必须反映上述意图。用户没提到的细节可以自主决定，但不要偏离用户方向。

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

  return `${userIntentBlock}${storyNameBlock}以下是用户选定的角色组合和世界。请分析后按分阶段工作流调用工具完成打包。

${worldBlock}

---

# Characters (${soulsData.length})

${soulBlocks}

---

请开始分析。
`
}

export async function runExportAgent(
  config: SoulkillerConfig,
  preSelected: PreSelectedExportData,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
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
  const model = provider(withExacto(config.llm.default_model))

  // Dedicated log file for export runs — separate from capture/distill logs
  const promptLabel = `Export Skill: ${preSelected.souls.join(',')} in ${preSelected.worldName}`
  const agentLog = new AgentLogger(promptLabel, {
    model: config.llm.default_model,
    provider: 'openrouter',
    subdir: 'export',
  })
  logger.info(`${tag} Agent log: ${agentLog.filePath}`)

  // Build the per-run accumulator
  const builder = new ExportBuilder(preSelected.souls, preSelected.worldName)

  // Tools: staged builder tools + ask_user (fallback).
  // No list_* / read_* — data is already in the initial prompt.
  const tools = {
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
        acts_options: z.array(z.object({
          acts: z.number().describe('幕数 (3/5/7)'),
          label_zh: z.string().describe('"短篇" / "中篇" / "长篇"'),
          rounds_total: z.string().describe('总轮数范围，如 "24-36"'),
          endings_count: z.number().describe('结局数'),
        })).min(2).max(3).describe('2-3 个长度预设，运行时由用户选择'),
        default_acts: z.number().describe('推荐默认值，必须等于 acts_options 中某项的 acts'),
      }),
      execute: async ({ genre, tone, constraints, acts_options, default_acts }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_story_metadata' })
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

    add_character: tool({
      description: '注册一个角色到 export builder。每个角色调用一次。注册后必须再调用 set_character_axes 设置好感轴。',
      inputSchema: z.object({
        name: z.string().describe('Soul 名称（必须与预选 souls 列表中的某项匹配）'),
        role: z.enum(['protagonist', 'deuteragonist', 'antagonist', 'supporting']),
        display_name: z.string().optional().describe('可选的中文显示名'),
        appears_from: z.string().optional().describe('如 "act_1" / "act_2"。运行时若超出所选幕数会被截断'),
        dynamics_note: z.string().optional().describe('一句话描述该角色的关系动态'),
      }),
      execute: async ({ name, role, display_name, appears_from, dynamics_note }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'add_character', args: { name } })
          builder.addCharacter({ name, role, display_name, appears_from, dynamics_note })
          const summary = `Character ${builder.characterCount()}/${builder.preSelectedCount()} added: ${name} (${role})`
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
      description: '为已添加的角色设置好感轴（2-3 个轴）。必须先调用 add_character 注册该角色。',
      inputSchema: z.object({
        character_name: z.string().describe('已通过 add_character 添加的 Soul 名称'),
        axes: z.array(z.object({
          name: z.string().describe('中文显示名（如 "信任"）'),
          english: z.string().describe('kebab-case 英文标识符（如 "trust"）'),
          initial: z.number().describe('初始值 0-10，建议 3-6'),
        })).min(2).max(3),
      }),
      execute: async ({ character_name, axes }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_character_axes', args: { character_name } })
          builder.setAxes(character_name, axes)
          const axisNames = axes.map((a) => a.name).join('/')
          const summary = `Axes set for ${character_name}: ${axisNames}`
          onProgress({ type: 'tool_end', tool: 'set_character_axes', result_summary: summary })
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'set_character_axes', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),

    finalize_export: tool({
      description: '触发实际打包。在 set_story_metadata + 所有 add_character + 所有 set_character_axes 完成后调用。不需要参数，输出路径已由 CLI 预设。',
      inputSchema: z.object({}),
      execute: async () => {
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

          return {
            output_file: result.output_file,
            file_count: result.file_count,
            size_bytes: result.size_bytes,
            skill_file_name: skillFileName,
            soul_count: souls.length,
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          logger.error('[export-agent] finalize_export failed:', errMsg)
          onProgress({ type: 'tool_end', tool: 'finalize_export', result_summary: `error: ${errMsg}` })
          // Return error instead of throwing — agent can fix and retry
          return { error: errMsg }
        }
      },
    }),
  }

  let finalizeExportCalled = false
  try {
    const agent = new ToolLoopAgent({
      model,
      instructions: SYSTEM_PROMPT,
      tools,
      toolChoice: 'auto',
      temperature: 0,
      stopWhen: [stepCountIs(20), hasToolCall('finalize_export')],
    })

    // Watchdog: abort if no progress for 90 seconds
    const WATCHDOG_MS = 90_000
    const abortController = new AbortController()
    let watchdog: ReturnType<typeof setTimeout> | undefined
    let stepCount = 0
    function resetWatchdog() {
      if (watchdog) clearTimeout(watchdog)
      watchdog = setTimeout(() => {
        logger.warn(`${tag} Stream timeout after ${WATCHDOG_MS / 1000}s — aborting`)
        abortController.abort()
      }, WATCHDOG_MS)
    }
    resetWatchdog()

    onProgress({ type: 'phase', phase: 'analyzing' })

    const initialPrompt = buildInitialPrompt(preSelected)
    logger.info(`${tag} Initial prompt length: ${initialPrompt.length} chars`)

    const streamResult = await agent.stream({ prompt: initialPrompt, abortSignal: abortController.signal })
    const toolStartTimes = new Map<string, number>()

    let eventCounter = 0
    const eventTypeCounts: Record<string, number> = {}
    let lastHeartbeat = Date.now()
    for await (const event of streamResult.fullStream) {
      resetWatchdog()
      eventCounter++
      const evType = (event as { type?: string }).type ?? 'unknown'
      eventTypeCounts[evType] = (eventTypeCounts[evType] ?? 0) + 1

      // Heartbeat every 5 seconds to confirm event flow
      const now = Date.now()
      if (now - lastHeartbeat > 5000) {
        logger.info(`${tag} Heartbeat: ${eventCounter} events received so far. Recent counts: ${JSON.stringify(eventTypeCounts)}`)
        lastHeartbeat = now
      }

      if (evType === 'start-step') {
        stepCount++
        logger.info(`${tag} Step ${stepCount} started`)
        agentLog.startStep(stepCount, 'analyzing')
        onProgress({ type: 'phase', phase: 'analyzing' })
      } else if (evType === 'text-delta' || evType === 'text') {
        // AI SDK v6 may emit 'text-delta' or 'text' for streaming text chunks
        const text = (event as { text?: string; textDelta?: string }).text
          ?? (event as { textDelta?: string }).textDelta
          ?? ''
        if (text) agentLog.modelOutput(text)
      } else if (evType === 'reasoning-start') {
        agentLog.modelOutput('\n[REASONING START]\n')
      } else if (evType === 'reasoning-delta') {
        // Reasoning model internal thinking (e.g., glm-5). Log but don't drive progress.
        const text = (event as { text?: string }).text ?? ''
        if (text) agentLog.modelOutput(text)
      } else if (evType === 'reasoning-end') {
        agentLog.modelOutput('\n[REASONING END]\n')
      } else if (evType === 'tool-input-start' || evType === 'tool-input-delta' || evType === 'tool-input-end') {
        // Tool input streaming events — emitted as the LLM generates the tool input JSON.
        // The final assembled tool-call event is what we actually act on; ignore the deltas.
        // (Counted in eventTypeCounts for diagnostics.)
      } else if (evType === 'tool-call') {
        const e = event as { toolName?: string; input?: unknown }
        const toolName = e.toolName ?? 'unknown'
        logger.info(`${tag} Step ${stepCount}: tool-call ${toolName}`)
        toolStartTimes.set(toolName, Date.now())
        agentLog.toolCall(toolName, e.input)
        if (toolName === 'finalize_export') {
          finalizeExportCalled = true
        }
      } else if (evType === 'tool-result') {
        const e = event as { toolName?: string; output?: unknown }
        const toolName = e.toolName ?? 'unknown'
        const startTime = toolStartTimes.get(toolName) ?? Date.now()
        const durationMs = Date.now() - startTime
        agentLog.toolResult(toolName, e.output, durationMs)
      } else if (evType === 'error') {
        const e = event as { error?: unknown }
        const errStr = String(e.error)
        agentLog.toolInternal(`STREAM ERROR: ${errStr}`)
        logger.error(`${tag} Stream error:`, e.error)
      } else {
        // Catch-all: log unknown event types for diagnostics
        const snapshot = JSON.stringify(event, null, 2).slice(0, 500)
        agentLog.toolInternal(`UNHANDLED EVENT [${evType}]: ${snapshot}`)
        if (eventCounter <= 20) {
          logger.info(`${tag} Unhandled event type: ${evType}`)
        }
      }
    }
    logger.info(`${tag} Stream consumed ${eventCounter} events. Type counts: ${JSON.stringify(eventTypeCounts)}`)
    if (watchdog) clearTimeout(watchdog)

    logger.info(`${tag} Export agent completed, steps=${stepCount}, finalizeExportCalled=${finalizeExportCalled}`)

    if (!finalizeExportCalled) {
      const errorMsg = `导出代理意外终止（未调用 finalize_export），已执行 ${stepCount} 步。\n` +
        `查看详细日志：${agentLog.filePath}`
      logger.warn(`${tag} Stream ended without finalize_export call`)
      agentLog.toolInternal(`FATAL: Stream ended without finalize_export call after ${stepCount} steps`)
      agentLog.close()
      onProgress({ type: 'error', error: errorMsg })
    } else {
      agentLog.close()
    }
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || String(err).includes('abort'))
    const errorMsg = isAbort
      ? '导出代理超时（90秒无响应）。LLM 可能卡住或网络异常，请重试。'
      : (err instanceof Error ? err.message : String(err))
    logger.error(`${tag} Export agent error:`, errorMsg)
    agentLog.toolInternal(`FATAL: ${errorMsg}`)
    agentLog.close()
    onProgress({ type: 'error', error: errorMsg })
  }
}
