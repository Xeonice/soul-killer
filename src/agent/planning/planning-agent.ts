import { generateText, type LanguageModel } from 'ai'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import type { DimensionDef, DimensionPlan } from './dimension-framework.js'
import { SOUL_DIMENSION_TEMPLATES } from '../strategy/soul-dimensions.js'
import { WORLD_DIMENSION_TEMPLATES } from '../strategy/world-dimensions.js'
import { logger } from '../../utils/logger.js'

const MIN_TOTAL_DIMENSIONS = 6
const MAX_TOTAL_DIMENSIONS = 15

interface PlanningResult {
  dimensions: Array<{
    name: string
    display: string
    description: string
    priority: 'required' | 'important' | 'supplementary'
    signals: string[]
    queries: string[]
    qualityCriteria: string[]
    minArticles: number
    distillTarget?: string
  }>
}

interface SearchResult {
  title: string
  url: string
  content: string
}

function buildClassificationStrategy(classification: string): string {
  if (classification === 'REAL_SETTING') {
    return `### Classification: REAL_SETTING — Strict In-World Qualifiers Required

This world is set in the real world (or a close variant). Search engines will heavily mix production meta-info with in-story facts.

MANDATORY for every query:
- Append qualifiers like "故事内"/"剧情"/"设定"/"in-story"/"story setting" to disambiguate from meta content
- Prefer character names + event descriptions over work title alone
- Every dimension's qualityCriteria MUST include a meta-exclusion criterion:
  "文章描述的是故事世界内部的事实，不是作品的发售/制作/改编/播出信息"

Example bad query:  "White Album 2 历史 时间线"         → returns release dates
Example good query: "白色相簿2 剧情 时间线 故事内事件"    → returns story events
Example good query: "冬马かずさ 北原春希 出来事"          → returns character events`
  }

  if (classification === 'FICTIONAL_UNIVERSE') {
    return `### Classification: FICTIONAL_UNIVERSE — Standard Queries

This is a fictional universe with unique world-building. Standard queries will naturally return in-world content. No special qualifiers needed, but still ensure qualityCriteria includes a meta-exclusion criterion.`
  }

  // UNKNOWN_SETTING or anything else → conservative path
  return `### Classification: UNKNOWN_SETTING — Conservative Strategy

World type is uncertain. Apply the same strict in-world qualifiers as REAL_SETTING:
- Append "故事内"/"剧情"/"设定"/"in-story" to queries
- Prefer character names + event descriptions over work title alone
- Every dimension's qualityCriteria MUST include a meta-exclusion criterion`
}

