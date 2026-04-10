import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { CreateCommand } from '../../src/cli/commands/soul/create.js'

// Mock heavy dependencies
vi.mock('../../src/config/loader.js', () => ({
  loadConfig: () => ({
    llm: {
      api_key: 'test-key',
      default_model: 'test-model',
      distill_model: 'test-model',
    },
  }),
}))

vi.mock('../../src/llm/client.js', () => ({
  getLLMClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{}' } }],
        }),
      },
    },
  }),
}))

vi.mock('../../src/soul/capture/soul-capture-agent.js', () => ({
  captureSoul: vi.fn().mockResolvedValue({
    classification: 'PUBLIC_ENTITY',
    origin: 'Test',
    chunks: [{ id: '1', source: 'web', content: 'test', timestamp: '', context: 'public', type: 'knowledge', metadata: {} }],
    elapsedMs: 1000,
  }),
}))

vi.mock('../../src/tags/parser.js', () => ({
  parseTags: vi.fn().mockResolvedValue({
    personality: ['INTJ'],
    communication: ['话少'],
    values: [],
    behavior: [],
    domain: [],
  }),
}))

// Track fs mock state
let mockSoulDirExists = false
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: (p: string) => {
        if (typeof p === 'string' && p.includes('.soulkiller/souls/') && !p.includes('manifest')) {
          return mockSoulDirExists
        }
        return actual.existsSync(p)
      },
      rmSync: vi.fn(),
      readFileSync: (p: string, enc?: string) => {
        if (typeof p === 'string' && p.includes('manifest.json')) {
          return JSON.stringify({
            name: 'test', display_name: 'test', version: '0.1.0',
            created_at: '2026-03-15T00:00:00Z', languages: ['zh'],
            description: '', chunk_count: 42, embedding_model: 'local',
            engine_version: '0.1.0', soulType: 'personal',
            tags: { personality: [], communication: [], values: [], behavior: [], domain: [] },
          })
        }
        return actual.readFileSync(p, enc as any)
      },
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
  }
})

vi.mock('../../src/soul/package.js', () => ({
  packageSoul: vi.fn(),
  readManifest: (dir: string) => {
    if (!mockSoulDirExists) return null
    return {
      name: 'test', display_name: 'test', version: '0.1.0',
      created_at: '2026-03-15T00:00:00Z', languages: ['zh'],
      description: '', chunk_count: 42, embedding_model: 'local',
      engine_version: '0.1.0', soulType: 'personal',
      tags: { personality: [], communication: [], values: [], behavior: [], domain: [] },
    }
  },
  generateManifest: vi.fn(),
}))

// Generous delay for ink rendering — needs headroom when vitest runs
// component tests in parallel. The multi-step wizard tests (type → name →
// desc → soul-list → tags → confirm) need enough time for each ink
// re-render cycle to complete before the next keystroke.
const DELAY = 200

