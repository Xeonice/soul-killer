import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { logger } from './logger.js'
import type { CaptureResult } from '../agent/soul-capture-agent.js'

const LOGS_ROOT = path.join(os.homedir(), '.soulkiller', 'logs')
const DEFAULT_SUBDIR = 'agent'

export interface ToolTimelineEntry {
  step: number
  tool: string
  inputSummary: string
  resultSummary: string
  durationMs: number
}

interface ExtractionForAnalysis {
  dimension: string
  content: string
}

/**
 * Per-session logger for Agent Loop.
 * Creates an independent log file for each captureSoul invocation.
 */
export class AgentLogger {
  private fd: number | null = null
  private textBuffer = ''
  private currentStep = 0
  private stepStartTime = 0
  private toolTimeline: ToolTimelineEntry[] = []
  private allQueries: string[] = []
  private allUrls: string[] = []
  private pageExtractions = { success: 0, failed: 0 }
  private distillPhaseStart = 0
  readonly filePath: string

  constructor(prompt: string, config: { model: string; provider: string; raw?: unknown; subdir?: string }) {
    const now = new Date()
    const ts = now.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '')
    const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 8)
    const fileName = `${ts}_${hash}.log`
    const logDir = path.join(LOGS_ROOT, config.subdir ?? DEFAULT_SUBDIR)
    this.filePath = path.join(logDir, fileName)

    try {
      fs.mkdirSync(logDir, { recursive: true })
      this.fd = fs.openSync(this.filePath, 'w')

      this.writeLine('══════════════════════════════════════════════════════')
      this.writeLine(' SOULKILLER AGENT LOG')
      this.writeLine('══════════════════════════════════════════════════════')
      this.writeLine('')
      this.writeLine('[META]')
      this.writeLine(`  Prompt   : ${prompt}`)
      this.writeLine(`  Time     : ${now.toISOString()}`)
      this.writeLine(`  Model    : ${config.model}`)
      this.writeLine(`  Provider : ${config.provider}`)
      if (config.raw) {
        this.writeLine(`  Config   : ${JSON.stringify(config.raw)}`)
      }
      this.writeLine('')
    } catch (err) {
      logger.warn('[AgentLogger] Failed to create log file:', err)
      this.fd = null
    }
  }

  startStep(stepNumber: number, phase: string): void {
    // Flush any pending text from previous step
    this.flushTextBuffer()

    if (this.currentStep > 0 && this.stepStartTime > 0) {
      const dur = Date.now() - this.stepStartTime
      this.writeLine(`── Step Duration: ${dur}ms ──────────────────────────────`)
      this.writeLine('')
    }

    this.currentStep = stepNumber
    this.stepStartTime = Date.now()
    this.textBuffer = ''

    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(` STEP ${stepNumber} — Phase: ${phase}`)
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')
  }

  modelOutput(text: string): void {
    this.textBuffer += text
  }

  toolCall(toolName: string, input: unknown): void {
    // Flush accumulated model text before tool call
    this.flushTextBuffer()

    this.writeLine(`── Tool Call: ${toolName} ─────────────────────────────`)
    this.writeLine(`  Input: ${JSON.stringify(input)}`)
    this.writeLine('')

    // Track queries for analysis
    if (toolName === 'search') {
      const q = (input as { query?: string })?.query
      if (q) this.allQueries.push(q)
    }
  }

  toolInternal(message: string, data?: unknown): void {
    const suffix = data ? ` ${JSON.stringify(data)}` : ''
    this.writeLine(`  [INTERNAL] ${message}${suffix}`)
  }

  toolResult(toolName: string, output: unknown, durationMs: number): void {
    // Build human-readable summary
    const summary = this.summarizeOutput(toolName, output)
    this.writeLine('')
    this.writeLine(`  Output${summary ? ` (${summary})` : ''}:`)

    // Track URLs for analysis
    if (toolName === 'search') {
      const results = (output as { results?: { url?: string }[] })?.results ?? []
      for (const r of results) {
        if (r.url) this.allUrls.push(r.url)
      }
    } else if (toolName === 'extractPage') {
      const content = (output as { content?: string })?.content
      if (content && content !== 'Failed to extract page content.') {
        this.pageExtractions.success++
      } else {
        this.pageExtractions.failed++
      }
    }

    // Full JSON block
    this.writeLine('')
    this.writeLine('  ──── Full JSON ────')
    this.writeLine(`  ${JSON.stringify(output)}`)
    this.writeLine('')
    this.writeLine(`  Duration: ${durationMs}ms`)
    this.writeLine('')

    // Add to timeline
    this.toolTimeline.push({
      step: this.currentStep,
      tool: toolName,
      inputSummary: this.summarizeInput(toolName, output),
      resultSummary: summary,
      durationMs,
    })
  }

  writeResult(result: CaptureResult, stepCount: number): void {
    // Close last step
    this.flushTextBuffer()
    if (this.currentStep > 0 && this.stepStartTime > 0) {
      const dur = Date.now() - this.stepStartTime
      this.writeLine(`── Step Duration: ${dur}ms ──────────────────────────────`)
      this.writeLine('')
    }

    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(' RESULT')
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')
    this.writeLine(`  Classification : ${result.classification}`)
    this.writeLine(`  Origin         : ${result.origin ?? 'N/A'}`)
    this.writeLine(`  Session Dir    : ${result.sessionDir ?? 'N/A'}`)
    this.writeLine(`  Total Steps    : ${stepCount}`)
    this.writeLine(`  Total Duration : ${result.elapsedMs}ms (${(result.elapsedMs / 1000).toFixed(1)}s)`)
    this.writeLine('')
  }

  writeAnalysis(result: CaptureResult, extractions?: ExtractionForAnalysis[]): void {
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(' ANALYSIS')
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')

    // Dimension coverage — dynamically from actual extractions (not hardcoded)
    if (extractions && extractions.length > 0) {
      const dims: Record<string, number> = {}
      for (const e of extractions) {
        dims[e.dimension] = (dims[e.dimension] ?? 0) + 1
      }

      this.writeLine('  Dimension Coverage:')
      const maxCount = Math.max(...Object.values(dims), 1)
      for (const [dim, count] of Object.entries(dims)) {
        const barLen = Math.round((count / maxCount) * 10)
        const bar = '\u2588'.repeat(barLen).padEnd(10)
        const indicator = count >= 2 ? '\u2705' : '\u26A0\uFE0F'
        this.writeLine(`    ${dim.padEnd(20)}: ${bar} ${String(count).padStart(2)} extractions ${indicator}`)
      }
      this.writeLine('')
    }

    // Search statistics
    const uniqueQueries = [...new Set(this.allQueries)]
    const duplicates = this.allQueries.length - uniqueQueries.length
    const uniqueUrls = [...new Set(this.allUrls)]
    const totalPageExtractions = this.pageExtractions.success + this.pageExtractions.failed

    this.writeLine('  Search Statistics:')
    this.writeLine(`    Unique queries    : ${uniqueQueries.length}`)
    this.writeLine(`    Duplicate queries : ${duplicates}`)
    this.writeLine(`    Total tool calls  : ${this.toolTimeline.length}`)
    this.writeLine(`    Unique URLs       : ${uniqueUrls.length}`)
    if (totalPageExtractions > 0) {
      this.writeLine(`    Page extractions  : ${totalPageExtractions} (${this.pageExtractions.success} success, ${this.pageExtractions.failed} failed)`)
    }
    this.writeLine('')

    // Tool call timeline
    if (this.toolTimeline.length > 0) {
      this.writeLine('  Tool Call Timeline:')
      for (const entry of this.toolTimeline) {
        const stepStr = `Step ${String(entry.step).padStart(2)}`
        const toolStr = entry.tool.padEnd(14)
        this.writeLine(`    ${stepStr}: ${toolStr} → ${entry.resultSummary.padEnd(16)} | ${entry.durationMs}ms`)
      }
      this.writeLine('')
    }
  }

  // -- Distill phase logging --

  distillStart(config: { model: string; totalChunks: number; sampledChunks: number }): void {
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(' DISTILL')
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')
    this.writeLine(`  Model          : ${config.model}`)
    this.writeLine(`  Total Chunks   : ${config.totalChunks}`)
    this.writeLine(`  Sampled Chunks : ${config.sampledChunks}`)
    this.writeLine('')
  }

  distillPhase(phase: string, status: 'started' | 'done', detail?: string): void {
    if (status === 'started') {
      this.distillPhaseStart = Date.now()
      this.writeLine(`── Distill Phase: ${phase} ──────────────────────────`)
      if (detail) this.writeLine(`  ${detail}`)
    } else {
      const dur = this.distillPhaseStart > 0 ? Date.now() - this.distillPhaseStart : 0
      this.writeLine(`  ✓ ${phase} done (${dur}ms)`)
      this.writeLine('')
    }
  }

  distillBatch(phase: string, batch: number, totalBatches: number, durationMs: number, outputLen: number): void {
    this.writeLine(`  [BATCH ${batch}/${totalBatches}] ${phase} → ${outputLen} chars (${durationMs}ms)`)
  }

  distillMerge(phase: string, inputCount: number, durationMs: number, outputLen: number): void {
    this.writeLine(`  [MERGE] ${phase}: ${inputCount} batches → ${outputLen} chars (${durationMs}ms)`)
  }

  distillGenerate(files: string[]): void {
    this.writeLine('── Distill Phase: generate ──────────────────────────')
    for (const f of files) {
      this.writeLine(`  → ${f}`)
    }
    this.writeLine('  ✓ generate done')
    this.writeLine('')
  }

  distillEnd(result: { identity: number; style: number; behaviors: number; totalDurationMs: number }): void {
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(' DISTILL RESULT')
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')
    this.writeLine(`  Identity       : ${result.identity} chars`)
    this.writeLine(`  Style          : ${result.style} chars`)
    this.writeLine(`  Behaviors      : ${result.behaviors} files`)
    this.writeLine(`  Total Duration : ${result.totalDurationMs}ms (${(result.totalDurationMs / 1000).toFixed(1)}s)`)
    this.writeLine('')
  }

  worldDistillEnd(result: { entries: number; dimensions: number; totalDurationMs: number }): void {
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine(' WORLD DISTILL RESULT')
    this.writeLine('══════════════════════════════════════════════════════')
    this.writeLine('')
    this.writeLine(`  Entries        : ${result.entries}`)
    this.writeLine(`  Dimensions     : ${result.dimensions}`)
    this.writeLine(`  Total Duration : ${result.totalDurationMs}ms (${(result.totalDurationMs / 1000).toFixed(1)}s)`)
    this.writeLine('')
  }

  close(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd)
      } catch {
        // ignore close errors
      }
      this.fd = null
    }
  }

  // -- Internal helpers --

  private flushTextBuffer(): void {
    if (this.textBuffer.trim()) {
      this.writeLine('── Model Output ──────────────────────────────────────')
      this.writeLine(this.textBuffer.trim())
      this.writeLine('')
    }
    this.textBuffer = ''
  }

  private writeLine(line: string): void {
    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, line + '\n')
      } catch {
        // silent fail — don't crash agent
      }
    }
  }

  private summarizeOutput(toolName: string, output: unknown): string {
    if (toolName === 'search') {
      const results = (output as { results?: unknown[] })?.results
      return results ? `${results.length} results` : '0 results'
    }
    if (toolName === 'extractPage') {
      const content = (output as { content?: string })?.content
      if (!content || content === 'Failed to extract page content.') return 'failed'
      return `${content.length} chars`
    }
    if (toolName === 'planSearch') {
      const dims = (output as { dimensions?: unknown[] })?.dimensions
      return dims ? `${dims.length} dimensions` : '1 plan'
    }
    if (toolName === 'checkCoverage') {
      const total = (output as { totalCovered?: number })?.totalCovered ?? 0
      const can = (output as { canReport?: boolean })?.canReport
      return `${total}/6 dims${can ? ', canReport' : ''}`
    }
    if (toolName === 'reportFindings') {
      const exts = (output as { extractions?: unknown[] })?.extractions
      return exts ? `${exts.length} extractions` : 'END'
    }
    return ''
  }

  private summarizeInput(toolName: string, _output: unknown): string {
    // For timeline, we use the last toolCall's input — stored in allQueries for search
    if (toolName === 'search' && this.allQueries.length > 0) {
      return `"${this.allQueries[this.allQueries.length - 1]}"`
    }
    return toolName
  }
}

/** Log directory path for capture/distill agents — used by cleanup */
export const AGENT_LOG_DIR = path.join(LOGS_ROOT, DEFAULT_SUBDIR)
/** Log directory path for export agent */
export const EXPORT_LOG_DIR = path.join(LOGS_ROOT, 'export')
