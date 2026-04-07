import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createEvaluationTools } from '../../src/agent/tools/index.js'
import type { SoulkillerConfig } from '../../src/config/schema.js'
import type { DimensionPlan } from '../../src/agent/planning/dimension-framework.js'

vi.mock('../../src/agent/search/tavily-search.js', () => ({
  executeTavilySearch: vi.fn(),
}))

vi.mock('../../src/agent/search/exa-search.js', () => ({
  executeExaSearch: vi.fn(),
  hasCJK: vi.fn(() => false),
}))

vi.mock('../../src/agent/search/searxng-search.js', () => ({
  searxngSearch: vi.fn(),
  ensureSearxng: vi.fn(),
}))

function makeConfig(tavilyKey = 'test-key'): SoulkillerConfig {
  return {
    llm: { api_key: 'test', default_model: 'test' },
    search: { tavily_api_key: tavilyKey },
  } as SoulkillerConfig
}

function makePlan(): DimensionPlan {
  return {
    classification: 'REAL_SETTING',
    englishName: 'Test',
    localName: 'Test',
    origin: '',
    dimensions: [
      { name: 'history', display: 'History', description: 'Key events', priority: 'required', source: 'planned', signals: [], queries: [], distillTarget: 'background' },
      { name: 'geography', display: 'Geography', description: 'Locations', priority: 'required', source: 'planned', signals: [], queries: [], distillTarget: 'background' },
    ],
  }
}

let tmpDir: string

beforeEach(() => {
  vi.clearAllMocks()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true })
})

describe('evaluateDimension', () => {
  it('returns pre-computed scores for a dimension', async () => {
    const scores = new Map()
    scores.set('history', {
      dimension: 'history',
      totalArticles: 2,
      scores: [
        { index: 0, title: 'Battle of X', url: 'https://example.com/1', score: 4, reason: 'detailed', keep: true },
        { index: 1, title: 'Timeline', url: 'https://example.com/2', score: 2, reason: 'shallow', keep: false },
      ],
      qualifiedCount: 1,
      minRequired: 3,
      sufficient: false,
    })

    const { tools } = createEvaluationTools(makeConfig(), {
      dimensionPlan: makePlan(),
      dimensionScores: scores,
      sessionDir: tmpDir,
    })

    const result = await tools.evaluateDimension.execute!({ dimensionName: 'history' }, {} as any) as any
    expect(result.dimensionName).toBe('history')
    expect(result.qualifiedCount).toBe(1)
    expect(result.sufficient).toBe(false)
    expect(result.scores).toHaveLength(2)
    expect(result.scores[0].title).toBe('Battle of X')
    expect(result.scores[0].keep).toBe(true)
    expect(result.scores[1].keep).toBe(false)
  })

  it('returns error for unscored dimension', async () => {
    const { tools } = createEvaluationTools(makeConfig(), {
      dimensionPlan: makePlan(),
      sessionDir: tmpDir,
    })

    const result = await tools.evaluateDimension.execute!({ dimensionName: 'nonexistent' }, {} as any) as any
    expect(result.error).toBeDefined()
  })
})

describe('supplementSearch', () => {
  it('appends results to dimension cache', async () => {
    const { executeTavilySearch } = await import('../../src/agent/search/tavily-search.js')
    vi.mocked(executeTavilySearch).mockResolvedValueOnce([
      { title: 'New Result', url: 'https://example.com/new', content: 'New content' },
    ])

    // Pre-existing cache
    fs.writeFileSync(path.join(tmpDir, 'history.json'), JSON.stringify({
      results: [{ title: 'Old', url: 'https://example.com/old', content: 'Old content' }],
    }))

    const { tools } = createEvaluationTools(makeConfig(), {
      dimensionPlan: makePlan(),
      sessionDir: tmpDir,
      searxngAvailable: false,
    })

    const result = await tools.supplementSearch.execute!({ dimensionName: 'history', keywords: ['more', 'history'] }, {} as any) as any
    expect(result.newResults).toBe(1)
    expect(result.supplementsUsed).toBe(1)

    // Cache should have 2 results now
    const cached = JSON.parse(fs.readFileSync(path.join(tmpDir, 'history.json'), 'utf-8'))
    expect(cached.results).toHaveLength(2)
  })

  it('enforces supplement limit per dimension', async () => {
    const { executeTavilySearch } = await import('../../src/agent/search/tavily-search.js')
    vi.mocked(executeTavilySearch).mockResolvedValue([
      { title: 'R', url: 'https://example.com/r', content: 'Content' },
    ])

    fs.writeFileSync(path.join(tmpDir, 'history.json'), JSON.stringify({ results: [] }))

    const { tools } = createEvaluationTools(makeConfig(), {
      dimensionPlan: makePlan(),
      sessionDir: tmpDir,
    })

    // First two supplements succeed
    await tools.supplementSearch.execute!({ dimensionName: 'history', keywords: ['q1'] }, {} as any)
    await tools.supplementSearch.execute!({ dimensionName: 'history', keywords: ['q2'] }, {} as any)

    // Third should fail
    const result = await tools.supplementSearch.execute!({ dimensionName: 'history', keywords: ['q3'] }, {} as any) as any
    expect(result.error).toBeDefined()
  })

  it('deduplicates against existing cache', async () => {
    const { executeTavilySearch } = await import('../../src/agent/search/tavily-search.js')
    vi.mocked(executeTavilySearch).mockResolvedValueOnce([
      { title: 'Dup', url: 'https://example.com/old', content: 'Dup content' },
      { title: 'New', url: 'https://example.com/new', content: 'New content' },
    ])

    fs.writeFileSync(path.join(tmpDir, 'history.json'), JSON.stringify({
      results: [{ title: 'Old', url: 'https://example.com/old', content: 'Old' }],
    }))

    const { tools } = createEvaluationTools(makeConfig(), {
      dimensionPlan: makePlan(),
      sessionDir: tmpDir,
    })

    const result = await tools.supplementSearch.execute!({ dimensionName: 'history', keywords: ['test'] }, {} as any) as any
    expect(result.newResults).toBe(1) // only the new one
  })
})
