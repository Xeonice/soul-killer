import { describe, it, expect, vi } from 'vitest'
import { runBatchPipeline, retryFailedSouls, type BatchPipelineDeps, type BatchPipelineOptions, type BatchProgressEvent, type SoulInput } from '../../src/soul/batch-pipeline.js'
import type { CaptureResult } from '../../src/infra/agent/capture-strategy.js'
import type { DistillResult } from '../../src/soul/distill/distill-agent.js'
import { emptyTagSet } from '../../src/tags/taxonomy.js'

function createMockDeps(overrides?: Partial<BatchPipelineDeps>): BatchPipelineDeps {
  return {
    captureSoul: vi.fn().mockResolvedValue({
      classification: 'PUBLIC_ENTITY',
      origin: 'test',
      chunks: [{ id: '1', source: 'web', content: 'test', timestamp: '', context: '', type: 'text' as const }],
      elapsedMs: 100,
    } satisfies CaptureResult),
    distillSoul: vi.fn().mockResolvedValue({
      identity: 'test',
      style: 'test',
      behaviors: [],
      steps: 1,
      elapsedMs: 50,
    } satisfies DistillResult),
    createSyntheticChunks: vi.fn().mockReturnValue([]),
    packageSoul: vi.fn(),
    generateManifest: vi.fn(),
    ...overrides,
  }
}

function createOptions(souls: SoulInput[], deps: BatchPipelineDeps, overrides?: Partial<BatchPipelineOptions>): BatchPipelineOptions {
  return {
    souls,
    config: { llm: { api_key: 'test', default_model: 'test' } } as any,
    dataSources: ['web-search'],
    soulType: 'public',
    soulsDir: '/tmp/test-souls',
    deps,
    ...overrides,
  }
}