function buildPlanningPrompt(
  type: 'soul' | 'world',
  baseDims: DimensionDef[],
  name: string,
  hint: string | undefined,
  preSearchResults: SearchResult[],
  classification: string,
): string {
  const typeLabel = type === 'soul' ? 'person/character' : 'world/setting'
  const dimList = baseDims.map((d) =>
    `- **${d.name}** (${d.priority}): ${d.description}`,
  ).join('\n')

  const searchContext = preSearchResults.slice(0, 8).map((r, i) =>
    `${i + 1}. [${r.title}](${r.url})\n   ${r.content.slice(0, 200)}`,
  ).join('\n')

  const worldMetaExclusion = type === 'world' ? `
## Search Target: In-World Information ONLY

Your search queries must target **facts that exist INSIDE the fictional world** — geography, events, characters, social structures, customs, timeline, etc. as they appear in the story's narrative.

You MUST EXCLUDE queries that would return information ABOUT the work itself:
- Release dates, sales figures, platform ports, remasters (発売, 发售, release, launch)
- Anime/manga/drama-CD adaptations, broadcast schedules (放送, 配信, aired, broadcast)
- Voice actors, staff, production companies, studios (声优, CV, 制作, スタッフ)
- Reviews, ratings, awards, merchandise
- Real-world reception, fan community, cultural impact

If the reconnaissance articles are dominated by production/release info, your queries need STRONGER in-world qualifiers.

${buildClassificationStrategy(classification)}
` : ''

  return `You are a research planning specialist. Based on the reconnaissance information below, create a customized dimension plan for researching the ${typeLabel} "${name}".
${worldMetaExclusion}
## Dimension Templates (reference — select what fits)

${dimList}

These are TEMPLATES, not requirements. For the target above:

1. **Select** which dimensions are relevant — drop any that don't fit this target
2. **Adjust** descriptions and qualityCriteria to match the specific target
3. **Add** new dimensions if the templates don't cover important aspects
4. Output the COMPLETE final dimension list (${MIN_TOTAL_DIMENSIONS}-${MAX_TOTAL_DIMENSIONS} dimensions total)

Core dimensions like history, geography, and figures are usually relevant — but drop them if they truly don't apply.

## Rules

- Each dimension must have: name (kebab-case English), display (human-readable name), description, priority, signals (5-10 keywords in mixed Chinese/English for coverage detection), queries (4-8 MULTILINGUAL search queries), qualityCriteria (2+ criteria), minArticles (2-3).
- Total dimensions must be ${MIN_TOTAL_DIMENSIONS}-${MAX_TOTAL_DIMENSIONS}.
- distillTarget must be one of: background, rule, lore, atmosphere.

## Search Query Rules (CRITICAL)

### Multilingual Coverage
Each dimension MUST have queries in MULTIPLE languages to maximize information quality:
- Chinese (中文): for Chinese-language sources, Baidu Baike, Zhihu, etc.
- English: for Wikipedia EN, academic articles, analysis blogs
- Japanese (日本語): for Japanese-language sources when relevant (anime, manga, games, Asian history)

Example for a dimension with 6 queries:
- "曹操 军事策略" (Chinese)
- "Cao Cao military strategy" (English)
- "曹操 軍事戦略" (Japanese)
- "三国 官渡之战" (Chinese)
- "Battle of Guandu tactics" (English)
- "官渡の戦い 戦術" (Japanese)

### One Entity Per Query
Each query MUST target ONE entity + ONE aspect. Do NOT batch multiple entities.

- WRONG: "三国 曹魏 蜀汉 东吴 势力" (3 factions in one query)
- RIGHT: "曹魏 政治制度", "Cao Wei political system", "蜀汉 経済" (one faction per query, multilingual)

## Target Information

- **Name**: ${name}
- **Classification**: ${classification}
${hint ? `- **Hint**: ${hint}` : ''}

IMPORTANT: When generating queries, you MUST include the target's name in ALL relevant languages. For example, if the target is "三国演义", generate queries using:
- Chinese: "三国演义"
- English: "Romance of the Three Kingdoms"
- Japanese: "三国志演義"
Derive the English and Japanese names from the reconnaissance results below. Each dimension should have queries in at least Chinese AND English.

## Reconnaissance Results

${searchContext || 'No search results available.'}

## Output Format

Respond with a JSON object only, no other text:
{
  "dimensions": [
    {
      "name": "history",
      "display": "历史",
      "description": "Key events and timeline",
      "priority": "required",
      "signals": ["history", "timeline", "历史"],
      "queries": ["${name} history", "${name} timeline"],
      "qualityCriteria": ["包含具体时间和事件", "有因果关系分析"${type === 'world' ? ', "描述故事世界内部事实，排除作品制作/发行/改编信息"' : ''}],
      "minArticles": 3,
      "distillTarget": "background"
    }
  ]
}`
}

function applyPlan(result: PlanningResult): DimensionDef[] {
  // The Planning Agent returns the COMPLETE dimension list directly
  const dimensions: DimensionDef[] = result.dimensions.slice(0, MAX_TOTAL_DIMENSIONS).map((dim) => ({
    name: dim.name,
    display: dim.display,
    description: dim.description,
    priority: dim.priority,
    source: 'planned' as const,
    signals: Array.isArray(dim.signals) ? dim.signals : [],
    queries: Array.isArray(dim.queries) ? dim.queries : [],
    distillTarget: (['background', 'rule', 'lore', 'atmosphere'].includes(dim.distillTarget ?? '') ? dim.distillTarget : 'lore') as any,
    qualityCriteria: Array.isArray(dim.qualityCriteria) && dim.qualityCriteria.length > 0
      ? dim.qualityCriteria
      : ['包含与该维度直接相关的具体信息', '有深度分析而非表面描述'],
    minArticles: typeof dim.minArticles === 'number' ? dim.minArticles : (dim.priority === 'required' ? 3 : 2),
  }))

  return dimensions
}

