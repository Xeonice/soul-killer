import { describe, it, expect, vi } from 'vitest'
import { generateText } from 'ai'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

describe('Planning Agent', () => {
  async function runAgent(responseJson: unknown) {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(responseJson),
    } as any)

    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    return runPlanningAgent(
      {} as any, // dummy model
      'world',
      'Three Kingdoms',
      '东汉末年三国',
      [{ title: 'Wiki', url: 'https://wiki.com', content: 'Three Kingdoms period' }],
      'REAL_SETTING',
      '三国',
      '中国历史',
    )
  }

  it('produces a valid plan with complete dimensions', async () => {
    const plan = await runAgent({
      dimensions: [
        { name: 'geography', display: '地理', description: 'Locations and regions', priority: 'required', signals: ['location', '地点'], queries: ['Three Kingdoms geography', '三国 地理'], qualityCriteria: ['包含具体地点'], minArticles: 3, distillTarget: 'background' },
        { name: 'history', display: '历史', description: 'Key events and timeline', priority: 'required', signals: ['history', '历史'], queries: ['Three Kingdoms history', '三国 历史'], qualityCriteria: ['包含具体时间和事件'], minArticles: 3, distillTarget: 'background' },
        { name: 'factions', display: '势力', description: 'Updated factions for Three Kingdoms', priority: 'required', signals: ['faction', '势力'], queries: ['Three Kingdoms factions', '三国 势力'], qualityCriteria: ['描述组织结构'], minArticles: 3, distillTarget: 'lore' },
        { name: 'systems', display: '体系', description: 'Governance and law', priority: 'important', signals: ['system', '体系'], queries: ['Three Kingdoms systems', '三国 体系'], qualityCriteria: ['解释制度'], minArticles: 2, distillTarget: 'rule' },
        { name: 'society', display: '社会', description: 'Social structure', priority: 'important', signals: ['society', '社会'], queries: ['Three Kingdoms society', '三国 社会'], qualityCriteria: ['描述社会阶层'], minArticles: 2, distillTarget: 'lore' },
        { name: 'culture', display: '文化', description: 'Customs and beliefs', priority: 'important', signals: ['culture', '文化'], queries: ['Three Kingdoms culture', '三国 文化'], qualityCriteria: ['描述文化特征'], minArticles: 2, distillTarget: 'lore' },
        { name: 'military-strategy', display: '军事战略', description: 'Battle tactics and military campaigns', priority: 'important', signals: ['battle', 'tactics', '战役', '战术'], queries: ['Three Kingdoms battles', '三国 战役'], qualityCriteria: ['描述战术'], minArticles: 2, distillTarget: 'lore' },
        { name: 'figures', display: '人物', description: 'Key figures', priority: 'supplementary', signals: ['leader', '领袖'], queries: ['Three Kingdoms figures', '三国 人物'], qualityCriteria: ['包含人物事迹'], minArticles: 2, distillTarget: 'lore' },
        { name: 'atmosphere', display: '氛围', description: 'Mood and tone', priority: 'supplementary', signals: ['atmosphere', '氛围'], queries: ['Three Kingdoms atmosphere', '三国 氛围'], qualityCriteria: ['有文学分析'], minArticles: 2, distillTarget: 'atmosphere' },
      ],
    })

    expect(plan.dimensions.length).toBe(9)
    expect(plan.dimensions.every((d) => d.source === 'planned')).toBe(true)

    const factions = plan.dimensions.find((d) => d.name === 'factions')!
    expect(factions.description).toBe('Updated factions for Three Kingdoms')

    const military = plan.dimensions.find((d) => d.name === 'military-strategy')!
    expect(military.source).toBe('planned')
  })

  it('throws on invalid JSON response', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'not json at all' } as any)

    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    await expect(
      runPlanningAgent({} as any, 'world', 'Test', undefined, [], 'REAL_SETTING'),
    ).rejects.toThrow('invalid JSON')
  })

  it('handles markdown-wrapped JSON', async () => {
    const dims = Array.from({ length: 6 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    }))
    const json = JSON.stringify({ dimensions: dims })
    vi.mocked(generateText).mockResolvedValueOnce({ text: '```json\n' + json + '\n```' } as any)

    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    const plan = await runPlanningAgent({} as any, 'world', 'Test', undefined, [], 'REAL_SETTING')
    expect(plan.dimensions.length).toBe(6)
  })

  it('throws when dimensions exceed max limit', async () => {
    const tooMany = Array.from({ length: 16 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    }))

    await expect(
      runAgent({ dimensions: tooMany }),
    ).rejects.toThrow('dimensions')
  })

  it('throws when dimensions below min limit', async () => {
    const tooFew = Array.from({ length: 3 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    }))

    await expect(
      runAgent({ dimensions: tooFew }),
    ).rejects.toThrow('dimensions')
  })

  it('throws when dimension has no signals', async () => {
    const dims = Array.from({ length: 6 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: i === 0 ? [] : ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    }))

    await expect(
      runAgent({ dimensions: dims }),
    ).rejects.toThrow('no signals')
  })

  it('accepts valid dimensions list', async () => {
    const dims = Array.from({ length: 8 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    }))
    const plan = await runAgent({ dimensions: dims })
    expect(plan.dimensions.length).toBe(8)
    expect(plan.dimensions.every((d) => d.source === 'planned')).toBe(true)
  })
})

