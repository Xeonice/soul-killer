import type { SoulkillerConfig } from '../../config/schema.js'
import type { AgentLogger } from '../../utils/agent-logger.js'
import type { DimensionPlan } from '../planning/dimension-framework.js'

// ========== Shared Types ==========

export type AgentPhase = 'initiating' | 'searching' | 'classifying' | 'analyzing' | 'filtering' | 'complete' | 'unknown'

export interface SearchPlanDimension {
  dimension: string
  priority: string
  queries: string[]
}

export type CaptureProgress =
  | { type: 'phase'; phase: AgentPhase }
  | { type: 'tool_call'; tool: string; query: string }
  | { type: 'tool_result'; tool: string; resultCount: number }
  | { type: 'classification'; classification: string; origin?: string }
  | { type: 'search_plan'; dimensions: SearchPlanDimension[] }
  | { type: 'filter_progress'; kept: number; total: number }
  | { type: 'chunks_extracted'; count: number }

export interface CaptureResult {
  classification: string
  origin?: string
  /** Path to dimension cache directory */
  sessionDir?: string
  /** One paragraph summary of the target */
  summary?: string
  elapsedMs: number
  agentLog?: AgentLogger
  /** Dimension plan from Planning Agent (for manifest persistence) */
  dimensionPlan?: DimensionPlan
  /** Per-dimension quality scores (qualified article counts) */
  dimensionScores?: Record<string, { qualifiedCount: number; minRequired: number; sufficient: boolean }>
}

export type OnProgress = (progress: CaptureProgress) => void

// ========== Strategy Interface ==========

export interface CaptureStrategy {
  /** 'soul' or 'world' */
  type: 'soul' | 'world'

  /** System prompt for the agent LLM (static fallback) */
  systemPrompt: string

  /** Build system prompt with dynamic dimension descriptions from Planning Agent */
  buildSystemPrompt?(plan: DimensionPlan): string

  /** Max steps before forcing reportFindings */
  maxSteps: number

  /** Step number where collection phase begins (for UI phase tracking) */
  collectionStartStep: number

  /** Build the user message from target name and optional hint */
  buildUserMessage(name: string, hint?: string): string

  /** Get display labels for each classification value */
  getClassificationLabels(): Record<string, string>

  /** Classification enum values for the reportFindings tool schema */
  getClassificationValues(): string[]

  /** Dimension enum values for the reportFindings tool schema */
  getDimensionValues(): string[]

  /** Generate a search plan from parsed summary info */
  generateSearchPlan(classification: string, englishName: string, localName: string, origin: string, tags?: { domain?: string[] }): unknown

  /** Analyze coverage of extractions */
  analyzeCoverage(extractions: { content: string }[]): unknown
}
