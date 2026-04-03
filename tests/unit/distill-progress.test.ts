import { describe, it, expect, vi } from 'vitest'
import { extractFeatures, type DistillProgress } from '../../src/distill/extractor.js'

function mockClient(response = 'test content') {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: response } }],
        }),
      },
    },
  } as any
}

const singleChunk = [{
  id: '1', source: 'web' as const, content: 'test content about someone',
  timestamp: '', context: 'public' as const, type: 'knowledge' as const, metadata: {},
}]

describe('extractFeatures onProgress', () => {
  it('emits progress events for all phases', async () => {
    const client = mockClient()
    const events: DistillProgress[] = []

    await extractFeatures(client, 'test-model', singleChunk, 'Test', undefined, (p) => {
      events.push(p)
    })

    // Should have: identity started/done, style started/done, behavior started/done, merge started/done
    const phases = events.map((e) => `${e.phase}:${e.status}`)
    expect(phases).toContain('identity:started')
    expect(phases).toContain('identity:done')
    expect(phases).toContain('style:started')
    expect(phases).toContain('style:done')
    expect(phases).toContain('behavior:started')
    expect(phases).toContain('behavior:done')
    expect(phases).toContain('merge:started')
    expect(phases).toContain('merge:done')
  })

  it('emits events in correct order', async () => {
    const client = mockClient()
    const phases: string[] = []

    await extractFeatures(client, 'test-model', singleChunk, 'Test', undefined, (p) => {
      if (p.status === 'started') phases.push(p.phase)
    })

    expect(phases).toEqual(['identity', 'style', 'behavior', 'merge'])
  })

  it('emits batch progress for multi-batch extraction', async () => {
    const client = mockClient()
    // Create 35 chunks to trigger 2 batches (BATCH_SIZE = 30)
    const chunks = Array.from({ length: 35 }, (_, i) => ({
      id: String(i), source: 'web' as const, content: `content ${i}`,
      timestamp: '', context: 'public' as const, type: 'knowledge' as const, metadata: {},
    }))

    const batchEvents: DistillProgress[] = []

    await extractFeatures(client, 'test-model', chunks, 'Test', undefined, (p) => {
      if (p.status === 'in_progress') batchEvents.push(p)
    })

    // Should have batch progress for identity, style, behavior (each with 2 batches)
    const identityBatches = batchEvents.filter((e) => e.phase === 'identity')
    expect(identityBatches.length).toBe(2)
    expect(identityBatches[0]!.batch).toBe(1)
    expect(identityBatches[0]!.totalBatches).toBe(2)
    expect(identityBatches[1]!.batch).toBe(2)
  })

  it('works without onProgress callback', async () => {
    const client = mockClient()
    // Should not throw
    const result = await extractFeatures(client, 'test-model', singleChunk, 'Test')
    expect(result.identity).toBe('test content')
  })
})
