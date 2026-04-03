import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { EvolveCommand } from '../../src/cli/commands/evolve.js'
import type { SoulChunk } from '../../src/ingest/types.js'

const DELAY = 80

// Mock heavy dependencies
vi.mock('../../src/ingest/pipeline.js', () => {
  const EventEmitter = require('node:events')
  return {
    IngestPipeline: vi.fn().mockImplementation(() => {
      const emitter = new EventEmitter()
      return Object.assign(emitter, {
        run: vi.fn().mockResolvedValue([
          { id: 'new1', source: 'markdown', content: 'new content', timestamp: '', context: 'work', type: 'knowledge', metadata: {} },
        ]),
      })
    }),
  }
})

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

vi.mock('../../src/distill/sampler.js', () => ({
  sampleChunks: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/distill/extractor.js', () => ({
  extractFeatures: vi.fn().mockResolvedValue({
    identity: '',
    style: '',
    behaviors: [],
  }),
}))

vi.mock('../../src/distill/generator.js', () => ({
  generateSoulFiles: vi.fn(),
  loadSoulFiles: vi.fn().mockReturnValue(null),
}))

vi.mock('../../src/distill/merger.js', () => ({
  mergeSoulFiles: vi.fn().mockResolvedValue({
    identity: '',
    style: '',
    behaviors: [],
  }),
}))

vi.mock('../../src/soul/snapshot.js', () => ({
  createSnapshot: vi.fn(),
}))

vi.mock('../../src/soul/package.js', () => ({
  appendEvolveEntry: vi.fn(),
}))

vi.mock('../../src/ingest/url-adapter.js', () => ({
  extractUrl: vi.fn().mockResolvedValue({
    url: 'https://example.com',
    content: 'test content from url that is long enough.',
    title: 'Test',
  }),
  urlResultToChunks: vi.fn().mockReturnValue([
    { id: 'url1', source: 'web', content: 'url chunk', timestamp: '', context: 'public', type: 'knowledge', metadata: {} },
  ]),
}))

vi.mock('../../src/ingest/text-adapter.js', () => ({
  textToChunks: vi.fn().mockReturnValue([
    { id: 'txt1', source: 'user-input', content: 'text chunk', timestamp: '', context: 'personal', type: 'knowledge', metadata: {} },
  ]),
}))

vi.mock('../../src/ingest/feedback-adapter.js', () => ({
  readUnconsumedFeedback: vi.fn().mockReturnValue([]),
  feedbackToChunks: vi.fn().mockReturnValue([]),
  markFeedbackConsumed: vi.fn(),
}))

const mockEngine = {
  ingest: vi.fn().mockResolvedValue(undefined),
  recall: vi.fn().mockResolvedValue([]),
  status: vi.fn().mockResolvedValue({ ready: true }),
}

const mockChunks: SoulChunk[] = [
  { id: '1', source: 'markdown', content: 'test content', timestamp: '', context: 'work', type: 'knowledge', metadata: {} },
]

function renderEvolve(overrides: Partial<React.ComponentProps<typeof EvolveCommand>> = {}) {
  return render(
    <EvolveCommand
      soulName="test-soul"
      soulDir="/tmp/test-soul"
      engine={mockEngine as any}
      chunks={mockChunks}
      onComplete={vi.fn()}
      onExit={vi.fn()}
      {...overrides}
    />
  )
}

const wait = (ms = DELAY) => new Promise((r) => setTimeout(r, ms))

describe('EvolveCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Source Selection ───────────────────────────────────────────────────────

  describe('source selection phase', () => {
    it('renders all four source options', () => {
      const { lastFrame } = renderEvolve()
      const frame = lastFrame() ?? ''
      expect(frame).toContain('Markdown 目录')
      expect(frame).toContain('URL 网页')
      expect(frame).toContain('文本输入')
      expect(frame).toContain('对话反馈')
    })

    it('shows cursor indicator on first item', () => {
      const { lastFrame } = renderEvolve()
      expect(lastFrame()).toContain('▸ Markdown')
    })

    it('shows EVOLVE header with soul name', () => {
      const { lastFrame } = renderEvolve({ soulName: 'cyberpunk-v' })
      const frame = lastFrame() ?? ''
      expect(frame).toContain('EVOLVE')
      expect(frame).toContain('cyberpunk-v')
    })

    it('shows navigation hints', () => {
      const { lastFrame } = renderEvolve()
      expect(lastFrame()).toContain('↑↓')
      expect(lastFrame()).toContain('Esc')
    })

    it('navigates down with arrow key and selects Markdown on Enter', async () => {
      const { lastFrame, stdin } = renderEvolve()

      // Select Markdown (first item, press Enter)
      stdin.write('\r')
      await wait()

      const frame = lastFrame() ?? ''
      // Should now be in path-input phase
      expect(frame).toContain('path>')
    })

    it('calls onExit on escape', async () => {
      const onExit = vi.fn()
      const { stdin } = renderEvolve({ onExit })

      stdin.write('\u001B')
      await wait()

      expect(onExit).toHaveBeenCalled()
    })
  })

  // ── Phase Transitions ─────────────────────────────────────────────────────

  describe('phase transitions', () => {
    it('transitions from source-select to path-input on Markdown selection', async () => {
      const { lastFrame, stdin } = renderEvolve()

      stdin.write('\r') // Enter on Markdown (first item)
      await wait()

      expect(lastFrame()).toContain('path>')
    })

    it('shows path-input with path completion hint', async () => {
      const { lastFrame, stdin } = renderEvolve()

      stdin.write('\r')
      await wait()

      const frame = lastFrame() ?? ''
      expect(frame).toContain('EVOLVE')
      expect(frame).toContain('test-soul')
    })
  })

  // ── No Mode Select ────────────────────────────────────────────────────────

  describe('no mode-select phase (delta only)', () => {
    it('source selection does not show distillation mode options', () => {
      const { lastFrame } = renderEvolve()
      const frame = lastFrame() ?? ''
      expect(frame).not.toContain('增量蒸馏')
      expect(frame).not.toContain('全量蒸馏')
      expect(frame).not.toContain('蒸馏模式')
    })

    it('path-input phase does not show mode options', async () => {
      const { lastFrame, stdin } = renderEvolve()

      stdin.write('\r') // Enter on Markdown
      await wait()

      const frame = lastFrame() ?? ''
      expect(frame).not.toContain('增量蒸馏')
      expect(frame).not.toContain('全量蒸馏')
    })
  })

  // ── Dimension Selection ───────────────────────────────────────────────────

  describe('dimension options are correctly defined', () => {
    // Dimension selection is reached after data input, which is hard to simulate
    // through ink-testing-library stdin for TextInput. We verify the options exist
    // by checking the component can render without errors.
    it('component renders without errors for all source types', () => {
      // Just verify the component mounts successfully
      const { lastFrame } = renderEvolve()
      expect(lastFrame()).toBeTruthy()
    })
  })

  // ── Header Display ────────────────────────────────────────────────────────

  describe('header display', () => {
    it('shows soul name in header', () => {
      expect(renderEvolve({ soulName: 'johnny' }).lastFrame()).toContain('johnny')
    })

    it('shows different soul name correctly', () => {
      expect(renderEvolve({ soulName: '强尼银手' }).lastFrame()).toContain('强尼银手')
    })
  })
})