describe('Planning Agent — meta exclusion prompt', () => {
  /** Extract the system prompt passed to generateText */
  function capturePrompt(): string {
    const call = vi.mocked(generateText).mock.calls.at(-1)
    return (call?.[0] as any)?.system ?? ''
  }

  const validResponse = {
    dimensions: Array.from({ length: 6 }, (_, i) => ({
      name: `dim-${i}`, display: `Dim ${i}`, description: 'desc', priority: 'important',
      signals: ['sig'], queries: ['query'], qualityCriteria: ['criteria'], minArticles: 2, distillTarget: 'lore',
    })),
  }

  it('includes meta exclusion section when type is world', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify(validResponse) } as any)
    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    await runPlanningAgent({} as any, 'world', 'TestWorld', undefined, [], 'FICTIONAL_UNIVERSE')

    const prompt = capturePrompt()
    expect(prompt).toContain('In-World Information ONLY')
    expect(prompt).toContain('Release dates')
    expect(prompt).toContain('Voice actors')
  })

  it('does NOT include meta exclusion section when type is soul', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify(validResponse) } as any)
    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    await runPlanningAgent({} as any, 'soul', 'TestSoul', undefined, [], 'PUBLIC_ENTITY')

    const prompt = capturePrompt()
    expect(prompt).not.toContain('In-World Information ONLY')
    expect(prompt).not.toContain('REAL_SETTING')
  })

  it('includes strict qualifiers for REAL_SETTING classification', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify(validResponse) } as any)
    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    await runPlanningAgent({} as any, 'world', 'White Album 2', undefined, [], 'REAL_SETTING')

    const prompt = capturePrompt()
    expect(prompt).toContain('REAL_SETTING')
    expect(prompt).toContain('故事内')
    expect(prompt).toContain('in-story')
    expect(prompt).toContain('meta-exclusion criterion')
  })

  it('does NOT include strict qualifiers for FICTIONAL_UNIVERSE', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: JSON.stringify(validResponse) } as any)
    const { runPlanningAgent } = await import('../../../../src/infra/agent/planning-agent.js')
    await runPlanningAgent({} as any, 'world', 'Cyberpunk 2077', undefined, [], 'FICTIONAL_UNIVERSE')

    const prompt = capturePrompt()
    expect(prompt).toContain('FICTIONAL_UNIVERSE')
    expect(prompt).not.toContain('Strict In-World Qualifiers Required')
  })
})