describe('runBatchPipeline', () => {
  it('processes all souls and returns results', async () => {
    const deps = createMockDeps()
    const souls: SoulInput[] = [
      { name: 'alice', description: 'desc A' },
      { name: 'bob', description: 'desc B' },
    ]

    const result = await runBatchPipeline(createOptions(souls, deps))

    expect(result.souls).toHaveLength(2)
    expect(result.souls[0]!.name).toBe('alice')
    expect(result.souls[0]!.phase).toBe('done')
    expect(result.souls[1]!.name).toBe('bob')
    expect(result.souls[1]!.phase).toBe('done')
    expect(deps.captureSoul).toHaveBeenCalledTimes(2)
    expect(deps.distillSoul).toHaveBeenCalledTimes(2)
  })

  it('respects maxConcurrency limit', async () => {
    let activeConcurrency = 0
    let peakConcurrency = 0

    const deps = createMockDeps({
      captureSoul: vi.fn().mockImplementation(async () => {
        activeConcurrency++
        peakConcurrency = Math.max(peakConcurrency, activeConcurrency)
        await new Promise((r) => setTimeout(r, 50))
        activeConcurrency--
        return {
          classification: 'PUBLIC_ENTITY',
          chunks: [{ id: '1', source: 'web', content: 'test', timestamp: '', context: '', type: 'text' }],
          elapsedMs: 50,
        }
      }),
    })

    const souls: SoulInput[] = Array.from({ length: 5 }, (_, i) => ({
      name: `soul-${i}`,
      description: `desc ${i}`,
    }))

    await runBatchPipeline(createOptions(souls, deps, { maxConcurrency: 3 }))

    expect(peakConcurrency).toBeLessThanOrEqual(3)
    expect(deps.captureSoul).toHaveBeenCalledTimes(5)
  })

  it('isolates failures — failed soul does not affect others', async () => {
    const deps = createMockDeps({
      captureSoul: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'bob') throw new Error('Rate limit exceeded')
        return {
          classification: 'PUBLIC_ENTITY',
          chunks: [{ id: '1', source: 'web', content: 'test', timestamp: '', context: '', type: 'text' }],
          elapsedMs: 100,
        }
      }),
    })

    const souls: SoulInput[] = [
      { name: 'alice', description: 'desc A' },
      { name: 'bob', description: 'desc B' },
      { name: 'carol', description: 'desc C' },
    ]

    const result = await runBatchPipeline(createOptions(souls, deps))

    expect(result.souls.find((s) => s.name === 'alice')!.phase).toBe('done')
    expect(result.souls.find((s) => s.name === 'bob')!.phase).toBe('failed')
    expect(result.souls.find((s) => s.name === 'bob')!.error).toContain('Rate limit')
    expect(result.souls.find((s) => s.name === 'carol')!.phase).toBe('done')
  })

  it('marks soul as failed when capture returns 0 chunks', async () => {
    const deps = createMockDeps({
      captureSoul: vi.fn().mockResolvedValue({
        classification: 'UNKNOWN_ENTITY',
        chunks: [],
        elapsedMs: 100,
      }),
    })

    const souls: SoulInput[] = [{ name: 'alice', description: 'desc' }]
    const result = await runBatchPipeline(createOptions(souls, deps))

    expect(result.souls[0]!.phase).toBe('failed')
    expect(result.souls[0]!.error).toContain('Capture failed')
    expect(deps.distillSoul).not.toHaveBeenCalled()
  })

  it('surfaces API error (e.g. 402 credits) as clean failed status', async () => {
    const apiError = Object.assign(new Error('This request requires more credits'), {
      statusCode: 402,
      data: { error: { message: 'This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 7726.' } },
    })

    const deps = createMockDeps({
      captureSoul: vi.fn().mockRejectedValue(apiError),
    })

    const souls: SoulInput[] = [
      { name: 'alice', description: 'desc A' },
      { name: 'bob', description: 'desc B' },
    ]

    const result = await runBatchPipeline(createOptions(souls, deps))

    // Both should fail with the API error
    for (const soul of result.souls) {
      expect(soul.phase).toBe('failed')
      expect(soul.error).toBeDefined()
      // Error should contain the useful message, not a raw stack trace
      expect(soul.error).toContain('credits')
    }
    // Distill should not be called for any soul
    expect(deps.distillSoul).not.toHaveBeenCalled()
  })

  it('failed souls from API error can be retried', async () => {
    let callCount = 0
    const deps = createMockDeps({
      captureSoul: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount <= 2) {
          throw Object.assign(new Error('credits'), {
            statusCode: 402,
            data: { error: { message: 'Insufficient credits' } },
          })
        }
        return {
          classification: 'PUBLIC_ENTITY',
          chunks: [{ id: '1', source: 'web', content: 'test', timestamp: '', context: '', type: 'text' }],
          elapsedMs: 100,
        }
      }),
    })

    const souls: SoulInput[] = [
      { name: 'alice', description: 'desc A' },
      { name: 'bob', description: 'desc B' },
    ]

    // First run: both fail
    const first = await runBatchPipeline(createOptions(souls, deps))
    expect(first.souls.every((s) => s.phase === 'failed')).toBe(true)

    // Retry: now should succeed (callCount > 2)
    const retry = await retryFailedSouls(
      ['alice', 'bob'],
      souls,
      { ...createOptions(souls, deps), souls: [] } as any,
    )
    expect(retry.souls.every((s) => s.phase === 'done')).toBe(true)
  })

  it('emits progress events for each soul', async () => {
    const deps = createMockDeps()
    const events: BatchProgressEvent[] = []

    const souls: SoulInput[] = [{ name: 'alice', description: 'desc' }]
    await runBatchPipeline(createOptions(souls, deps, {
      onProgress: (e) => events.push(e),
    }))

    const phases = events.filter((e) => e.type === 'phase').map((e) => (e as any).phase)
    expect(phases).toContain('capturing')
    expect(phases).toContain('distilling')
    expect(phases).toContain('done')
  })

  it('skips capture when web-search not in dataSources', async () => {
    const deps = createMockDeps()
    const souls: SoulInput[] = [{ name: 'alice', description: 'desc' }]

    await runBatchPipeline(createOptions(souls, deps, { dataSources: [] }))

    expect(deps.captureSoul).not.toHaveBeenCalled()
    expect(deps.distillSoul).toHaveBeenCalledTimes(1)
  })
})

describe('retryFailedSouls', () => {
  it('retries only the specified failed souls', async () => {
    const deps = createMockDeps()
    const allSouls: SoulInput[] = [
      { name: 'alice', description: 'desc A' },
      { name: 'bob', description: 'desc B' },
      { name: 'carol', description: 'desc C' },
    ]

    const result = await retryFailedSouls(['bob'], allSouls, {
      config: { llm: { api_key: 'test', default_model: 'test' } } as any,
      dataSources: ['web-search'],
      soulType: 'public',
      soulsDir: '/tmp/test-souls',
      deps,
    })

    expect(result.souls).toHaveLength(1)
    expect(result.souls[0]!.name).toBe('bob')
    expect(result.souls[0]!.phase).toBe('done')
  })
})
