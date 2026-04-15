import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import { z } from 'zod'
import type { ActOption, RouteCharacter, StoryStateFlag } from '../spec/story-spec.js'
import type { ProseStyleForbiddenPattern } from '../support/prose-style-index.js'
import { formatPatternsForToolDescription } from '../support/prose-style-index.js'
import type { ExportPlan, OnExportProgress, PreSelectedExportData, AskUserHandler } from './types.js'
import { ExportBuilder } from './types.js'
import { STORY_SETUP_PROMPT, buildStorySetupPrompt } from './prompts.js'
import { runAgentLoop } from './agent-loop.js'
import { logger } from '../../infra/utils/logger.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'
import { createArrayArgRepair } from '../../infra/utils/repair-tool-call.js'

/**
 * Validate the README catalog display fields passed by the LLM in
 * set_story_metadata. Returns an error message when any field violates its
 * format rule, or `null` when all three are valid.
 *
 * Rules (see openspec/changes/skill-catalog-autogen/specs/export-agent/spec.md):
 * - world_slug: kebab-case ASCII /^[a-z0-9]+(-[a-z0-9]+)*$/, length 2-32
 * - world_name: non-empty, length <= 40
 * - summary: non-empty, no newlines, length <= 80
 */
export function validateCatalogFields(input: {
  world_slug: string
  world_name: string
  summary: string
}): string | null {
  const slug = input.world_slug
  if (typeof slug !== 'string' || slug.length < 2 || slug.length > 32) {
    return 'world_slug length must be between 2 and 32 characters'
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return 'world_slug must be kebab-case ASCII [a-z0-9-]+ (no uppercase, underscores, leading/trailing hyphens, or consecutive hyphens)'
  }
  const name = input.world_name
  if (typeof name !== 'string' || name.length === 0) {
    return 'world_name must be a non-empty string'
  }
  if (name.length > 40) {
    return 'world_name must be at most 40 characters'
  }
  const summary = input.summary
  if (typeof summary !== 'string' || summary.length === 0) {
    return 'summary must be a non-empty string'
  }
  if (summary.length > 80) {
    return 'summary must be at most 80 characters'
  }
  if (/[\r\n]/.test(summary)) {
    return 'summary must be a single line (no \\r / \\n characters)'
  }
  return null
}

