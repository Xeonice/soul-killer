import type { SoulkillerConfig } from '../config/schema.js'
import type { SoulChunk } from '../infra/ingest/types.js'
import type { CaptureProgress, CaptureResult } from '../infra/agent/capture-strategy.js'
import type { DistillAgentProgress, DistillResult } from './distill/distill-agent.js'
import type { TagSet } from '../tags/taxonomy.js'
import type { SoulType } from './manifest.js'
import type { AgentPhase } from '../infra/agent/capture-strategy.js'
import type { DistillToolCallDisplay } from '../cli/components/distill-progress.js'
import type { ToolCallDisplay, SearchPlanDimDisplay } from '../cli/animation/soulkiller-protocol-panel.js'

// ========== Types ==========

export interface SoulInput {
  name: string
  description: string
}

export type SoulTaskPhase = 'pending' | 'capturing' | 'distilling' | 'done' | 'failed'

export interface SoulTaskStatus {
  name: string
  description: string
  phase: SoulTaskPhase
  /** Capture agent phase (only during capturing) */
  capturePhase?: AgentPhase
  classification?: string
  origin?: string
  toolCalls: ToolCallDisplay[]
  searchPlan?: SearchPlanDimDisplay[]
  filterProgress?: { kept: number; total: number }
  fragments: number
  /** Distill tool calls (only during distilling) */
  distillToolCalls: DistillToolCallDisplay[]
  distillPhase?: 'distilling' | 'complete'
  elapsedMs: number
  error?: string
  soulDir?: string
  chunks?: SoulChunk[]
}

export interface BatchResult {
  souls: SoulTaskStatus[]
  totalElapsedMs: number
}

export type BatchProgressEvent =
  | { soulName: string; type: 'phase'; phase: SoulTaskPhase }
  | { soulName: string; type: 'capture_progress'; progress: CaptureProgress }
  | { soulName: string; type: 'distill_progress'; progress: DistillAgentProgress }
  | { soulName: string; type: 'done'; soulDir: string }
  | { soulName: string; type: 'error'; error: string }

export type OnBatchProgress = (event: BatchProgressEvent) => void

type DataSourceOption = 'web-search' | 'markdown' | 'twitter'

// ========== Dependencies (injected for testability) ==========

export interface BatchPipelineDeps {
  captureSoul: (name: string, config: SoulkillerConfig, onProgress?: (p: CaptureProgress) => void, hint?: string) => Promise<CaptureResult>
  distillSoul: (name: string, soulDir: string, config: SoulkillerConfig, options: { sessionDir?: string; chunks?: SoulChunk[]; tags?: TagSet; onProgress?: (p: DistillAgentProgress) => void; agentLog?: any }) => Promise<DistillResult>
  createSyntheticChunks: (name: string, description: string, tags: TagSet) => SoulChunk[]
  packageSoul: (soulDir: string) => void
  generateManifest: (soulDir: string, name: string, displayName: string, description: string, chunkCount: number, languages?: string[], soulType?: SoulType, tags?: TagSet) => void
}

export interface BatchPipelineOptions {
  souls: SoulInput[]
  config: SoulkillerConfig
  dataSources: DataSourceOption[]
  soulType: SoulType
  soulsDir: string
  deps: BatchPipelineDeps
  onProgress?: OnBatchProgress
  maxConcurrency?: number
}

// ========== Pipeline ==========

const DEFAULT_MAX_CONCURRENCY = 3

