import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import type { CharacterAxis, CharacterAxisOverrides } from '../spec/story-spec.js'
import type { ExportPlan, OnExportProgress, PreSelectedExportData } from './types.js'
import { ExportBuilder } from './types.js'
import { CHARACTER_PROMPT, buildCharacterPrompt } from './prompts.js'
import { runAgentLoop } from './agent-loop.js'
import { logger } from '../../infra/utils/logger.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'

export function makeCharacterTools(
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

export async function runCharacterLoop(
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
