import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import type { ExportPlan, ExportPlanCharacter, RouteCandidate, OnExportProgress, PreSelectedExportData } from './types.js'
import { PLANNING_SYSTEM_PROMPT, buildPlanningPrompt } from './prompts.js'
import { runAgentLoop } from './agent-loop.js'
import { logger } from '../../infra/utils/logger.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'
import { createArrayArgRepair } from '../../infra/utils/repair-tool-call.js'

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
  if (!plan.genre_direction?.trim()) return 'genre_direction must not be empty'
  if (!plan.tone_direction?.trim()) return 'tone_direction must not be empty'
  if (!plan.prose_direction?.trim()) return 'prose_direction must not be empty'

  // 2. shared_axes: exactly 2, snake_case
  if (!Array.isArray(plan.shared_axes) || plan.shared_axes.length !== 2) {
    return 'shared_axes must be exactly 2'
  }
  for (const axis of plan.shared_axes) {
    if (!SNAKE_CASE_RE.test(axis)) return `shared_axes "${axis}" is not snake_case`
  }
  if (plan.shared_axes[0] === plan.shared_axes[1]) {
    return 'shared_axes must have two different names'
  }

  // 3. flags: non-empty, snake_case
  if (!Array.isArray(plan.flags) || plan.flags.length === 0) {
    return 'flags must not be empty'
  }
  for (const flag of plan.flags) {
    if (!SNAKE_CASE_RE.test(flag)) return `flag "${flag}" is not snake_case`
  }

  // 4. characters: coverage check
  if (!Array.isArray(plan.characters) || plan.characters.length === 0) {
    return 'characters must not be empty'
  }
  const planNames = new Set(plan.characters.map((c) => c.name))
  const preSelectedSet = new Set(preSelectedSouls)
  const missing = preSelectedSouls.filter((n) => !planNames.has(n))
  const extra = plan.characters.filter((c) => !preSelectedSet.has(c.name)).map((c) => c.name)
  if (missing.length > 0) return `plan is missing characters: ${missing.join(', ')}`
  if (extra.length > 0) return `plan contains unselected characters: ${extra.join(', ')}`

  // 5. at least 1 protagonist
  const hasProtagonist = plan.characters.some((c) => c.role === 'protagonist')
  if (!hasProtagonist) return 'at least 1 protagonist is required'

  // 6. specific_axes_direction: max 2 per character
  for (const c of plan.characters) {
    if (c.specific_axes_direction && c.specific_axes_direction.length > 2) {
      return `character "${c.name}" specific_axes_direction must not exceed 2`
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
      route_candidates: RouteCandidate[]
    } | null,
    characters: [] as ExportPlanCharacter[],
    finalized: false,
  }

  const planningTools = {
    plan_story: tool({
      description: 'Set story-level planning direction. This is the first step; must be called before plan_character.',
      inputSchema: z.object({
        genre_direction: z.string().describe('Genre direction, e.g. "magical warfare / psychological drama"'),
        tone_direction: z.string().describe('Tone direction reflecting the unique character combination; avoid generic words'),
        shared_axes_1: z.string().describe('First non-bond shared axis name (snake_case)'),
        shared_axes_2: z.string().describe('Second non-bond shared axis name (snake_case, different from first)'),
        flags: z.array(z.string()).describe('Key event flag name list (snake_case, 5-8 items)'),
        prose_direction: z.string().describe('Narrative style direction description'),
        route_candidates: z.array(z.object({
          slug: z.string().describe('Character soul slug (must match a pre-selected soul name)'),
          name: z.string().describe('Character display name'),
          reason: z.string().describe('Why this character is a good route focus (1-2 sentences)'),
        })).describe('Top 2-3 characters recommended as route focus based on conflict depth and arc potential. Empty array if only 1 character.').default([]),
      }),
      inputExamples: [{
        input: {
          genre_direction: 'spy thriller / political conspiracy',
          tone_direction: 'Gray morality game of loyalty vs betrayal — former mentor and student reunited in extremis',
          shared_axes_1: 'loyalty_vs_survival',
          shared_axes_2: 'freedom_vs_control',
          flags: ['air_force_one_crash', 'truth_revealed', 'final_confrontation', 'extraction_attempt', 'fate_decided'],
          prose_direction: 'Cold-realism cyberpunk noir, multi-perspective with sharp dialogue',
        },
      }],
      execute: async ({ genre_direction, tone_direction, shared_axes_1, shared_axes_2, flags, prose_direction, route_candidates }: {
        genre_direction: string; tone_direction: string; shared_axes_1: string; shared_axes_2: string;
        flags: string[]; prose_direction: string; route_candidates?: Array<{ slug: string; name: string; reason: string }>;
      }) => {
        onProgress({ type: 'tool_start', tool: 'plan_story' })
        // Validate
        if (!genre_direction.trim()) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: genre_direction must not be empty' })
          return { error: 'genre_direction must not be empty' }
        }
        if (!tone_direction.trim()) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: tone_direction must not be empty' })
          return { error: 'tone_direction must not be empty' }
        }
        if (!SNAKE_CASE_RE.test(shared_axes_1) || !SNAKE_CASE_RE.test(shared_axes_2)) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: shared_axes must be snake_case' })
          return { error: 'shared_axes must be snake_case' }
        }
        if (shared_axes_1 === shared_axes_2) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: the two shared axes must be different' })
          return { error: 'the two shared axes must be different' }
        }
        if (flags.length === 0) {
          onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: 'error: flags must not be empty' })
          return { error: 'flags must not be empty' }
        }
        for (const f of flags) {
          if (!SNAKE_CASE_RE.test(f)) {
            onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: `error: flag "${f}" is not snake_case` })
            return { error: `flag "${f}" is not snake_case` }
          }
        }
        planBuilder.story = {
          genre_direction,
          tone_direction,
          shared_axes: [shared_axes_1, shared_axes_2],
          flags,
          prose_direction,
          route_candidates: route_candidates ?? [],
        }
        const routeSummary = route_candidates && route_candidates.length > 0
          ? `, routes=[${route_candidates.map(r => r.name).join(', ')}]`
          : ''
        const summary = `genre=${genre_direction}, shared=[${shared_axes_1}, ${shared_axes_2}], ${flags.length} flags${routeSummary}`
        onProgress({ type: 'tool_end', tool: 'plan_story', result_summary: summary })
        return { ok: true, summary }
      },
    }),

    plan_character: tool({
      description: 'Set planning direction for one character. Call once per character. plan_story must be called first.',
      inputSchema: z.object({
        name: z.string().describe('Soul name (must match the pre-selected list)'),
        role: z.enum(['protagonist', 'deuteragonist', 'antagonist']),
        specific_axes_direction: z.string().describe('Specific axes direction (natural language), e.g. "sense of honor / self-worth". Empty string if no specific axes'),
        needs_voice_summary: z.boolean().describe('Set to true when style.md contains > 30% non-Chinese text'),
        appears_from: z.number().optional().describe('Act number from which the character appears'),
      }),
      execute: async ({ name, role, specific_axes_direction, needs_voice_summary, appears_from }) => {
        onProgress({ type: 'tool_start', tool: 'plan_character', args: { name } })
        if (!planBuilder.story) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: 'error: call plan_story first' })
          return { error: 'plan_story must be called first' }
        }
        if (!preSelected.souls.includes(name)) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: `error: "${name}" not in pre-selected list` })
          return { error: `"${name}" is not in the pre-selected list` }
        }
        if (planBuilder.characters.some((c) => c.name === name)) {
          onProgress({ type: 'tool_end', tool: 'plan_character', result_summary: `error: "${name}" already added` })
          return { error: `"${name}" has already been added` }
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
      description: 'Finalize the plan. Call after plan_character has been called for all characters. Validates completeness and assembles the plan.',
      inputSchema: z.object({}),
      execute: async () => {
        onProgress({ type: 'tool_start', tool: 'finalize_plan' })
        if (!planBuilder.story) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: 'error: plan_story was not called' })
          return { error: 'plan_story was not called' }
        }
        // Check coverage
        const missing = preSelected.souls.filter((s) => !planBuilder.characters.some((c) => c.name === s))
        if (missing.length > 0) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: `error: missing characters ${missing.join(', ')}` })
          return { error: `missing characters: ${missing.join(', ')}` }
        }
        if (!planBuilder.characters.some((c) => c.role === 'protagonist')) {
          onProgress({ type: 'tool_end', tool: 'finalize_plan', result_summary: 'error: at least 1 protagonist is required' })
          return { error: 'at least 1 protagonist is required' }
        }
        planBuilder.finalized = true
        const protagonist = planBuilder.characters.find((c) => c.role === 'protagonist')
        const summary = `${planBuilder.characters.length} characters, protagonist: ${protagonist?.name ?? '?'}`
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
      experimental_repairToolCall: createArrayArgRepair(),
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
        ? `${result.llmError}. Possibly the prompt exceeded the model context limit, or an API-side error occurred.`
        : `Planning Agent failed to complete within ${result.stepCount} steps.`
      const errorMsg = `Planning failed: ${detail}\nSee detailed log: ${agentLog.filePath}`
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
      ? 'Planning timed out (no response for 90 seconds).'
      : (err instanceof Error ? err.message : String(err))
    logger.error(`${tag} Planning error:`, errorMsg)
    onProgress({ type: 'error', error: errorMsg })
    return null
  }
}
