// ========== Unified Dimension Framework ==========
// Shared by Soul and World capture strategies.
// Base dimensions are fixed per type; extensions are added by Planning Agent.

export type DimensionPriority = 'required' | 'important' | 'supplementary'
export type DimensionSource = 'planned'
export type DistillScope = 'background' | 'rule' | 'lore' | 'atmosphere'

export interface DimensionDef {
  /** kebab-case identifier: "geography", "military-strategy" */
  name: string
  /** Human-readable name: "地理", "军事战略" */
  display: string
  /** Description for LLM: what this dimension covers */
  description: string
  /** Priority level */
  priority: DimensionPriority
  /** Whether this is a base or extension dimension */
  source: DimensionSource
  /** Keywords for coverage detection (mixed CJK/English) */
  signals: string[]
  /** Search queries for this dimension */
  queries: string[]
  /** Distill target scope */
  distillTarget: DistillScope
  /** Quality criteria for articles — what makes an article "good enough" for this dimension */
  qualityCriteria: string[]
  /** Minimum number of qualified articles needed for this dimension */
  minArticles: number
}

export interface DimensionPlan {
  classification: string
  englishName: string
  localName: string
  origin: string
  dimensions: DimensionDef[]
}

/**
 * Convert signal keywords to RegExp patterns for coverage detection.
 * CJK keywords: direct match (no word boundary).
 * English keywords: word boundary match, case insensitive.
 */
export function signalsToRegex(signals: string[]): RegExp[] {
  const CJK_RE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/
  const cjk = signals.filter((s) => CJK_RE.test(s))
  const en = signals.filter((s) => !CJK_RE.test(s))

  const patterns: RegExp[] = []
  if (cjk.length) patterns.push(new RegExp(cjk.join('|')))
  if (en.length) patterns.push(new RegExp(`\\b(?:${en.join('|')})\\b`, 'i'))
  return patterns
}

// Base dimensions are imported at module level — no circular dep risk since
// soul-dimensions.ts and world-dimensions.ts only import types from this file.
let _soulDims: DimensionDef[] | undefined
let _worldDims: DimensionDef[] | undefined

/**
 * Get base dimensions for the given capture type.
 */
export async function getBaseDimensions(type: 'soul' | 'world'): Promise<DimensionDef[]> {
  if (type === 'soul') {
    if (!_soulDims) {
      const mod = await import('../strategy/soul-dimensions.js')
      _soulDims = mod.SOUL_DIMENSION_TEMPLATES
    }
    return _soulDims
  } else {
    if (!_worldDims) {
      const mod = await import('../strategy/world-dimensions.js')
      _worldDims = mod.WORLD_DIMENSION_TEMPLATES
    }
    return _worldDims
  }
}

/**
 * Build a DimensionPlan from base dimensions only (fallback for old manifests).
 */
export async function basePlan(type: 'soul' | 'world', classification: string, englishName: string, localName: string, origin: string): Promise<DimensionPlan> {
  return {
    classification,
    englishName,
    localName,
    origin,
    dimensions: await getBaseDimensions(type),
  }
}
