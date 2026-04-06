import type { SoulkillerConfig } from '../config/schema.js'
import { runCaptureAgent } from './capture-agent.js'
import { SoulCaptureStrategy } from './soul-capture-strategy.js'
import type { CaptureResult, OnProgress } from './capture-strategy.js'

// Re-export types for backward compatibility
export type { CaptureResult, OnProgress }
export type { TargetClassification } from './soul-capture-strategy.js'
export type { SearchPlanDimension as SearchPlanDimension, CaptureProgress } from './capture-strategy.js'

/**
 * Capture soul data via AI agent search.
 * Delegates to the generic capture agent with Soul-specific strategy.
 */
export async function captureSoul(
  name: string,
  config: SoulkillerConfig,
  onProgress?: OnProgress,
  hint?: string,
): Promise<CaptureResult> {
  return runCaptureAgent(new SoulCaptureStrategy(), name, config, onProgress, hint)
}
