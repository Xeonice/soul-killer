import { describe, it, expect } from 'vitest'
import { analyzeCoverage, generateSearchPlan, ALL_DIMENSIONS, REQUIRED_DIMENSIONS } from '../../src/agent/dimensions.js'

describe('analyzeCoverage', () => {
  it('returns all uncovered for empty input', () => {
    const report = analyzeCoverage([])
    expect(report.totalCovered).toBe(0)
    expect(report.requiredCovered).toBe(0)
    expect(report.canReport).toBe(false)
    for (const dim of ALL_DIMENSIONS) {
      expect(report.coverage[dim].count).toBe(0)
      expect(report.coverage[dim].covered).toBe(false)
    }
  })

  it('detects identity dimension from background keywords', () => {
    const report = analyzeCoverage([
      { content: 'Artoria Pendragon is a character from Fate/Stay Night. Her background is...' },
    ])
    expect(report.coverage.identity.covered).toBe(true)
    expect(report.coverage.identity.count).toBe(1)
  })

  it('detects quotes dimension from direct quotes', () => {
    const report = analyzeCoverage([
      { content: 'She famously said "I ask of you, are you my master?"' },
    ])
    expect(report.coverage.quotes.covered).toBe(true)
  })

  it('detects quotes dimension from Chinese keywords', () => {
    const report = analyzeCoverage([
      { content: '阿尔托莉雅的经典台词："我问你，你就是我的Master吗？"' },
    ])
    expect(report.coverage.quotes.covered).toBe(true)
  })

  it('detects expression dimension', () => {
    const report = analyzeCoverage([
      { content: 'Her speech pattern is formal and regal, with a distinctive tone of authority.' },
    ])
    expect(report.coverage.expression.covered).toBe(true)
  })

  it('detects thoughts dimension', () => {
    const report = analyzeCoverage([
      { content: 'She believes in protecting the weak and values honor above all.' },
    ])
    expect(report.coverage.thoughts.covered).toBe(true)
  })

  it('detects behavior dimension', () => {
    const report = analyzeCoverage([
      { content: 'Her personality is described as stoic. She tends to make decisions quickly under pressure.' },
    ])
    expect(report.coverage.behavior.covered).toBe(true)
  })

  it('detects relations dimension', () => {
    const report = analyzeCoverage([
      { content: 'Her relationship with Shirou is central to the story.' },
    ])
    expect(report.coverage.relations.covered).toBe(true)
  })

  it('one extraction can hit multiple dimensions', () => {
    const report = analyzeCoverage([
      { content: 'Artoria has a complex background. Her personality is stoic. She said "Excalibur!" in battle.' },
    ])
    expect(report.coverage.identity.covered).toBe(true)
    expect(report.coverage.behavior.covered).toBe(true)
    // "said" triggers quotes
    expect(report.coverage.quotes.covered).toBe(true)
  })

  it('canReport=true when 3+ dimensions with 2+ required', () => {
    const report = analyzeCoverage([
      { content: 'Character background and origin story.' },
      { content: 'She said "I am the king of knights."' },
      { content: 'Her personality is determined and stoic.' },
    ])
    expect(report.totalCovered).toBeGreaterThanOrEqual(3)
    expect(report.requiredCovered).toBeGreaterThanOrEqual(2)
    expect(report.canReport).toBe(true)
  })

  it('canReport=false when required dimensions insufficient', () => {
    // Only behavior, relations, thoughts — no required dimensions
    const report = analyzeCoverage([
      { content: 'Her decision making is careful and methodical.' },
      { content: 'She has a strong relationship with her mentor.' },
      { content: 'She believes in justice and fairness.' },
    ])
    // These hit behavior, relations, thoughts — but none of the required (identity, quotes, expression)
    expect(report.requiredCovered).toBeLessThan(2)
    expect(report.canReport).toBe(false)
  })

  it('suggestion mentions missing required dimensions', () => {
    const report = analyzeCoverage([
      { content: 'Character with a certain background from a story.' },
    ])
    expect(report.suggestion).toContain('quotes')
  })
})

describe('generateSearchPlan', () => {
  it('generates plan for DIGITAL_CONSTRUCT', () => {
    const plan = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria Pendragon', '阿尔托莉雅', 'Fate/Stay Night')
    expect(plan.classification).toBe('DIGITAL_CONSTRUCT')
    expect(plan.englishName).toBe('Artoria Pendragon')
    expect(plan.dimensions).toHaveLength(6)

    const identityPlan = plan.dimensions.find((d) => d.dimension === 'identity')!
    expect(identityPlan.priority).toBe('required')
    expect(identityPlan.queries.length).toBeGreaterThan(0)
    expect(identityPlan.queries.some((q) => q.includes('Artoria Pendragon'))).toBe(true)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.some((q) => q.includes('quotes'))).toBe(true)
    expect(quotesPlan.queries.some((q) => q.includes('台词'))).toBe(true)
  })

  it('generates plan for PUBLIC_ENTITY', () => {
    const plan = generateSearchPlan('PUBLIC_ENTITY', 'Elon Musk', 'Elon Musk', 'Tesla/SpaceX')
    expect(plan.dimensions).toHaveLength(6)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.some((q) => q.includes('interviews'))).toBe(true)
  })

  it('generates plan for HISTORICAL_RECORD', () => {
    const plan = generateSearchPlan('HISTORICAL_RECORD', 'Confucius', '孔子', 'Ancient China')
    expect(plan.dimensions).toHaveLength(6)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.some((q) => q.includes('语录'))).toBe(true)
  })

  it('returns empty plan for UNKNOWN_ENTITY', () => {
    const plan = generateSearchPlan('UNKNOWN_ENTITY', 'nobody', 'nobody', '')
    expect(plan.dimensions).toHaveLength(0)
  })

  it('replaces placeholders correctly', () => {
    const plan = generateSearchPlan('DIGITAL_CONSTRUCT', 'Johnny Silverhand', '强尼银手', 'Cyberpunk 2077')
    const allQueries = plan.dimensions.flatMap((d) => d.queries)

    expect(allQueries.every((q) => !q.includes('{name}'))).toBe(true)
    expect(allQueries.every((q) => !q.includes('{localName}'))).toBe(true)
    expect(allQueries.every((q) => !q.includes('{origin}'))).toBe(true)

    expect(allQueries.some((q) => q.includes('Johnny Silverhand'))).toBe(true)
    expect(allQueries.some((q) => q.includes('强尼银手'))).toBe(true)
  })

  it('uses englishName as fallback when localName equals englishName', () => {
    const plan = generateSearchPlan('PUBLIC_ENTITY', 'Elon Musk', 'Elon Musk', 'Tesla')
    const localQueries = plan.dimensions
      .find((d) => d.dimension === 'quotes')!
      .queries.filter((q) => q.includes('经典语录'))
    expect(localQueries[0]!).toContain('Elon Musk')
  })
})
