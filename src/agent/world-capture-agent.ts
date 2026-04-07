import type { SoulkillerConfig } from '../config/schema.js'
import { runCaptureAgent } from './capture-agent.js'
import { WorldCaptureStrategy } from './strategy/world-capture-strategy.js'
import type { CaptureResult, OnProgress } from './strategy/capture-strategy.js'

export type { CaptureResult, OnProgress }
export type { WorldClassification } from './strategy/world-capture-strategy.js'

/**
 * Capture world data via AI agent search.
 * Delegates to the generic capture agent with World-specific strategy.
 */
export async function captureWorld(
  name: string,
  config: SoulkillerConfig,
  onProgress?: OnProgress,
  hint?: string,
): Promise<CaptureResult> {
  return runCaptureAgent(new WorldCaptureStrategy(), name, config, onProgress, hint)
}
