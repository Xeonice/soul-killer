import type { SoulkillerConfig } from '../../config/schema.js'
import type { CaptureStrategy } from '../strategy/capture-strategy.js'
import type { DimensionPlan } from '../planning/dimension-framework.js'
import type { AgentLogger } from '../../utils/agent-logger.js'
import { createEvaluateDimensionTool, type DimensionScore } from './evaluate-dimension.js'
import { createSupplementSearchTool } from './supplement-search.js'
import { createReportFindingsTool } from './report-findings.js'

/**
 * Creates the complete tool set for the quality evaluation agent.
 * Tools: evaluateDimension, supplementSearch, reportFindings.
 */
export function createEvaluationTools(
  config: SoulkillerConfig,
  options: {
    agentLog?: AgentLogger
    strategy?: CaptureStrategy
    dimensionPlan: DimensionPlan
    dimensionScores?: Map<string, DimensionScore>
    sessionDir: string
    searxngAvailable?: boolean
  },
) {
  const { agentLog, strategy, dimensionPlan, sessionDir } = options
  const dimensionScores = options.dimensionScores ?? new Map()

  const dimensionValues = dimensionPlan.dimensions.map((d) => d.name)
  const classificationValues = strategy?.getClassificationValues() ?? ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD', 'UNKNOWN_ENTITY']

  const tools = {
    evaluateDimension: createEvaluateDimensionTool(dimensionPlan, dimensionScores, agentLog),
    supplementSearch: createSupplementSearchTool(config, sessionDir, {
      searxngAvailable: options.searxngAvailable,
      agentLog,
    }),
    reportFindings: createReportFindingsTool(classificationValues, dimensionValues),
  }

  return { tools }
}
