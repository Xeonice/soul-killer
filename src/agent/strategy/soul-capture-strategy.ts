import type { CaptureStrategy } from './capture-strategy.js'
import type { DimensionPlan } from '../planning/dimension-framework.js'
import { ALL_DIMENSIONS, generateSearchPlan, analyzeCoverage } from './soul-dimensions.js'

export type { TargetClassification } from './soul-dimensions.js'

const SOUL_SYSTEM_PROMPT = `You are a research quality evaluator. Search results are organized by dimension in a cache. Your job is to evaluate article quality against criteria and determine if each dimension has sufficient data.

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

export class SoulCaptureStrategy implements CaptureStrategy {
  type = 'soul' as const
  systemPrompt = SOUL_SYSTEM_PROMPT
  maxSteps = 30
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

    return SOUL_SYSTEM_PROMPT + `

## Profile Dimensions

A complete profile requires data across these dimensions:

${dimList}

You need at least ${Math.min(plan.dimensions.length, 4)} dimensions covered, with at least ${minRequired} of the REQUIRED dimensions, before you can report.

When all dimensions are covered, IMMEDIATELY call reportFindings. Do NOT output a text summary instead — call the tool.`
  }

  buildUserMessage(name: string, hint?: string): string {
    return [
      `Research and build a comprehensive profile of: "${name}"`,
      hint ? `Hint: ${hint}` : '',
    ].filter(Boolean).join('\n')
  }

  getClassificationLabels(): Record<string, string> {
    return {
      DIGITAL_CONSTRUCT: 'DIGITAL CONSTRUCT',
      PUBLIC_ENTITY: 'PUBLIC ENTITY',
      HISTORICAL_RECORD: 'HISTORICAL RECORD',
      UNKNOWN_ENTITY: 'UNKNOWN ENTITY',
    }
  }

  getClassificationValues(): string[] {
    return ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY']
  }

  generateSearchPlan(classification: string, englishName: string, localName: string, origin: string, tags?: { domain?: string[] }): unknown {
    return generateSearchPlan(classification as any, englishName, localName, origin, tags)
  }

  analyzeCoverage(extractions: { content: string }[]): unknown {
    return analyzeCoverage(extractions)
  }

  getDimensionValues(): string[] {
    return [...ALL_DIMENSIONS]
  }
}
