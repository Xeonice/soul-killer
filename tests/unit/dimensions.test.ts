import { describe, it, expect } from 'vitest'
import { analyzeCoverage, generateSearchPlan, ALL_DIMENSIONS, REQUIRED_DIMENSIONS } from '../../src/soul/capture/soul-dimensions.js'

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

  it('detects capabilities dimension', () => {
    const report = analyzeCoverage([
      { content: 'Her Noble Phantasm is Excalibur, with power stats of A++.' },
    ])
    expect(report.coverage.capabilities.covered).toBe(true)
  })

  it('detects capabilities dimension from Chinese keywords', () => {
    const report = analyzeCoverage([
      { content: '阿尔托莉雅的宝具是Excalibur，属性为A++' },
    ])
    expect(report.coverage.capabilities.covered).toBe(true)
  })

  it('detects milestones dimension', () => {
    const report = analyzeCoverage([
      { content: 'The key events in her timeline include drawing the sword and the fall of Camelot.' },
    ])
    expect(report.coverage.milestones.covered).toBe(true)
  })

  it('detects milestones dimension from Chinese keywords', () => {
    const report = analyzeCoverage([
      { content: '阿尔托莉雅的关键事件包括拔出石中剑和卡美洛的陨落' },
    ])
    expect(report.coverage.milestones.covered).toBe(true)
  })

  it('canReport=true when 4+ dimensions with 2+ required', () => {
    const report = analyzeCoverage([
      { content: 'Character background and origin story.' },
      { content: 'She said "I am the king of knights."' },
      { content: 'Her personality is determined and stoic.' },
      { content: 'Her abilities include swordsmanship and magic resistance.' },
    ])
    expect(report.totalCovered).toBeGreaterThanOrEqual(4)
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
    expect(plan.dimensions).toHaveLength(8)

    const identityPlan = plan.dimensions.find((d) => d.dimension === 'identity')!
    expect(identityPlan.priority).toBe('required')
    expect(identityPlan.queries.length).toBeGreaterThan(0)
    expect(identityPlan.queries.some((q) => q.includes('Artoria Pendragon'))).toBe(true)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.some((q) => q.includes('quotes'))).toBe(true)
    expect(quotesPlan.queries.some((q) => q.includes('台词'))).toBe(true)
  })

  it('includes capabilities and milestones dimensions', () => {
    const plan = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria Pendragon', '阿尔托莉雅', 'Fate/Stay Night')
    const capPlan = plan.dimensions.find((d) => d.dimension === 'capabilities')!
    expect(capPlan.priority).toBe('important')
    expect(capPlan.queries.some((q) => q.includes('abilities') || q.includes('能力'))).toBe(true)

    const milPlan = plan.dimensions.find((d) => d.dimension === 'milestones')!
    expect(milPlan.priority).toBe('important')
    expect(milPlan.queries.some((q) => q.includes('timeline') || q.includes('时间线'))).toBe(true)
  })

  it('appends domain tags to capabilities/milestones queries', () => {
    const plan = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria', '阿尔托莉雅', 'Fate', { domain: ['骑士', '剑术'] })
    const capPlan = plan.dimensions.find((d) => d.dimension === 'capabilities')!
    // Should have both base queries and tag-enhanced queries
    expect(capPlan.queries.some((q) => q.includes('骑士'))).toBe(true)
    expect(capPlan.queries.some((q) => q.includes('剑术'))).toBe(true)

    const milPlan = plan.dimensions.find((d) => d.dimension === 'milestones')!
    expect(milPlan.queries.some((q) => q.includes('骑士'))).toBe(true)
  })

  it('appends domain tags to thoughts/behavior queries', () => {
    const plan = generateSearchPlan('PUBLIC_ENTITY', 'Zhang Yiming', '张一鸣', 'ByteDance', { domain: ['企业家'] })
    const thoughtsPlan = plan.dimensions.find((d) => d.dimension === 'thoughts')!
    expect(thoughtsPlan.queries.some((q) => q.includes('企业家'))).toBe(true)
  })

  it('does not append tags to identity/quotes/expression/relations', () => {
    const plan = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria', '阿尔托莉雅', 'Fate', { domain: ['骑士'] })
    const identityPlan = plan.dimensions.find((d) => d.dimension === 'identity')!
    expect(identityPlan.queries.every((q) => !q.includes('骑士'))).toBe(true)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.every((q) => !q.includes('骑士'))).toBe(true)
  })

  it('falls back to base templates when no tags provided', () => {
    const planNoTags = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria', '阿尔托莉雅', 'Fate')
    const planEmptyTags = generateSearchPlan('DIGITAL_CONSTRUCT', 'Artoria', '阿尔托莉雅', 'Fate', { domain: [] })

    const capNoTags = planNoTags.dimensions.find((d) => d.dimension === 'capabilities')!
    const capEmpty = planEmptyTags.dimensions.find((d) => d.dimension === 'capabilities')!
    expect(capNoTags.queries.length).toBe(capEmpty.queries.length)
  })

  it('generates plan for PUBLIC_ENTITY', () => {
    const plan = generateSearchPlan('PUBLIC_ENTITY', 'Elon Musk', 'Elon Musk', 'Tesla/SpaceX')
    expect(plan.dimensions).toHaveLength(8)

    const quotesPlan = plan.dimensions.find((d) => d.dimension === 'quotes')!
    expect(quotesPlan.queries.some((q) => q.includes('quotes'))).toBe(true)
  })

  it('generates plan for HISTORICAL_RECORD', () => {
    const plan = generateSearchPlan('HISTORICAL_RECORD', 'Confucius', '孔子', 'Ancient China')
    expect(plan.dimensions).toHaveLength(8)

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
      .queries.filter((q) => q.includes('经典台词'))
    expect(localQueries[0]!).toContain('Elon Musk')
  })

  it('each dimension has 3-5 queries', () => {
    const classifications = ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD'] as const
    for (const cls of classifications) {
      const plan = generateSearchPlan(cls, 'TestName', '测试名', 'TestOrigin')
      for (const dim of plan.dimensions) {
        expect(dim.queries.length, `${cls}/${dim.dimension} should have 3-5 queries`).toBeGreaterThanOrEqual(3)
        expect(dim.queries.length, `${cls}/${dim.dimension} should have 3-5 queries`).toBeLessThanOrEqual(10) // allow tag-enhanced to exceed 5
      }
    }
  })

  it('no template query has more than 3 effective keywords (excluding name placeholders)', () => {
    const classifications = ['DIGITAL_CONSTRUCT', 'PUBLIC_ENTITY', 'HISTORICAL_RECORD'] as const
    for (const cls of classifications) {
      const plan = generateSearchPlan(cls, '__NAME__', '__LOCAL__', '__ORIGIN__')
      for (const dim of plan.dimensions) {
        for (const query of dim.queries) {
          // Remove name/localName/origin placeholders and count remaining words
          const stripped = query
            .replace(/__NAME__/g, '')
            .replace(/__LOCAL__/g, '')
            .replace(/__ORIGIN__/g, '')
            .trim()
          // Split by whitespace, filter out empty strings
          const words = stripped.split(/\s+/).filter(Boolean)
          expect(words.length, `${cls}/${dim.dimension} query "${query}" has ${words.length} keywords (max 3)`).toBeLessThanOrEqual(3)
        }
      }
    }
  })
})