describe('CreateCommand', () => {
  const onComplete = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSoulDirExists = false
  })

  it('renders type selection as first step', () => {
    const { lastFrame } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('SOULKILLER PROTOCOL')
    expect(frame).toContain('选择灵魂类型')
    expect(frame).toContain('个人灵魂')
    expect(frame).toContain('公开灵魂')
  })

  it('shows personal soul type selected by default', () => {
    const { lastFrame } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )
    const frame = lastFrame()!
    expect(frame).toContain('● ')
    expect(frame).toContain('○ ')
  })

  it('navigates to name step after pressing Enter', async () => {
    const { lastFrame, stdin } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )

    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))

    const frame = lastFrame()!
    expect(frame).toContain('Q1')
    expect(frame).toContain('灵魂目标')
    expect(frame).toContain('🔒 个人灵魂')
  })

  it('proceeds through name → description', async () => {
    const { lastFrame, stdin } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )

    // Select type
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))

    // Type name
    stdin.write('test')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))

    const frame = lastFrame()!
    expect(frame).toContain('Q2')
    expect(frame).toContain('一句话描述')
    expect(frame).toContain('test')
  })

  it('proceeds through description → soul-list → tags', async () => {
    const { lastFrame, stdin } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )

    // Select type → name → description
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('test')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('my friend')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))

    // Now at soul-list — verify it shows
    let frame = lastFrame()!
    expect(frame).toContain('test')
    expect(frame).toContain('my friend')

    // Select "continue" (down arrow to index 1, then Enter)
    stdin.write('\u001B[B') // down
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))

    frame = lastFrame()!
    expect(frame).toContain('Q3')
    expect(frame).toContain('性格/印象')
  })

  it('shows confirmation after skipping tags', async () => {
    const { lastFrame, stdin } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )

    // Select type → name → description → soul-list → continue → skip tags
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('test')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('my friend')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    // soul-list: select "continue" (index 1)
    stdin.write('\u001B[B') // down
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r')
    await new Promise((r) => setTimeout(r, DELAY))
    stdin.write('\r') // skip tags
    await new Promise((r) => setTimeout(r, 250))

    const frame = lastFrame()!
    expect(frame).toContain('信息汇总')
    expect(frame).toContain('test')
    expect(frame).toContain('个人灵魂')
    expect(frame).toContain('my friend')
    expect(frame).toContain('确认')
    expect(frame).toContain('修改')
  })

  it('calls onCancel on Esc', async () => {
    const { stdin } = render(
      <CreateCommand onComplete={onComplete} onCancel={onCancel} />
    )

    stdin.write('\u001B')
    await new Promise((r) => setTimeout(r, DELAY))
    expect(onCancel).toHaveBeenCalled()
  })

  describe('name conflict', () => {
    it('shows conflict options when soul already exists', async () => {
      mockSoulDirExists = true

      const { lastFrame, stdin } = render(
        <CreateCommand onComplete={onComplete} onCancel={onCancel} />
      )

      // Select type → name → description → soul-list → continue → skip tags → confirm
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('test')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip description
      await new Promise((r) => setTimeout(r, DELAY))
      // soul-list: select "continue"
      stdin.write('\u001B[B')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip tags
      await new Promise((r) => setTimeout(r, 250))
      stdin.write('\r') // confirm
      await new Promise((r) => setTimeout(r, DELAY))

      const frame = lastFrame()!
      expect(frame).toContain('灵魂已存在')
      expect(frame).toContain('覆盖重建')
      expect(frame).toContain('追加数据')
      expect(frame).toContain('换个名字')
    })

    it('shows existing soul metadata in conflict view', async () => {
      mockSoulDirExists = true

      const { lastFrame, stdin } = render(
        <CreateCommand onComplete={onComplete} onCancel={onCancel} />
      )

      // Navigate to conflict step: type → name → desc → soul-list → continue → skip tags → confirm
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('test')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip description
      await new Promise((r) => setTimeout(r, DELAY))
      // soul-list: select "continue"
      stdin.write('\u001B[B')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip tags
      await new Promise((r) => setTimeout(r, 250))
      stdin.write('\r') // confirm
      await new Promise((r) => setTimeout(r, DELAY))

      const frame = lastFrame()!
      expect(frame).toContain('个人灵魂')
      expect(frame).toContain('42')
      expect(frame).toContain('2026-03-15')
    })
  })

  describe('search confirm', () => {
    it('proceeds to data-sources without conflict when no existing soul', async () => {
      mockSoulDirExists = false

      const { lastFrame, stdin } = render(
        <CreateCommand onComplete={onComplete} onCancel={onCancel} />
      )

      // Navigate: type(personal) → name → skip desc → soul-list → continue → skip tags → confirm
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('newsoul')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip description
      await new Promise((r) => setTimeout(r, DELAY))
      // soul-list: select "continue"
      stdin.write('\u001B[B')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r')
      await new Promise((r) => setTimeout(r, DELAY))
      stdin.write('\r') // skip tags
      await new Promise((r) => setTimeout(r, 250))
      stdin.write('\r') // confirm
      await new Promise((r) => setTimeout(r, DELAY))

      const frame = lastFrame()!
      // Should go to data-sources (personal soul, no conflict)
      expect(frame).toContain('补充数据源')
    })
  })
})
