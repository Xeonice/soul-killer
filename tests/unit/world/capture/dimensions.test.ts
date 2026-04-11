import { describe, it, expect } from 'vitest'
import {
  WORLD_DIMENSIONS,
  ALL_WORLD_DIMENSIONS,
  REQUIRED_WORLD_DIMENSIONS,
  WORLD_DIMENSION_SIGNALS,
  generateWorldSearchPlan,
  analyzeWorldCoverage,
  type WorldDimension,
} from '../../../../src/world/capture/world-dimensions.js'

describe('WORLD_DIMENSIONS', () => {
  it('defines 9 dimensions', () => {
    expect(ALL_WORLD_DIMENSIONS).toHaveLength(9)
    expect(ALL_WORLD_DIMENSIONS).toEqual([
      'geography', 'history', 'factions', 'systems', 'society', 'culture', 'species', 'figures', 'atmosphere',
    ])
  })

  it('has 3 required dimensions', () => {
    expect(REQUIRED_WORLD_DIMENSIONS).toEqual(['geography', 'history', 'factions'])
  })

  it('maps dimensions to correct priorities', () => {
    expect(WORLD_DIMENSIONS.geography.priority).toBe('required')
    expect(WORLD_DIMENSIONS.systems.priority).toBe('important')
    expect(WORLD_DIMENSIONS.atmosphere.priority).toBe('supplementary')
  })

  it('maps dimensions to correct distillTarget scopes', () => {
    expect(WORLD_DIMENSIONS.geography.distillTarget).toBe('background')
    expect(WORLD_DIMENSIONS.history.distillTarget).toBe('background')
    expect(WORLD_DIMENSIONS.systems.distillTarget).toBe('rule')
    expect(WORLD_DIMENSIONS.factions.distillTarget).toBe('lore')
    expect(WORLD_DIMENSIONS.figures.distillTarget).toBe('lore')
    expect(WORLD_DIMENSIONS.atmosphere.distillTarget).toBe('atmosphere')
  })
})

describe('WORLD_DIMENSION_SIGNALS', () => {
  it('detects geography signals in English', () => {
    const signals = WORLD_DIMENSION_SIGNALS.geography
    expect(signals.some((r) => r.test('located in the northern district'))).toBe(true)
  })

  it('detects geography signals in Chinese', () => {
    const signals = WORLD_DIMENSION_SIGNALS.geography
    expect(signals.some((r) => r.test('位于城市的北部区域'))).toBe(true)
  })

  it('detects species signals', () => {
    const signals = WORLD_DIMENSION_SIGNALS.species
    expect(signals.some((r) => r.test('the elf race is immortal'))).toBe(true)
    expect(signals.some((r) => r.test('这个种族拥有不死能力'))).toBe(true)
  })

  it('detects figures signals', () => {
    const signals = WORLD_DIMENSION_SIGNALS.figures
    expect(signals.some((r) => r.test('the founder of the organization'))).toBe(true)
    expect(signals.some((r) => r.test('创始人建立了这家公司'))).toBe(true)
  })

  it('detects systems signals', () => {
    const signals = WORLD_DIMENSION_SIGNALS.systems
    expect(signals.some((r) => r.test('the magic system relies on mana'))).toBe(true)
    expect(signals.some((r) => r.test('科技体系基于义体改造'))).toBe(true)
  })
})

