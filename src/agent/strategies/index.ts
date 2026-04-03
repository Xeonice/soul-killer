import type { TargetClassification } from '../soul-capture-agent.js'
import type { SearchStrategy } from './types.js'
import { digitalConstructStrategy } from './digital-construct.js'
import { publicEntityStrategy } from './public-entity.js'
import { historicalRecordStrategy } from './historical-record.js'

const STRATEGY_MAP: Record<Exclude<TargetClassification, 'UNKNOWN_ENTITY'>, SearchStrategy> = {
  DIGITAL_CONSTRUCT: digitalConstructStrategy,
  PUBLIC_ENTITY: publicEntityStrategy,
  HISTORICAL_RECORD: historicalRecordStrategy,
}

export function getStrategyForClassification(
  classification: Exclude<TargetClassification, 'UNKNOWN_ENTITY'>,
): SearchStrategy {
  return STRATEGY_MAP[classification]
}

export type { SearchStrategy, SearchExecutors } from './types.js'