function validate(result: PlanningResult): void {
  if (!result.dimensions || !Array.isArray(result.dimensions)) {
    throw new Error('Planning Agent returned no dimensions array')
  }

  if (result.dimensions.length < MIN_TOTAL_DIMENSIONS) {
    throw new Error(`Planning Agent returned ${result.dimensions.length} dimensions (min ${MIN_TOTAL_DIMENSIONS})`)
  }

  if (result.dimensions.length > MAX_TOTAL_DIMENSIONS) {
    throw new Error(`Planning Agent returned ${result.dimensions.length} dimensions (max ${MAX_TOTAL_DIMENSIONS})`)
  }

  // Check each dimension has required fields
  for (const dim of result.dimensions) {
    if (!dim.name || !dim.display || !dim.description) {
      throw new Error(`Planning Agent dimension "${dim.name}" missing required fields`)
    }
    if (!dim.signals?.length) {
      throw new Error(`Planning Agent dimension "${dim.name}" has no signals`)
    }
    if (!dim.queries?.length) {
      throw new Error(`Planning Agent dimension "${dim.name}" has no queries`)
    }
  }
}

const PLANNING_TIMEOUT_MS = 90_000

/**
 * Run the Planning Agent to generate a customized dimension plan.
 * This is a single LLM call that runs before the capture agent.
 * Throws on failure — caller should propagate to UI for retry.
 */
export async function runPlanningAgent(
  model: LanguageModel,
  type: 'soul' | 'world',
  name: string,
  hint: string | undefined,
  preSearchResults: SearchResult[],
  classification: string,
  localName?: string,
  origin?: string,
  providerOptions?: SharedV3ProviderOptions,
): Promise<DimensionPlan> {
  const templateDims = type === 'soul' ? SOUL_DIMENSION_TEMPLATES : WORLD_DIMENSION_TEMPLATES
  const prompt = buildPlanningPrompt(type, templateDims, name, hint, preSearchResults, classification)

  // Surface the configured model id in error messages so users can tell
  // immediately which provider/variant is misbehaving when the watchdog fires.
  const modelId = (model as { modelId?: string }).modelId ?? 'unknown'

  logger.info(`[planning-agent] Running for ${type}:${name} (${classification})`)

  const abortController = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    logger.warn(`[planning-agent] Timeout after ${PLANNING_TIMEOUT_MS}ms — aborting (model=${modelId})`)
    timedOut = true
    abortController.abort()
  }, PLANNING_TIMEOUT_MS)

  let text: string
  try {
    const result = await generateText({
      model,
      system: prompt,
      prompt: `Generate the dimension plan for "${name}".`,
      temperature: 0,
      abortSignal: abortController.signal,
      providerOptions,
    })
    text = result.text
  } catch (err) {
    // If the watchdog fired, rewrite the generic "operation was aborted"
    // message into a concrete diagnostic the user can act on — naming the
    // model and pointing at structured-output stability as the likely cause.
    if (timedOut) {
      throw new Error(
        `Planning Agent 超时（${PLANNING_TIMEOUT_MS / 1000}s 无响应）：` +
          `模型 ${modelId} 未在时限内返回结构化 JSON。` +
          `建议换一个对 structured output 更稳定的模型（例如 deepseek/deepseek-v3.2、qwen/qwen3.6-plus 或 anthropic/claude-sonnet-4.5）。`
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  logger.info(`[planning-agent] Response length: ${text.length}`)

  // Strip markdown code blocks if present (e.g. ```json ... ```)
  const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()

  let result: PlanningResult
  try {
    result = JSON.parse(jsonText) as PlanningResult
  } catch (err) {
    throw new Error(`Planning Agent returned invalid JSON: ${String(err)}. Raw: ${text.slice(0, 300)}`)
  }

  if (!result.dimensions) result.dimensions = []

  logger.info(`[planning-agent] Result: ${result.dimensions.length} dimensions`)

  validate(result)

  const effectiveLocalName = localName || name
  const dimensions = applyPlan(result)

  logger.info(`[planning-agent] Plan: ${dimensions.length} dimensions`)

  return {
    classification,
    englishName: name,
    localName: effectiveLocalName,
    origin: origin ?? '',
    dimensions,
  }
}