describe('generateWorldSearchPlan', () => {
  it('generates plan for FICTIONAL_UNIVERSE', () => {
    const plan = generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Night City', '夜之城', 'Cyberpunk 2077')
    expect(plan.classification).toBe('FICTIONAL_UNIVERSE')
    expect(plan.dimensions).toHaveLength(9)

    const geoDim = plan.dimensions.find((d) => d.dimension === 'geography')
    expect(geoDim).toBeDefined()
    expect(geoDim!.priority).toBe('required')
    expect(geoDim!.queries.some((q) => q.includes('Night City'))).toBe(true)
  })

  it('generates plan for REAL_SETTING', () => {
    const plan = generateWorldSearchPlan('REAL_SETTING', 'Alibaba', '阿里巴巴', '')
    expect(plan.dimensions).toHaveLength(9)

    const factionsDim = plan.dimensions.find((d) => d.dimension === 'factions')
    expect(factionsDim!.queries.some((q) => q.includes('Alibaba'))).toBe(true)
  })

  it('returns empty dimensions for UNKNOWN_SETTING', () => {
    const plan = generateWorldSearchPlan('UNKNOWN_SETTING', '', '', '')
    expect(plan.dimensions).toHaveLength(0)
  })

  it('uses localName when different from englishName', () => {
    const plan = generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Middle Earth', '中土世界', 'Lord of the Rings')
    const historyDim = plan.dimensions.find((d) => d.dimension === 'history')
    expect(historyDim!.queries.some((q) => q.includes('中土世界'))).toBe(true)
  })

  it('each dimension has 3-7 queries (history dimension carries 7 — 5 base + 2 timeline-bias)', () => {
    const classifications = ['FICTIONAL_UNIVERSE', 'REAL_SETTING'] as const
    for (const cls of classifications) {
      const plan = generateWorldSearchPlan(cls, 'TestWorld', '测试世界', 'TestOrigin')
      for (const dim of plan.dimensions) {
        expect(dim.queries.length, `${cls}/${dim.dimension} should have 3-7 queries`).toBeGreaterThanOrEqual(3)
        expect(dim.queries.length, `${cls}/${dim.dimension} should have 3-7 queries`).toBeLessThanOrEqual(7)
      }
    }
  })

  it('no template query has more than 3 effective keywords (excluding name placeholders)', () => {
    const classifications = ['FICTIONAL_UNIVERSE', 'REAL_SETTING'] as const
    for (const cls of classifications) {
      const plan = generateWorldSearchPlan(cls, '__NAME__', '__LOCAL__', '__ORIGIN__')
      for (const dim of plan.dimensions) {
        for (const query of dim.queries) {
          const stripped = query
            .replace(/__NAME__/g, '')
            .replace(/__LOCAL__/g, '')
            .replace(/__ORIGIN__/g, '')
            .trim()
          const words = stripped.split(/\s+/).filter(Boolean)
          expect(words.length, `${cls}/${dim.dimension} query "${query}" has ${words.length} keywords (max 3)`).toBeLessThanOrEqual(3)
        }
      }
    }
  })
})

describe('analyzeWorldCoverage', () => {
  function makeExtraction(content: string) {
    return { content }
  }

  it('returns canReport=true when 4+ dimensions covered with 2+ required', () => {
    const extractions = [
      makeExtraction('This city is located in the northern region'),
      makeExtraction('The history timeline spans three centuries'),
      makeExtraction('The corporation controls the government'),
      makeExtraction('The magic system uses mana crystals'),
    ]
    const report = analyzeWorldCoverage(extractions)
    expect(report.canReport).toBe(true)
    expect(report.totalCovered).toBeGreaterThanOrEqual(4)
    expect(report.requiredCovered).toBeGreaterThanOrEqual(2)
  })

  it('returns canReport=false when only supplementary dimensions covered', () => {
    const extractions = [
      makeExtraction('dark and grim ambiance with moody tone'),
      makeExtraction('the notable villain is quite prominent'),
    ]
    const report = analyzeWorldCoverage(extractions)
    expect(report.canReport).toBe(false)
    expect(report.requiredCovered).toBe(0)
  })

  it('returns canReport=false when fewer than 4 dimensions covered', () => {
    const extractions = [
      makeExtraction('located in the district'),
      makeExtraction('the history of the war'),
    ]
    const report = analyzeWorldCoverage(extractions)
    expect(report.canReport).toBe(false)
  })

  it('provides helpful suggestion when coverage insufficient', () => {
    const report = analyzeWorldCoverage([])
    expect(report.canReport).toBe(false)
    expect(report.suggestion).toContain('Missing required dimensions')
  })

  it('provides suggestion when all dimensions covered', () => {
    const extractions = [
      makeExtraction('located in the northern region city'),
      makeExtraction('history timeline era founded'),
      makeExtraction('faction organization alliance government'),
      makeExtraction('technology system rules law economy'),
      makeExtraction('daily life class social poverty'),
      makeExtraction('custom tradition religion art culture'),
      makeExtraction('race species tribe inhabitants'),
      makeExtraction('leader founder hero key figure'),
      makeExtraction('atmosphere mood tone aesthetic'),
    ]
    const report = analyzeWorldCoverage(extractions)
    expect(report.canReport).toBe(true)
    expect(report.suggestion).toContain('All dimensions covered')
  })
})
