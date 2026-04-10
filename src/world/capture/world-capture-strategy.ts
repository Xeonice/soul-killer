import type { CaptureStrategy } from '../../infra/agent/capture-strategy.js'
import type { DimensionPlan } from '../../infra/agent/dimension-framework.js'
import { ALL_WORLD_DIMENSIONS, generateWorldSearchPlan, analyzeWorldCoverage } from './world-dimensions.js'

export type { WorldClassification } from './world-dimensions.js'

const WORLD_SYSTEM_PROMPT = `You are a research quality evaluator. Search results are organized by dimension in a cache. Your job is to evaluate article quality against criteria and determine if each dimension has sufficient data.

## Workflow

For EACH dimension in the search summary:
1. Call evaluateDimension to preview the articles.
2. Judge each article against the dimension's quality criteria.
3. If qualified articles < minArticles, call supplementSearch to get more data (max 2 per dimension).
4. Move to the next dimension.

After ALL dimensions are evaluated, call reportFindings with classification, summary, and dimensionStatus.

## Rules
- ALWAYS use tools.
- Process dimensions ONE BY ONE.
- Do NOT fabricate information.
- Do NOT skip dimensions.
- Your LAST tool call MUST be reportFindings. NEVER end without calling it.
- Text output alone does NOT count as completion — only a reportFindings tool call finishes the task.`

export class WorldCaptureStrategy implements CaptureStrategy {
  type = 'world' as const
  systemPrompt = WORLD_SYSTEM_PROMPT
  maxSteps = 35
  collectionStartStep = 3

  buildSystemPrompt(plan: DimensionPlan): string {
    const dimList = plan.dimensions.map((d, i) => {
      const tag = ''
      const criteria = d.qualityCriteria?.length ? `\n   Quality criteria: ${d.qualityCriteria.join(', ')}` : ''
      const minArt = d.minArticles ? `\n   Minimum articles: ${d.minArticles}` : ''
      return `${i + 1}. **${d.name}** (${d.priority.toUpperCase()})${tag} — ${d.description}${criteria}${minArt}`
    }).join('\n')

    const requiredCount = plan.dimensions.filter((d) => d.priority === 'required').length
    const minRequired = Math.min(requiredCount, 2)

    return WORLD_SYSTEM_PROMPT + `

## World Dimensions

A complete world profile requires data across these dimensions:

${dimList}

You need at least ${Math.min(plan.dimensions.length, 4)} dimensions covered, with at least ${minRequired} of the REQUIRED dimensions, before you can report.

When all dimensions are covered, IMMEDIATELY call reportFindings. Do NOT output a text summary instead — call the tool.`
  }

  buildUserMessage(name: string, hint?: string): string {
    return [
      `Research and build a comprehensive world profile of: "${name}"`,
      hint ? `Hint: ${hint}` : '',
    ].filter(Boolean).join('\n')
  }

  getClassificationLabels(): Record<string, string> {
    return {
      FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE',
      REAL_SETTING: 'REAL SETTING',
      UNKNOWN_SETTING: 'UNKNOWN SETTING',
    }
  }

  getClassificationValues(): string[] {
    return ['FICTIONAL_UNIVERSE', 'REAL_SETTING', 'UNKNOWN_SETTING']
  }

  generateSearchPlan(classification: string, englishName: string, localName: string, origin: string): unknown {
    return generateWorldSearchPlan(classification as any, englishName, localName, origin)
  }

  analyzeCoverage(extractions: { content: string }[]): unknown {
    return analyzeWorldCoverage(extractions)
  }

  getDimensionValues(): string[] {
    return [...ALL_WORLD_DIMENSIONS]
  }
}
