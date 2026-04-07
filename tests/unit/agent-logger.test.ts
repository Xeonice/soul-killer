import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { AgentLogger } from '../../src/utils/agent-logger.js'
import type { CaptureResult } from '../../src/agent/soul-capture-agent.js'

const TEST_LOG_DIR = path.join(os.tmpdir(), 'soulkiller-test-logs', 'agent')

// Override the log dir for testing by using a temp directory
function createTestLogger(prompt = 'Test prompt', config?: { model: string; provider: string; raw?: unknown }): AgentLogger {
  // We'll create the logger normally and it writes to ~/.soulkiller/logs/agent/
  // For testing, we create the logger and read the file it produces
  return new AgentLogger(prompt, config ?? { model: 'test-model', provider: 'test-provider' })
}

function readLogFile(logger: AgentLogger): string {
  logger.close()
  return fs.readFileSync(logger.filePath, 'utf-8')
}

describe('AgentLogger', () => {
  const createdFiles: string[] = []

  afterEach(() => {
    for (const f of createdFiles) {
      try { fs.unlinkSync(f) } catch { /* ignore */ }
    }
    createdFiles.length = 0
  })

  it('creates log file with correct naming format', () => {
    const logger = createTestLogger('Research Hideo Kojima')
    createdFiles.push(logger.filePath)

    expect(fs.existsSync(logger.filePath)).toBe(true)

    const fileName = path.basename(logger.filePath)
    // Format: YYYY-MM-DDTHH-mm-ss_{hash8}.log
    expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-f0-9]{8}\.log$/)

    logger.close()
  })

  it('writes META header with prompt, model, and provider', () => {
    const logger = createTestLogger('Research test target', {
      model: 'qwen/qwen3-235b',
      provider: 'searxng',
      raw: { temperature: 0 },
    })
    createdFiles.push(logger.filePath)

    const content = readLogFile(logger)

    expect(content).toContain('SOULKILLER AGENT LOG')
    expect(content).toContain('[META]')
    expect(content).toContain('Prompt   : Research test target')
    expect(content).toContain('Model    : qwen/qwen3-235b')
    expect(content).toContain('Provider : searxng')
    expect(content).toContain('"temperature":0')
  })

  it('logs step boundaries with phase', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    logger.startStep(2, 'classifying')

    const content = readLogFile(logger)

    expect(content).toContain('STEP 1 — Phase: searching')
    expect(content).toContain('STEP 2 — Phase: classifying')
  })

  it('logs model text output', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    logger.modelOutput('I will search for ')
    logger.modelOutput('information about the target.')
    logger.startStep(2, 'searching') // triggers flush of step 1

    const content = readLogFile(logger)

    expect(content).toContain('Model Output')
    expect(content).toContain('I will search for information about the target.')
  })

  it('does not write model output section when no text', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    // No modelOutput calls
    logger.toolCall('search', { query: 'test' })

    const content = readLogFile(logger)

    // Should not have a Model Output section before the tool call
    const stepIdx = content.indexOf('STEP 1')
    const toolIdx = content.indexOf('Tool Call: search')
    const modelIdx = content.indexOf('Model Output', stepIdx)

    // Model Output should either not exist or come after the tool call
    if (modelIdx !== -1) {
      expect(modelIdx).toBeGreaterThan(toolIdx)
    }
  })

  it('logs tool calls with input JSON', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    logger.toolCall('search', { query: 'Hideo Kojima' })

    const content = readLogFile(logger)

    expect(content).toContain('Tool Call: search')
    expect(content).toContain('"query":"Hideo Kojima"')
  })

  it('logs tool internal details', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    logger.toolCall('search', { query: 'test' })
    logger.toolInternal('Provider: searxng')
    logger.toolInternal('Raw results: 10', { durationMs: 500 })

    const content = readLogFile(logger)

    expect(content).toContain('[INTERNAL] Provider: searxng')
    expect(content).toContain('[INTERNAL] Raw results: 10 {"durationMs":500}')
  })

  it('logs tool results with duration and full JSON', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    logger.startStep(1, 'searching')
    logger.toolCall('search', { query: 'test' })
    logger.toolResult('search', { results: [{ title: 'Result 1', url: 'https://example.com', content: 'text' }] }, 1234)

    const content = readLogFile(logger)

    expect(content).toContain('1 results')
    expect(content).toContain('Full JSON')
    expect(content).toContain('Duration: 1234ms')
  })

  it('writes RESULT block', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    const result: CaptureResult = {
      classification: 'PUBLIC_ENTITY',
      origin: 'Game Designer',
      sessionDir: '/tmp/test-session',
      elapsedMs: 45678,
    }

    logger.writeResult(result, 12)

    const content = readLogFile(logger)

    expect(content).toContain('RESULT')
    expect(content).toContain('Classification : PUBLIC_ENTITY')
    expect(content).toContain('Origin         : Game Designer')
    expect(content).toContain('Session Dir    : /tmp/test-session')
    expect(content).toContain('Total Steps    : 12')
    expect(content).toContain('Total Duration : 45678ms')
  })

  it('writes ANALYSIS block with dimension coverage and search statistics', () => {
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)

    // Simulate some tool calls to populate internal tracking
    logger.startStep(1, 'searching')
    logger.toolCall('search', { query: 'query 1' })
    logger.toolResult('search', { results: [{ url: 'https://a.com' }, { url: 'https://b.com' }] }, 100)
    logger.toolCall('search', { query: 'query 2' })
    logger.toolResult('search', { results: [{ url: 'https://a.com' }] }, 200)

    const result: CaptureResult = {
      classification: 'PUBLIC_ENTITY',
      chunks: [],
      elapsedMs: 5000,
    }

    const extractions = [
      { dimension: 'identity', content: 'bio info' },
      { dimension: 'identity', content: 'more bio' },
      { dimension: 'quotes', content: 'famous quote' },
      { dimension: 'expression', content: 'speaking style' },
    ]

    logger.writeAnalysis(result, extractions)

    const content = readLogFile(logger)

    expect(content).toContain('ANALYSIS')
    expect(content).toContain('Dimension Coverage')
    expect(content).toContain('identity')
    expect(content).toContain('quotes')
    expect(content).toContain('Search Statistics')
    expect(content).toContain('Unique queries    : 2')
    expect(content).toContain('Duplicate queries : 0')
    expect(content).toContain('Unique URLs       : 2')
    expect(content).toContain('Tool Call Timeline')
  })

  it('handles constructor failure gracefully', () => {
    // AgentLogger should not throw even if path is bad
    // We can't easily test a bad path without mocking fs, but we can verify
    // that close() on a null fd doesn't throw
    const logger = createTestLogger()
    createdFiles.push(logger.filePath)
    logger.close()
    // Calling close twice should not throw
    logger.close()
  })
})
