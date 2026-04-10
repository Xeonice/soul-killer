import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import type { ExportPlan, ExportPlanCharacter, OnExportProgress, PreSelectedExportData } from './types.js'
import { PLANNING_SYSTEM_PROMPT, buildPlanningPrompt } from './prompts.js'
import { runAgentLoop } from './agent-loop.js'
import { logger } from '../../utils/logger.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

// --- Planning Agent ---

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/

/**
 * Step cap for the Planning Agent. 3 tools in the normal flow:
 *   1. plan_story (story-level decisions)
 *   2-N. plan_character × characterCount (per-character decisions)
 *   N+1. finalize_plan (assembly + validation)
 * Plus safety buffer for retries.
 */
export function computePlanningStepCap(characterCount: number): number {
  const minimal = 1 + characterCount + 1 // plan_story + N × plan_character + finalize_plan
  return minimal + Math.max(3, characterCount) // retry buffer
}

export function validatePlan(
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

export async function runPlanningLoop(
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