export async function runBatchPipeline(options: BatchPipelineOptions): Promise<BatchResult> {
  const {
    souls,
    config,
    dataSources,
    soulType,
    soulsDir,
    deps,
    onProgress,
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  } = options

  const startTime = Date.now()
  const statuses = new Map<string, SoulTaskStatus>()

  // Initialize statuses
  for (const soul of souls) {
    statuses.set(soul.name, {
      name: soul.name,
      description: soul.description,
      phase: 'pending',
      toolCalls: [],
      distillToolCalls: [],
      fragments: 0,
      elapsedMs: 0,
    })
  }

  const queue = [...souls]
  const active = new Map<string, Promise<void>>()

  function updateStatus(name: string, update: Partial<SoulTaskStatus>) {
    const current = statuses.get(name)
    if (current) {
      statuses.set(name, { ...current, ...update })
    }
  }

  async function processSoul(soul: SoulInput): Promise<void> {
    const soulStart = Date.now()
    const soulDir = `${soulsDir}/${soul.name}`

    try {
      // Phase: capturing
      updateStatus(soul.name, { phase: 'capturing', capturePhase: 'initiating' })
      onProgress?.({ soulName: soul.name, type: 'phase', phase: 'capturing' })

      let captureSessionDir: string | undefined

      if (dataSources.includes('web-search')) {
        const capturePhaseRef = { current: 'initiating' as AgentPhase }

        const result = await deps.captureSoul(soul.name, config, (progress: CaptureProgress) => {
          onProgress?.({ soulName: soul.name, type: 'capture_progress', progress })

          if (progress.type === 'phase') {
            capturePhaseRef.current = progress.phase
            updateStatus(soul.name, { capturePhase: progress.phase })
          } else if (progress.type === 'tool_call') {
            const status = statuses.get(soul.name)!
            updateStatus(soul.name, {
              toolCalls: [...status.toolCalls, {
                tool: progress.tool,
                query: progress.query,
                status: 'running',
                phase: capturePhaseRef.current,
              }],
            })
          } else if (progress.type === 'tool_result') {
            const status = statuses.get(soul.name)!
            const updated = [...status.toolCalls]
            const last = updated.findLastIndex((tc) => tc.tool === progress.tool && tc.status === 'running')
            if (last !== -1) {
              updated[last] = { ...updated[last]!, status: 'done', resultCount: progress.resultCount }
            }
            updateStatus(soul.name, { toolCalls: updated })
          } else if (progress.type === 'classification') {
            updateStatus(soul.name, { classification: progress.classification, origin: progress.origin })
          } else if (progress.type === 'search_plan') {
            updateStatus(soul.name, { searchPlan: progress.dimensions })
          } else if (progress.type === 'filter_progress') {
            updateStatus(soul.name, { filterProgress: { kept: progress.kept, total: progress.total } })
          } else if (progress.type === 'chunks_extracted') {
            updateStatus(soul.name, { fragments: progress.count })
          }
        }, soul.description || undefined)

        result.agentLog?.close()
        captureSessionDir = result.sessionDir
        updateStatus(soul.name, {
          classification: result.classification,
          origin: result.origin,
          capturePhase: 'complete',
        })

        // Capture returned unknown — treat as failure so user can retry
        if (result.classification === 'UNKNOWN_ENTITY') {
          const elapsed = Date.now() - soulStart
          const reason = 'Capture failed: entity not found (UNKNOWN_ENTITY)'
          updateStatus(soul.name, { phase: 'failed', elapsedMs: elapsed, error: reason })
          onProgress?.({ soulName: soul.name, type: 'error', error: reason })
          onProgress?.({ soulName: soul.name, type: 'phase', phase: 'failed' })
          return
        }
      }

      // Create synthetic chunks (used as supplementary data alongside sessionDir)
      const { emptyTagSet } = await import('../tags/taxonomy.js')
      const syntheticChunks = deps.createSyntheticChunks(soul.name, soul.description, emptyTagSet())
      updateStatus(soul.name, { fragments: syntheticChunks.length, chunks: syntheticChunks })

      // Phase: distilling
      updateStatus(soul.name, { phase: 'distilling', distillPhase: 'distilling' })
      onProgress?.({ soulName: soul.name, type: 'phase', phase: 'distilling' })

      deps.packageSoul(soulDir)

      const distillResult = await deps.distillSoul(
        soul.name,
        soulDir,
        config,
        {
          sessionDir: captureSessionDir,
          chunks: syntheticChunks.length > 0 ? syntheticChunks : undefined,
          onProgress: (progress: DistillAgentProgress) => {
            onProgress?.({ soulName: soul.name, type: 'distill_progress', progress })

            if (progress.type === 'phase') {
              updateStatus(soul.name, { distillPhase: progress.phase })
            } else if (progress.type === 'tool_call') {
              const status = statuses.get(soul.name)!
              updateStatus(soul.name, {
                distillToolCalls: [...status.distillToolCalls, {
                  tool: progress.tool,
                  detail: progress.detail,
                  status: 'running',
                }],
              })
            } else if (progress.type === 'tool_result') {
              const status = statuses.get(soul.name)!
              const updated = [...status.distillToolCalls]
              const last = updated.findLastIndex((tc) => tc.tool === progress.tool && tc.status === 'running')
              if (last !== -1) {
                updated[last] = { ...updated[last]!, status: 'done', resultSummary: progress.resultSummary }
              }
              updateStatus(soul.name, { distillToolCalls: updated })
            }
          },
        },
      )

      distillResult.agentLog?.close()

      // Generate manifest
      const { emptyTagSet: getEmptyTags } = await import('../tags/taxonomy.js')
      const fragmentCount = (statuses.get(soul.name)?.fragments ?? 0) + syntheticChunks.length
      deps.generateManifest(soulDir, soul.name, soul.name, soul.description, fragmentCount, ['zh'], soulType, getEmptyTags())

      // Phase: done
      const elapsed = Date.now() - soulStart
      updateStatus(soul.name, { phase: 'done', elapsedMs: elapsed, soulDir, distillPhase: 'complete' })
      onProgress?.({ soulName: soul.name, type: 'done', soulDir })
      onProgress?.({ soulName: soul.name, type: 'phase', phase: 'done' })

    } catch (err) {
      const elapsed = Date.now() - soulStart
      const errorMsg = String(err)
      updateStatus(soul.name, { phase: 'failed', elapsedMs: elapsed, error: errorMsg })
      onProgress?.({ soulName: soul.name, type: 'error', error: errorMsg })
      onProgress?.({ soulName: soul.name, type: 'phase', phase: 'failed' })
    }
  }

  // Concurrency pool
  while (queue.length > 0 || active.size > 0) {
    // Fill slots
    while (queue.length > 0 && active.size < maxConcurrency) {
      const soul = queue.shift()!
      const promise = processSoul(soul).then(() => {
        active.delete(soul.name)
      })
      active.set(soul.name, promise)
    }

    // Wait for any to complete
    if (active.size > 0) {
      await Promise.race(active.values())
    }
  }

  return {
    souls: souls.map((s) => statuses.get(s.name)!),
    totalElapsedMs: Date.now() - startTime,
  }
}

// ========== Retry ==========

export async function retryFailedSouls(
  failedNames: string[],
  allSouls: SoulInput[],
  options: Omit<BatchPipelineOptions, 'souls'>,
): Promise<BatchResult> {
  const retryInputs = allSouls.filter((s) => failedNames.includes(s.name))
  return runBatchPipeline({ ...options, souls: retryInputs })
}
