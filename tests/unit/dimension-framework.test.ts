import { describe, it, expect } from 'vitest'
import { signalsToRegex, getBaseDimensions } from '../../src/agent/planning/dimension-framework.js'
import { SOUL_DIMENSION_TEMPLATES } from '../../src/agent/strategy/soul-dimensions.js'
import { WORLD_DIMENSION_TEMPLATES } from '../../src/agent/strategy/world-dimensions.js'
import type { DimensionDef } from '../../src/agent/planning/dimension-framework.js'

describe('signalsToRegex', () => {
  it('converts CJK keywords to direct match regex', () => {
    const patterns = signalsToRegex(['战役', '战术'])
    expect(patterns.length).toBe(1)
    expect(patterns[0]!.test('这是一场战役')).toBe(true)
    expect(patterns[0]!.test('军事战术分析')).toBe(true)
    expect(patterns[0]!.test('nothing here')).toBe(false)
  })

  it('converts English keywords to word boundary regex', () => {
    const patterns = signalsToRegex(['battle', 'military'])
    expect(patterns.length).toBe(1)
    expect(patterns[0]!.test('the battle of Chibi')).toBe(true)
    expect(patterns[0]!.test('military strategy')).toBe(true)
    expect(patterns[0]!.test('embattled')).toBe(false) // word boundary
  })

  it('handles mixed CJK and English signals', () => {
    const patterns = signalsToRegex(['battle', '战役', 'military', '兵法'])
    expect(patterns.length).toBe(2) // one CJK, one English
    expect(patterns.some((p) => p.test('战役'))).toBe(true)
    expect(patterns.some((p) => p.test('battle'))).toBe(true)
  })

  it('returns empty array for empty signals', () => {
    expect(signalsToRegex([])).toEqual([])
  })
})

describe('DimensionDef interface consistency', () => {
  function validateDimension(dim: DimensionDef, source: string) {
    expect(dim.name, `${source}:${dim.name} name`).toBeTruthy()
    expect(dim.display, `${source}:${dim.name} display`).toBeTruthy()
    expect(dim.description, `${source}:${dim.name} description`).toBeTruthy()
    expect(['required', 'important', 'supplementary'], `${source}:${dim.name} priority`).toContain(dim.priority)
    expect(dim.source, `${source}:${dim.name} source`).toBe('planned')
    expect(dim.signals.length, `${source}:${dim.name} signals`).toBeGreaterThan(0)
    expect(dim.queries.length, `${source}:${dim.name} queries`).toBeGreaterThan(0)
    expect(['background', 'rule', 'lore', 'atmosphere'], `${source}:${dim.name} distillTarget`).toContain(dim.distillTarget)
  }

  it('all SOUL_DIMENSION_TEMPLATES follow DimensionDef interface', () => {
    expect(SOUL_DIMENSION_TEMPLATES.length).toBe(8)
    for (const dim of SOUL_DIMENSION_TEMPLATES) {
      validateDimension(dim, 'soul')
    }
  })

  it('all WORLD_DIMENSION_TEMPLATES follow DimensionDef interface', () => {
    expect(WORLD_DIMENSION_TEMPLATES.length).toBe(9)
    for (const dim of WORLD_DIMENSION_TEMPLATES) {
      validateDimension(dim, 'world')
    }
  })
})

describe('getBaseDimensions', () => {
  it('returns soul dimensions for type soul', async () => {
    const dims = await getBaseDimensions('soul')
    expect(dims.length).toBe(8)
    expect(dims[0]!.name).toBe('identity')
  })

  it('returns world dimensions for type world', async () => {
    const dims = await getBaseDimensions('world')
    expect(dims.length).toBe(9)
    expect(dims[0]!.name).toBe('geography')
  })
})