export function makeStorySetupTools(
  builder: ExportBuilder,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
  completionTracker: { proseStyleSet: boolean },
  exportLanguage: 'zh' | 'en' | 'ja' = 'zh',
) {
  return {
    ask_user: tool({
      description: 'Fallback: only use when analysis reveals critically insufficient data. Do not use in normal flow.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
        options: z.array(z.object({
          label: z.string(),
          description: z.string().optional(),
        })).optional().describe('Option list'),
        allow_free_input: z.boolean().optional().describe('Whether to allow free text input'),
        multi_select: z.boolean().optional().describe('Whether to allow multi-select'),
      }),
      inputExamples: [{
        input: {
          question: 'The character data seems insufficient. How would you like to proceed?',
          options: [
            { label: 'Continue with available data', description: 'Use what we have' },
            { label: 'Cancel export', description: 'Stop and add more data first' },
          ],
          allow_free_input: false,
          multi_select: false,
        },
      }],
      execute: async ({ question, options, allow_free_input, multi_select }) => {
        onProgress({ type: 'ask_user_start', question, options, allow_free_input, multi_select })
        const answer = await askUser(question, options, allow_free_input, multi_select)
        onProgress({ type: 'ask_user_end', answer })
        return { answer }
      },
    }),

    set_story_metadata: tool({
      description: 'Set story-level framework (genre / tone / constraints / acts_options / default_acts) plus README catalog display candidates (world_slug / world_name / summary). This is the first step of the staged workflow.',
      strict: true,
      inputSchema: z.object({
        genre: z.string().describe('Story genre, e.g. "urban fantasy / psychological drama"'),
        tone: z.string().describe('Tone reflecting the unique character combination; avoid generic words'),
        constraints: z.array(z.string()).describe('Constraint list, must include at least one tradeoff constraint'),
        acts_options: z.array(z.object({
          acts: z.number().describe('Number of acts'),
          label: z.string().describe('Short label, e.g. "short", "medium", "long"'),
          rounds_total: z.string().describe('Round range, e.g. "24-36"'),
          endings_count: z.number().describe('Number of endings'),
        })).describe('2-3 length presets for the story'),
        default_acts: z.number().describe('Recommended default, must equal one of the acts values in acts_options'),
        world_slug: z.string().describe('kebab-case ASCII short slug for the world, used in the repo README catalog. 2-32 chars, [a-z0-9-]+. Example: "fate-zero", "three-kingdoms"'),
        world_name: z.string().describe('Human-readable world name (<=40 chars, any language/symbols allowed). Example: "Fate/Zero", "三国"'),
        summary: z.string().describe('Single-line story summary (<=80 chars, no newlines) combining world + main conflict or cast. Example: "第四次圣杯战争，七位御主与英灵的死斗"'),
      }),
      inputExamples: [{
        input: {
          genre: 'urban fantasy / psychological drama',
          tone: 'The fragile bond between a fallen knight and a child of prophecy — honor corroded by compromise, innocence weaponized by fate',
          constraints: [
            'Every choice must create differentiated affinity impact across characters',
            'The protagonist must face at least one irreversible betrayal per act',
            'No character may achieve their stated goal without sacrificing another',
          ],
          acts_options: [
            { acts: 3, label: 'short', rounds_total: '24-36', endings_count: 4 },
            { acts: 5, label: 'medium', rounds_total: '40-60', endings_count: 5 },
            { acts: 7, label: 'long', rounds_total: '56-84', endings_count: 6 },
          ],
          default_acts: 5,
          world_slug: 'fate-zero',
          world_name: 'Fate/Zero',
          summary: '第四次圣杯战争，七位御主与英灵的死斗',
        },
      }],
      execute: async ({ genre, tone, constraints, acts_options: rawActsOptions, default_acts, world_slug, world_name, summary }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_story_metadata' })
          const catalogErr = validateCatalogFields({ world_slug, world_name, summary })
          if (catalogErr) {
            onProgress({ type: 'tool_end', tool: 'set_story_metadata', result_summary: `error: ${catalogErr}` })
            return { error: catalogErr }
          }
          const acts_options: ActOption[] = rawActsOptions.map((o) => ({
            acts: o.acts,
            label_zh: o.label,
            rounds_total: o.rounds_total,
            endings_count: o.endings_count,
          }))
          builder.setMetadata({
            genre,
            tone,
            constraints,
            acts_options,
            default_acts,
            world_slug,
            world_name,
            summary,
          })
          const summaryMsg = `Metadata saved: ${acts_options.length} length options (default ${default_acts} acts); catalog: ${world_slug} / ${world_name}`
          onProgress({ type: 'tool_end', tool: 'set_story_metadata', result_summary: summaryMsg })
          return { ok: true, summary: summaryMsg }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'set_story_metadata', result_summary: `error: ${errMsg}` })
          return { error: errMsg }
        }
      },
    }),

    set_story_state: tool({
      description:
        'Lock in the story-level state vocabulary: 2 story-level shared affinity axes (bond is platform-fixed) + key event flags list.\n' +
        'Must be called after set_story_metadata and before any add_character. Called exactly once per export.\n' +
        '\n' +
        '## shared_axes_custom (exactly 2)\n' +
        'Choose 2 dimensions that best reflect the core relationship dynamics of this story. They become shared affinity axes for all characters.\n' +
        'Rules:\n' +
        '- Names must be snake_case (e.g. "trust" / "loyalty" / "rivalry" / "allegiance")\n' +
        '- "bond" is not allowed (platform-fixed)\n' +
        '- The two names must be different\n' +
        '- Recommend semantically orthogonal (e.g. trust + rivalry are independent, not trust + loyalty which correlate)\n' +
        '\n' +
        '## flags (5-8 key event markers)\n' +
        'Reverse-engineer flags from your expected endings: list the core branching points the story will go through. Each flag is a bool triggered to true in a scene.\n' +
        'E.g.: [met_johnny, accepted_arasaka, witnessed_truth, chose_rebellion, saber_vanished]\n' +
        '\n' +
        'Rules:\n' +
        '- Names must be snake_case, desc must be non-empty (used by Phase 1 LLM as trigger guidance)\n' +
        '- Initial value is almost always false (true for "preconditions that existed before the story began")\n' +
        '- Recommended 5-8; exceeding 8 triggers a warning but does not block\n' +
        '- **Phase 1 LLM cannot create new flags** — it can only reference flag names declared here. This step must enumerate all key markers the story will use',
      inputSchema: z.object({
        shared_axis_1: z.string().describe('First non-bond shared axis name, snake_case. E.g. "trust"'),
        shared_axis_2: z.string().describe('Second non-bond shared axis name, snake_case, different from the first. E.g. "rivalry"'),
        flags: z.array(z.object({
          name: z.string().describe('Flag name, snake_case. E.g. "met_johnny"'),
          desc: z.string().describe('Description of the flag trigger condition'),
          initial: z.boolean().describe('Initial value, almost always false'),
        })).describe('Key event flags (5-8 recommended)'),
      }),
      inputExamples: [{
        input: {
          shared_axis_1: 'trust',
          shared_axis_2: 'rivalry',
          flags: [
            { name: 'met_johnny', desc: 'Player first meets Johnny', initial: false },
            { name: 'chose_rebellion', desc: 'Player chooses the rebellion path', initial: false },
          ],
        },
      }],
      execute: async ({ shared_axis_1, shared_axis_2, flags }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_story_state' })
          const shared_axes_custom: [string, string] = [shared_axis_1, shared_axis_2]
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
      strict: true,
      description:
        'Lock in the **narrative style anchor** for this story: target_language / voice_anchor / forbidden_patterns / ip_specific.\n' +
        'Must be called after set_story_state and before any add_character. Called exactly once per export.\n' +
        'Purpose: eliminate translatese from all Phase 1/2 generated text.\n' +
        '\n' +
        '## Decision Principle\n' +
        'You have just read the world manifest and each character\'s style.md/identity.md. Now decide an actionable prose style for this story.\n' +
        'This is not "abstract aesthetics" — it\'s about identifying **concrete anti-patterns** for downstream LLMs to check against.\n' +
        '\n' +
        '## target_language\n' +
        'The target language for this export (zh / en / ja).\n' +
        '\n' +
        '## voice_anchor (at least 20 characters)\n' +
        'A single sentence describing the narrative voice of this story. **Must contain specific IP type keywords** (e.g. "Type-Moon visual novel official translation style", "classical Chinese chapter novel vernacular", "cyberpunk noir Hong Kong vernacular", "modern urban colloquial").\n' +
        'Bad examples: "fantasy novel", "should be restrained, solemn" (too abstract, not actionable)\n' +
        'Good examples: "Type-Moon Japanese visual novel official translation style. Short sentences, restrained narration, preserving Japanese pacing without Japanese grammar"\n' +
        '\n' +
        '## forbidden_patterns (at least 3)\n' +
        'Pick entries most relevant to this story from the "universal translatese anti-pattern library" below; you may rewrite bad/good content to fit this story\'s worldview (keep id and reason).\n' +
        'You may also add story-specific anti-patterns (write your own id/bad/good/reason).\n' +
        'Each entry\'s bad and good must be real comparable prose paragraphs, not abstract descriptions.\n' +
        '\n' +
        '## ip_specific (at least 3, must be concrete)\n' +
        'Rules written specifically for this story/IP. **Must be concrete, actionable rules**, not abstract directions.\n' +
        'Must cover at least: 1 terminology preservation rule / 1 honorific or title rule / 1 metaphor or imagery pool constraint\n' +
        '\n' +
        '## character_voice_summary (optional)\n' +
        'When a character\'s style.md contains > 30% non-native-language content (e.g. Japanese quotes in FSN characters for a Chinese export), provide a restrained summary (≤ 200 chars) in the target language.\n' +
        'The summary should paraphrase 1-2 iconic lines as voice anchors.\n' +
        'Omit this field for characters whose style.md is already in the target language.\n' +
        '\n' +
        '## Universal Translatese Anti-Pattern Library (IP-agnostic, as selection pool and inspiration for forbidden_patterns)\n' +
        '\n' +
        formatPatternsForToolDescription(exportLanguage),
      inputSchema: z.object({
        target_language: z
          .enum(['zh', 'en', 'ja'])
          .describe('Target language: "zh", "en", or "ja"'),
        voice_anchor: z
          .string()
          .min(20)
          .describe('One sentence describing narrative voice, must contain specific IP type keywords'),
        forbidden_patterns: z.array(z.object({
          id: z.string().describe('snake_case identifier, e.g. "degree_clause"'),
          bad: z.string().describe('Bad example: a prose paragraph with translatese'),
          good: z.string().describe('Good example: the same content in natural prose'),
          reason: z.string().describe('Why the bad example is translatese'),
        })).min(3).describe('At least 3 anti-translatese pattern entries'),
        ip_specific: z.array(z.string()).min(3).describe('At least 3 concrete story/IP-specific rules'),
        voice_summaries: z.array(z.object({
          character_name: z.string(),
          summary: z.string().describe('Restrained summary in target language, ≤ 200 chars, with 1-2 iconic lines'),
        })).optional().describe('Voice summaries for characters whose style.md has > 30% non-target-language content'),
      }),
      inputExamples: [{
        input: {
          target_language: 'zh',
          voice_anchor: 'Type-Moon visual novel official Chinese translation style. Short sentences, restrained narration, preserving Japanese pacing without Japanese grammar',
          forbidden_patterns: [
            { id: 'degree_clause', bad: 'She tightened her grip to the point where her nails dug into your clothes.', good: 'She tightened her grip. Her nails dug into your clothes.', reason: 'Literal translation of English "to the degree that" clause' },
            { id: 'possessive_chain', bad: 'My Berserker. My Heracles. My... only friend.', good: 'Berserker. Heracles. ...my only friend.', reason: 'English possessive repetition is unnatural in Chinese' },
            { id: 'abstract_noun', bad: 'Her voice had no inflection when she said "friend."', good: 'Her voice was flat as a lake when she said "friend."', reason: 'Chinese prefers concrete imagery over abstract negation' },
          ],
          ip_specific: [
            'Noble Phantasm/Servant/Master must be kept in English, never translated',
            'Sakura → Ms. Sakura (not "Little Sakura"); Shirou → Emiya',
            'Metaphors must draw from moon/snow/lantern/stone-steps imagery pool, not Western steel or glass',
          ],
        },
      }],
      execute: async ({
        target_language,
        voice_anchor,
        forbidden_patterns,
        ip_specific,
        voice_summaries,
      }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'set_prose_style' })
          // Build character_voice_summary from structured array
          let character_voice_summary: Record<string, string> | undefined
          if (voice_summaries && voice_summaries.length > 0) {
            character_voice_summary = {}
            for (const vs of voice_summaries) {
              character_voice_summary[vs.character_name] = vs.summary
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

    select_route_characters: tool({
      description:
        'Select focus characters for route branching. Called after all add_character calls.\n' +
        'Agent should analyze character data and recommend 2-3 characters with interesting\n' +
        'conflict/growth potential. User confirms the pre-selected list.\n' +
        'The selected characters determine route branching: Phase 1 generates a gate scene\n' +
        'with affinity-based routing conditions and per-route scene/ending branches.',
      inputSchema: z.object({
        characters: z.array(z.object({
          slug: z.string().describe('Character ASCII slug (matches souls/{slug}/ directory)'),
          name: z.string().describe('Character display name'),
          reason: z.string().describe('Why this character is a good route focus (conflict/growth potential)'),
        })).min(2).max(5).describe('2-5 characters selected as route focus'),
      }),
      inputExamples: [{
        input: {
          characters: [
            { slug: 'saber', name: 'Saber', reason: 'Central conflict between duty and personal desire creates a natural branching point' },
            { slug: 'rin', name: 'Rin', reason: 'Alliance vs rivalry dynamic with protagonist offers meaningful route divergence' },
          ],
        },
      }],
      execute: async ({ characters: routeChars }) => {
        try {
          onProgress({ type: 'tool_start', tool: 'select_route_characters' })
          const routeCharacters: RouteCharacter[] = routeChars.map((rc) => ({
            slug: rc.slug,
            name: rc.name,
            reason: rc.reason,
          }))
          builder.setRouteCharacters(routeCharacters)
          const summary = `Route characters selected: ${routeCharacters.map((rc) => rc.name).join(', ')}`
          onProgress({ type: 'tool_end', tool: 'select_route_characters', result_summary: summary })
          return { ok: true, summary }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          onProgress({ type: 'tool_end', tool: 'select_route_characters', result_summary: `error: ${errMsg}` })
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
  const tools = makeStorySetupTools(builder, onProgress, askUser, completionTracker, preSelected.exportLanguage)

  const STORY_SETUP_STEP_CAP = 8 // 3 normal + 5 buffer

  const agent = new ToolLoopAgent({
    model,
    instructions: STORY_SETUP_PROMPT,
    tools,
    toolChoice: 'auto',
    temperature: 0,
    providerOptions: providerOpts,
    stopWhen: [stepCountIs(STORY_SETUP_STEP_CAP), () => completionTracker.proseStyleSet],
    experimental_repairToolCall: createArrayArgRepair(),
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
        ? `${result.llmError}.`
        : result.aborted
          ? 'Story Setup timed out (90s no response).'
          : `Story Setup did not complete within ${result.stepCount} steps (set_prose_style was not called).`
      const errorMsg = `Story setup failed: ${detail}\nSee detailed log: ${agentLog.filePath}`
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
