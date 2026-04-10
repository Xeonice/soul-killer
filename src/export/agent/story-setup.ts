import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import type { ActOption, StoryStateFlag } from '../story-spec.js'
import type { ProseStyleForbiddenPattern } from '../prose-style/index.js'
import { formatPatternsForToolDescription } from '../prose-style/index.js'
import type { ExportPlan, OnExportProgress, PreSelectedExportData, AskUserHandler } from './types.js'
import { ExportBuilder } from './types.js'
import { STORY_SETUP_PROMPT, buildStorySetupPrompt } from './prompts.js'
import { runAgentLoop } from './agent-loop.js'
import { logger } from '../../utils/logger.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

export function makeStorySetupTools(
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

export async function runStorySetup(
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
