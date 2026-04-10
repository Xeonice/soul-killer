import fs from 'node:fs'
import path from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import type { DimensionPlan } from '../dimension-framework.js'
import type { SearchResult } from '../../search/tavily-search.js'
import type { AgentLogger } from '../../utils/agent-logger.js'

export function readDimensionCache(sessionDir: string, dimensionName: string): SearchResult[] {
  const cacheFile = path.join(sessionDir, `${dimensionName}.json`)
  if (!fs.existsSync(cacheFile)) return []
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    return data.results ?? []
  } catch {
    return []
  }
}

/** Per-article score from quality evaluation */
export interface ArticleScore {
  index: number
  title: string
  url: string
  score: number  // 1-5
  reason: string
  keep: boolean  // score >= 3
}

/** Per-dimension scoring summary */
export interface DimensionScore {
  dimension: string
  totalArticles: number
  scores: ArticleScore[]
  qualifiedCount: number
  minRequired: number
  sufficient: boolean
}

/**
 * Creates evaluateDimension tool.
 * Scores are pre-computed by the code layer (scoreDimensionsParallel).
 * This tool just returns the pre-computed scores to the agent.
 */
export function createEvaluateDimensionTool(
  dimensionPlan: DimensionPlan,
  dimensionScores: Map<string, DimensionScore>,
  agentLog?: AgentLogger,
) {
  return tool({
    description: 'View the quality evaluation results for a dimension. Shows per-article scores and whether the dimension has sufficient qualified articles. Scores are pre-computed.',
    inputSchema: z.object({
      dimensionName: z.string().describe('The dimension name to check'),
    }),
    execute: async ({ dimensionName }) => {
      const dim = dimensionPlan.dimensions.find((d) => d.name === dimensionName)
      const score = dimensionScores.get(dimensionName)

      if (!score) {
        agentLog?.toolInternal(`evaluateDimension: ${dimensionName} → no scores found`)
        return {
          dimensionName,
          description: dim?.description ?? 'unknown',
          error: `No scores found for dimension "${dimensionName}"`,
        }
      }

      agentLog?.toolInternal(`evaluateDimension: ${dimensionName} → ${score.qualifiedCount}/${score.minRequired} qualified, sufficient=${score.sufficient}`)

      return {
        dimensionName,
        description: dim?.description ?? 'unknown',
        priority: dim?.priority ?? 'unknown',
        qualifiedCount: score.qualifiedCount,
        minRequired: score.minRequired,
        sufficient: score.sufficient,
        totalArticles: score.totalArticles,
        scores: score.scores.map((s) => ({
          index: s.index,
          title: s.title,
          score: s.score,
          reason: s.reason,
          keep: s.keep,
        })),
      }
    },
  })
}
