import React, { useState, useEffect, useRef } from 'react'
import { Text, Box, useInput } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TextInput, CheckboxSelect } from '../../components/text-input.js'
import { SoulkillerProtocolPanel } from '../../animation/soulkiller-protocol-panel.js'
import { BatchProtocolPanel } from '../../animation/batch-protocol-panel.js'
import { DistillProgressPanel, type DistillToolCallDisplay } from '../../components/distill-progress.js'
import { IngestPipeline } from '../../../infra/ingest/pipeline.js'
import type { AdapterType } from '../../../infra/ingest/pipeline.js'
import { distillSoul, type DistillAgentProgress } from '../../../soul/distill/distill-agent.js'
import { getLLMClient } from '../../../infra/llm/client.js'
import { loadConfig } from '../../../config/loader.js'
import { generateManifest, packageSoul, readManifest } from '../../../soul/package.js'
import { captureSoul, type CaptureProgress } from '../../../soul/capture/soul-capture-agent.js'
import { runBatchPipeline, retryFailedSouls, type SoulInput, type SoulTaskStatus, type BatchResult, type BatchProgressEvent } from '../../../soul/batch-pipeline.js'
import type { ToolCallDisplay, AgentPhase, SearchPlanDimDisplay } from '../../animation/soulkiller-protocol-panel.js'
import { PRIMARY, ACCENT, DIM, DARK, WARNING } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import type { IngestProgress, SoulChunk } from '../../../infra/ingest/types.js'
import type { SoulType, SoulManifest } from '../../../soul/manifest.js'
import { type TagSet, emptyTagSet } from '../../../soul/tags/taxonomy.js'
import { parseTags } from '../../../soul/tags/parser.js'
import { createSyntheticChunks } from '../../../infra/ingest/synthetic-adapter.js'
import { sampleChunks } from '../../../soul/distill/sampler.js'
import { extractFeatures } from '../../../soul/distill/extractor.js'
import { mergeSoulFiles, type MergeInput } from '../../../soul/distill/merger.js'
import { generateSoulFiles, loadSoulFiles } from '../../../soul/distill/generator.js'
import { createSnapshot } from '../../../soul/snapshot.js'
import { appendEvolveEntry } from '../../../soul/package.js'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

function getClassificationLabels(): Record<string, string> {
  return {
    DIGITAL_CONSTRUCT: t('create.class.digital_construct'),
    PUBLIC_ENTITY: t('create.class.public_entity'),
    HISTORICAL_RECORD: t('create.class.historical_record'),
    UNKNOWN_ENTITY: t('create.class.unknown'),
  }
}

type CreateStep =
  | 'type-select'     // Choose personal or public
  | 'name'
  | 'description'     // Q2: one-line description (optional)
  | 'soul-list'       // Batch: show added souls, add more or continue
  | 'tags'            // Q3: personality/impression tags (optional)
  | 'confirm'         // Summary confirmation
  | 'name-conflict'   // Existing soul detected
  | 'capturing'       // Agent soul capture in progress
  | 'search-confirm'  // Confirm search results
  | 'search-detail'   // View search result details
  | 'data-sources'    // Optional data source selection
  | 'source-path'
  | 'ingesting'
  | 'distilling'
  | 'batch-capturing' // Batch: parallel capture + distill in progress
  | 'batch-summary'   // Batch: results summary
  | 'done'
  | 'error'

type DataSourceOption = 'web-search' | 'markdown' | 'twitter'
type ConflictChoice = 'overwrite' | 'append' | 'rename'
type SearchConfirmChoice = 'confirm' | 'retry' | 'detail'

interface CreateCommandProps {
  onComplete: (soulName: string, soulDir: string) => void
  onCancel: () => void
  /** When provided, enter supplement mode (skip to data-sources, merge after distill) */
  supplementSoul?: { name: string; dir: string }
}

export function CreateCommand({ onComplete, onCancel, supplementSoul }: CreateCommandProps) {
  // If supplementSoul provided, load manifest and start at data-sources
  const initState = (() => {
    if (supplementSoul) {
      const manifest = readManifest(supplementSoul.dir)
      if (manifest) {
        return {
          step: 'data-sources' as CreateStep,
          soulType: manifest.soulType,
          soulName: manifest.name,
          description: manifest.description,
          tags: manifest.tags,
        }
      }
    }
    return {
      step: 'type-select' as CreateStep,
      soulType: 'public' as SoulType,
      soulName: '',
      description: '',
      tags: emptyTagSet(),
    }
  })()

  const [step, setStep] = useState<CreateStep>(initState.step)
  const [soulType, setSoulType] = useState<SoulType>(initState.soulType)
  const [soulName, setSoulName] = useState(initState.soulName)
  const [description, setDescription] = useState(initState.description)
  const [parsedTags, setParsedTags] = useState<TagSet>(initState.tags)
  const [tagsRaw, setTagsRaw] = useState('')
  const [parsingTags, setParsingTags] = useState(false)
  const [selectedSources, setSelectedSources] = useState<DataSourceOption[]>([])
  const [sourcePaths, setSourcePaths] = useState<Map<DataSourceOption, string>>(new Map())
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [chunkCount, setChunkCount] = useState(0)
  const [error, setError] = useState('')

  // Type select state
  const [typeCursor, setTypeCursor] = useState(0)

  // Confirm state
  const [confirmCursor, setConfirmCursor] = useState(0)

  // Name conflict state
  const [conflictCursor, setConflictCursor] = useState(0)
  const [existingManifest, setExistingManifest] = useState<SoulManifest | null>(null)
  const [appendChunks, setAppendChunks] = useState<SoulChunk[]>([])

  // Search confirm state
  const [searchConfirmCursor, setSearchConfirmCursor] = useState(0)
  const [detailScroll, setDetailScroll] = useState(0)
  const [filterProgress, setFilterProgress] = useState<{ kept: number; total: number } | undefined>()
  const [errorCursor, setErrorCursor] = useState(0)

  // Agent state
  const [classification, setClassification] = useState<string | undefined>()
  const [origin, setOrigin] = useState<string | undefined>()
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([])
  const [protocolPhase, setProtocolPhase] = useState<AgentPhase>('initiating')
  const currentPhaseRef = useRef<AgentPhase>('initiating')
  const [agentChunks, setAgentChunks] = useState<SoulChunk[]>([])
  const [agentElapsed, setAgentElapsed] = useState(0)
  const [searchPlan, setSearchPlan] = useState<SearchPlanDimDisplay[]>([])
  const [agentSessionDir, setAgentSessionDir] = useState<string | undefined>()
  const [capturedDimensions, setCapturedDimensions] = useState<any[] | undefined>()
  const [dimBreakdown, setDimBreakdown] = useState<Record<string, number>>({})

  const agentLogRef = useRef<import('../../../infra/utils/agent-logger.js').AgentLogger | undefined>(undefined)

  // Distill progress state
  const [distillToolCalls, setDistillToolCalls] = useState<DistillToolCallDisplay[]>([])
  const [distillPhase, setDistillPhase] = useState<'distilling' | 'complete'>('distilling')

  // Batch state
  const [soulInputs, setSoulInputs] = useState<SoulInput[]>([])
  const [soulListCursor, setSoulListCursor] = useState(0)
  const [batchStatuses, setBatchStatuses] = useState<SoulTaskStatus[]>([])
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [batchSummaryCursor, setBatchSummaryCursor] = useState(0)

  // Unified input handler
  useInput((_input, key) => {
    // Esc during processing phases
    if (key.escape && (step === 'capturing' || step === 'ingesting' || step === 'distilling')) {
      onCancel()
      return
    }
    // batch-capturing: Esc is handled inside BatchProtocolPanel
    // (detail → compact via internal state, compact → cancel via onCancel prop)

    // Type selection
    if (step === 'type-select') {
      if (key.escape) { onCancel(); return }
      if (key.upArrow) setTypeCursor(0)
      if (key.downArrow) setTypeCursor(1)
      if (key.return) {
        const selected: SoulType = typeCursor === 0 ? 'personal' : 'public'
        setSoulType(selected)
        setStep('name')
      }
      return
    }

    // Confirm
    if (step === 'confirm') {
      if (key.escape) { onCancel(); return }
      if (key.leftArrow) setConfirmCursor(0)
      if (key.rightArrow) setConfirmCursor(1)
      if (key.return) {
        if (confirmCursor === 0) {
          checkNameConflict()
        } else {
          setStep('name')
        }
      }
      return
    }

    // Name conflict
    if (step === 'name-conflict') {
      if (key.escape) { onCancel(); return }
      if (key.upArrow) setConflictCursor((c) => Math.max(0, c - 1))
      if (key.downArrow) setConflictCursor((c) => Math.min(2, c + 1))
      if (key.return) {
        const choices: ConflictChoice[] = ['overwrite', 'append', 'rename']
        handleConflictChoice(choices[conflictCursor]!)
      }
      return
    }

    // Search confirm
    if (step === 'search-confirm') {
      if (key.escape) { onCancel(); return }
      if (key.upArrow) setSearchConfirmCursor((c) => Math.max(0, c - 1))
      if (key.downArrow) setSearchConfirmCursor((c) => Math.min(1, c + 1))
      if (key.return) {
        const choices: SearchConfirmChoice[] = ['confirm', 'retry']
        handleSearchConfirmChoice(choices[searchConfirmCursor]!)
      }
      return
    }

    // Search detail view
    if (step === 'search-detail') {
      if (key.escape || key.return) {
        setDetailScroll(0)
        setStep('search-confirm')
        return
      }
      if (key.upArrow) setDetailScroll((s) => Math.max(0, s - 1))
      if (key.downArrow) setDetailScroll((s) => Math.min(Math.max(0, agentChunks.length - 1), s + 1))
      return
    }

    // Soul list (batch management)
    if (step === 'soul-list') {
      if (key.escape) { onCancel(); return }
      const menuItems = soulInputs.length > 1
        ? ['add', 'continue', 'remove'] as const
        : ['add', 'continue'] as const
      if (key.upArrow) setSoulListCursor((c) => Math.max(0, c - 1))
      if (key.downArrow) setSoulListCursor((c) => Math.min(menuItems.length - 1, c + 1))
      if (key.return) {
        const choice = menuItems[soulListCursor]
        if (choice === 'add') {
          // Go back to name step for next soul
          setSoulName('')
          setDescription('')
          setStep('name')
        } else if (choice === 'continue') {
          if (soulInputs.length === 1) {
            // Single soul: restore name/description and go to original flow
            setSoulName(soulInputs[0]!.name)
            setDescription(soulInputs[0]!.description)
            setStep('tags')
          } else {
            // Multiple souls: skip tags, go to data-sources
            setStep('data-sources')
          }
        } else if (choice === 'remove') {
          setSoulInputs((prev) => prev.slice(0, -1))
          setSoulListCursor(0)
        }
      }
      return
    }

    // Batch summary
    if (step === 'batch-summary') {
      if (key.escape) { onCancel(); return }
      const hasFailures = batchResult?.souls.some((s) => s.phase === 'failed')
      const menuItems = hasFailures ? ['finish', 'retry', 'detail'] : ['finish', 'detail']
      if (key.upArrow) setBatchSummaryCursor((c) => Math.max(0, c - 1))
      if (key.downArrow) setBatchSummaryCursor((c) => Math.min(menuItems.length - 1, c + 1))
      if (key.return) {
        const choice = menuItems[batchSummaryCursor]
        if (choice === 'finish') {
          // Call onComplete for each successful soul
          for (const soul of batchResult?.souls ?? []) {
            if (soul.phase === 'done' && soul.soulDir) {
              onComplete(soul.name, soul.soulDir)
            }
          }
          setStep('done')
        } else if (choice === 'retry') {
          handleBatchRetry()
        } else if (choice === 'detail') {
          // Switch to batch-capturing view for review
          setStep('batch-capturing')
        }
      }
      return
    }

    // Error screen
    if (step === 'error') {
      if (key.escape) { onCancel(); return }
      if (key.upArrow) setErrorCursor(0)
      if (key.downArrow) setErrorCursor(1)
      if (key.return) {
        if (errorCursor === 0) {
          retryFlow()
        } else {
          onCancel()
        }
      }
      return
    }
  })

  function checkNameConflict() {
    const soulDir = path.join(SOULS_DIR, soulName)
    if (fs.existsSync(soulDir)) {
      const manifest = readManifest(soulDir)
      setExistingManifest(manifest)
      setConflictCursor(0)
      setStep('name-conflict')
    } else {
      proceedAfterConflictCheck()
    }
  }

  function proceedAfterConflictCheck() {
    setStep('data-sources')
  }

  function handleConflictChoice(choice: ConflictChoice) {
    if (choice === 'overwrite') {
      const soulDir = path.join(SOULS_DIR, soulName)
      fs.rmSync(soulDir, { recursive: true, force: true })
      proceedAfterConflictCheck()
    } else if (choice === 'append') {
      // Read existing chunks for merge
      const chunksPath = path.join(SOULS_DIR, soulName, 'chunks.json')
      try {
        if (fs.existsSync(chunksPath)) {
          const raw = fs.readFileSync(chunksPath, 'utf-8')
          const chunks = JSON.parse(raw) as SoulChunk[]
          setAppendChunks(chunks)
        }
      } catch {
        // Failed to read, will proceed without existing chunks
      }
      proceedAfterConflictCheck()
    } else {
      // rename — back to name step
      setStep('name')
    }
  }

  function handleSearchConfirmChoice(choice: SearchConfirmChoice) {
    if (choice === 'confirm') {
      // Continue to local sources if any were selected, otherwise distill
      proceedToLocalSources()
    } else if (choice === 'retry') {
      setAgentChunks([])
      setToolCalls([])
      currentPhaseRef.current = 'initiating'
      setClassification(undefined)
      setOrigin(undefined)
      setChunkCount(0)
      setSearchPlan([])
      setAgentSessionDir(undefined)
      setCapturedDimensions(undefined)
      setDimBreakdown({})
      setStep('capturing')
      setProtocolPhase('initiating')
      runAgentCapture(soulName)
    }
  }

  function handleNameSubmit(name: string) {
    if (!name.trim()) return
    setSoulName(name.trim())
    setStep('description')
  }

  function handleDescriptionSubmit(value: string) {
    setDescription(value.trim())
    // Add current soul to soulInputs and go to soul-list
    const newInput: SoulInput = { name: soulName, description: value.trim() }
    setSoulInputs((prev) => [...prev, newInput])
    setStep('soul-list')
  }

  async function handleTagsSubmit(value: string) {
    setTagsRaw(value.trim())
    if (!value.trim()) {
      setParsedTags(emptyTagSet())
      setStep('confirm')
      return
    }

    setParsingTags(true)
    try {
      const config = loadConfig()
      if (config) {
        const client = getLLMClient()
        const tags = await parseTags(value.trim(), client)
        setParsedTags(tags)
      }
    } catch {
      // Parsing failed, proceed with empty tags
    }
    setParsingTags(false)
    setStep('confirm')
  }

  function retryFlow() {
    // Reset agent state but preserve user inputs (soulName, soulType, description, etc.)
    setToolCalls([])
    setClassification(undefined)
    setOrigin(undefined)
    setAgentChunks([])
    setAgentElapsed(0)
    setChunkCount(0)
    setSearchPlan([])
    setProtocolPhase('initiating')
    currentPhaseRef.current = 'initiating'
    agentLogRef.current?.close()
    agentLogRef.current = undefined
    setError('')
    setErrorCursor(0)

    setStep('data-sources')
  }

  async function runBatch(dataSources: DataSourceOption[]) {
    const config = loadConfig()
    if (!config) {
      setError(t('create.config_not_init'))
      setStep('error')
      return
    }

    setStep('batch-capturing')

    // Initialize statuses for UI
    const initialStatuses: SoulTaskStatus[] = soulInputs.map((s) => ({
      name: s.name,
      description: s.description,
      phase: 'pending' as const,
      toolCalls: [],
      distillToolCalls: [],
      fragments: 0,
      elapsedMs: 0,
    }))
    setBatchStatuses(initialStatuses)

    try {
      const result = await runBatchPipeline({
        souls: soulInputs,
        config,
        dataSources,
        soulType,
        soulsDir: SOULS_DIR,
        deps: {
          captureSoul,
          distillSoul,
          createSyntheticChunks,
          packageSoul,
          generateManifest,
        },
        maxConcurrency: 3,
        onProgress: (event: BatchProgressEvent) => {
          setBatchStatuses((prev) => {
            const idx = prev.findIndex((s) => s.name === event.soulName)
            if (idx === -1) return prev

            const updated = [...prev]
            const current = { ...updated[idx]! }

            if (event.type === 'phase') {
              current.phase = event.phase
            } else if (event.type === 'capture_progress') {
              const p = event.progress
              if (p.type === 'phase') {
                current.capturePhase = p.phase
              } else if (p.type === 'tool_call') {
                current.toolCalls = [...current.toolCalls, {
                  tool: p.tool, query: p.query, status: 'running', phase: current.capturePhase,
                }]
              } else if (p.type === 'tool_result') {
                const tcs = [...current.toolCalls]
                const last = tcs.findLastIndex((tc) => tc.tool === p.tool && tc.status === 'running')
                if (last !== -1) tcs[last] = { ...tcs[last]!, status: 'done', resultCount: p.resultCount }
                current.toolCalls = tcs
              } else if (p.type === 'classification') {
                current.classification = p.classification
                current.origin = p.origin
              } else if (p.type === 'search_plan') {
                current.searchPlan = p.dimensions
              } else if (p.type === 'filter_progress') {
                current.filterProgress = { kept: p.kept, total: p.total }
              } else if (p.type === 'chunks_extracted') {
                current.fragments = p.count
              }
            } else if (event.type === 'distill_progress') {
              const p = event.progress
              if (p.type === 'phase') {
                current.distillPhase = p.phase
              } else if (p.type === 'tool_call') {
                current.distillToolCalls = [...current.distillToolCalls, {
                  tool: p.tool, detail: p.detail, status: 'running',
                }]
              } else if (p.type === 'tool_result') {
                const tcs = [...current.distillToolCalls]
                const last = tcs.findLastIndex((tc) => tc.tool === p.tool && tc.status === 'running')
                if (last !== -1) tcs[last] = { ...tcs[last]!, status: 'done', resultSummary: p.resultSummary }
                current.distillToolCalls = tcs
              }
            } else if (event.type === 'done') {
              current.soulDir = event.soulDir
            } else if (event.type === 'error') {
              current.error = event.error
            }

            updated[idx] = current
            return updated
          })
        },
      })

      setBatchResult(result)
      // Update final statuses from result
      setBatchStatuses(result.souls)
      setBatchSummaryCursor(0)
      setStep('batch-summary')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  async function handleBatchRetry() {
    const failedNames = (batchResult?.souls ?? [])
      .filter((s) => s.phase === 'failed')
      .map((s) => s.name)

    if (failedNames.length === 0) return

    const config = loadConfig()
    if (!config) return

    setStep('batch-capturing')

    try {
      const result = await retryFailedSouls(failedNames, soulInputs, {
        config,
        dataSources: selectedSources,
        soulType,
        soulsDir: SOULS_DIR,
        deps: {
          captureSoul,
          distillSoul,
          createSyntheticChunks,
          packageSoul,
          generateManifest,
        },
        maxConcurrency: 3,
        onProgress: (event: BatchProgressEvent) => {
          setBatchStatuses((prev) => {
            const idx = prev.findIndex((s) => s.name === event.soulName)
            if (idx === -1) return prev
            const updated = [...prev]
            const current = { ...updated[idx]! }
            if (event.type === 'phase') current.phase = event.phase
            else if (event.type === 'done') current.soulDir = event.soulDir
            else if (event.type === 'error') current.error = event.error
            updated[idx] = current
            return updated
          })
        },
      })

      // Merge retry results into existing results
      setBatchResult((prev) => {
        if (!prev) return result
        const merged = prev.souls.map((s) => {
          const retried = result.souls.find((r) => r.name === s.name)
          return retried ?? s
        })
        return { souls: merged, totalElapsedMs: prev.totalElapsedMs + result.totalElapsedMs }
      })
      setBatchStatuses((prev) => {
        return prev.map((s) => {
          const retried = result.souls.find((r) => r.name === s.name)
          return retried ?? s
        })
      })
      setBatchSummaryCursor(0)
      setStep('batch-summary')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  async function runAgentCapture(name: string) {
    const config = loadConfig()
    if (!config) {
      setStep('data-sources')
      return
    }

    try {
      const result = await captureSoul(name, config, (progress: CaptureProgress) => {
        if (progress.type === 'phase') {
          currentPhaseRef.current = progress.phase
          setProtocolPhase(progress.phase)
        } else if (progress.type === 'tool_call') {
          setToolCalls((prev) => [...prev, {
            tool: progress.tool,
            query: progress.query,
            status: 'running',
            phase: currentPhaseRef.current,
          }])
        } else if (progress.type === 'tool_result') {
          setToolCalls((prev) => {
            const updated = [...prev]
            const last = updated.findLastIndex((tc) => tc.tool === progress.tool && tc.status === 'running')
            if (last !== -1) {
              updated[last] = { ...updated[last]!, status: 'done', resultCount: progress.resultCount }
            }
            return updated
          })
        } else if (progress.type === 'classification') {
          setClassification(progress.classification)
          setOrigin(progress.origin)
        } else if (progress.type === 'search_plan') {
          setSearchPlan(progress.dimensions)
        } else if (progress.type === 'filter_progress') {
          setFilterProgress({ kept: progress.kept, total: progress.total })
        } else if (progress.type === 'chunks_extracted') {
          setChunkCount(progress.count)
        }
      }, description || undefined)

      setClassification(result.classification)
      setOrigin(result.origin)
      setAgentElapsed(result.elapsedMs)
      agentLogRef.current = result.agentLog

      // Save capture result metadata for distill (aligned with world-create-wizard)
      if (result.sessionDir) {
        setAgentSessionDir(result.sessionDir)
        // Recount from cache files for accuracy
        try {
          const nodeFs = await import('node:fs')
          const nodePath = await import('node:path')
          const files = nodeFs.readdirSync(result.sessionDir).filter((f: string) => f.endsWith('.json'))
          let total = 0
          for (const f of files) {
            const data = JSON.parse(nodeFs.readFileSync(nodePath.join(result.sessionDir, f), 'utf-8'))
            total += (data.results?.length ?? 0)
          }
          setChunkCount(total)
        } catch { /* keep event-based count */ }
      }
      if (result.dimensionPlan) setCapturedDimensions(result.dimensionPlan.dimensions)
      if (result.dimensionScores) {
        const breakdown: Record<string, number> = {}
        for (const [dim, score] of Object.entries(result.dimensionScores)) {
          breakdown[dim] = score.qualifiedCount
        }
        setDimBreakdown(breakdown)
      }

      if (result.classification === 'UNKNOWN_ENTITY') {
        result.agentLog?.close()
        agentLogRef.current = undefined
        setProtocolPhase('unknown')
        // Web search failed/empty — continue to local sources if any selected
        setTimeout(() => proceedToLocalSources(), 2000)
      } else {
        setProtocolPhase('complete')
        setSearchConfirmCursor(0)
        setTimeout(() => setStep('search-confirm'), 1500)
      }
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function handleSourcesSubmit(selected: DataSourceOption[]) {
    setSelectedSources(selected)

    // Batch mode: multiple souls
    if (soulInputs.length > 1) {
      runBatch(selected)
      return
    }

    if (selected.length === 0) {
      // Nothing selected — skip to distill with synthetic chunks only
      const syntheticChunks = createSyntheticChunks(soulName, description, parsedTags)
      const allChunks = [...appendChunks, ...syntheticChunks]
      setChunkCount(allChunks.length)
      startDistill(soulName, allChunks, agentSessionDir)
      return
    }

    if (selected.includes('web-search')) {
      // Start with web search
      setStep('capturing')
      setProtocolPhase('initiating')
      runAgentCapture(soulName)
    } else {
      // No web search — go straight to local sources
      proceedToLocalSources(selected)
    }
  }

  function proceedToLocalSources(sources?: DataSourceOption[]) {
    const localSources = (sources ?? selectedSources).filter((s) => s !== 'web-search')
    if (localSources.length === 0) {
      // No local sources — go to distill
      const syntheticChunks = createSyntheticChunks(soulName, description, parsedTags)
      const allChunks = [...appendChunks, ...syntheticChunks]
      setChunkCount(allChunks.length)
      startDistill(soulName, allChunks, agentSessionDir)
      return
    }
    // Set up local source processing
    setSelectedSources(localSources)
    setCurrentSourceIndex(0)
    setStep('source-path')
  }

  function handleSourcePathSubmit(pathValue: string) {
    if (!pathValue.trim()) return
    const newPaths = new Map(sourcePaths)
    newPaths.set(selectedSources[currentSourceIndex]!, pathValue.trim())
    setSourcePaths(newPaths)

    const nextIndex = currentSourceIndex + 1
    if (nextIndex < selectedSources.length) {
      setCurrentSourceIndex(nextIndex)
    } else {
      setStep('ingesting')
      runManualIngest(newPaths)
    }
  }

  async function runManualIngest(paths: Map<DataSourceOption, string>) {
    try {
      const soulDir = path.join(SOULS_DIR, soulName)
      packageSoul(soulDir)

      const pipeline = new IngestPipeline()
      pipeline.on('progress', (p: IngestProgress) => {
        setProgressMsg(p.message ?? `${p.current} chunks`)
      })

      const adapters: { type: AdapterType; path: string }[] = []
      for (const [source, sourcePath] of paths) {
        adapters.push({ type: source as AdapterType, path: sourcePath })
      }

      const chunks = await pipeline.run({ adapters })
      const syntheticChunks = createSyntheticChunks(soulName, description, parsedTags)
      const allChunks = [...appendChunks, ...syntheticChunks, ...chunks]
      setChunkCount(allChunks.length)

      await startDistill(soulName, allChunks, agentSessionDir)
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function handleDistillAgentProgress(progress: DistillAgentProgress) {
    if (progress.type === 'phase') {
      setDistillPhase(progress.phase)
    } else if (progress.type === 'tool_call') {
      setDistillToolCalls((prev) => [...prev, {
        tool: progress.tool,
        detail: progress.detail,
        status: 'running',
      }])
    } else if (progress.type === 'tool_result') {
      setDistillToolCalls((prev) => {
        const updated = [...prev]
        const last = updated.findLastIndex((tc) => tc.tool === progress.tool && tc.status === 'running')
        if (last !== -1) {
          updated[last] = { ...updated[last]!, status: 'done', resultSummary: progress.resultSummary }
        }
        return updated
      })
    }
  }

  async function startDistill(name: string, chunks: SoulChunk[], distillSessionDir?: string) {
    try {
      const soulDir = path.join(SOULS_DIR, name)
      packageSoul(soulDir)

      setStep('distilling')
      setDistillToolCalls([])
      setDistillPhase('distilling')

      const config = loadConfig()
      if (!config) {
        setError(t('create.config_not_init'))
        setStep('error')
        return
      }

      const aLog = agentLogRef.current
      const result = await distillSoul(name, soulDir, config, {
        sessionDir: distillSessionDir,
        chunks: chunks.length > 0 ? chunks : undefined,
        tags: parsedTags,
        onProgress: handleDistillAgentProgress,
        agentLog: aLog,
      })

      if (supplementSoul) {
        // Supplement mode: merge new distill results with existing soul files
        const client = getLLMClient()
        const existingSoul = loadSoulFiles(supplementSoul.dir)

        if (existingSoul) {
          // Create snapshot before merge
          try { createSnapshot(supplementSoul.dir, 'pre-evolve', chunks.length) } catch { /* first evolve may have no files */ }

          // Extract features from new chunks
          const sampled = sampleChunks(chunks)
          const deltaFeatures = await extractFeatures(client, sampled, name)

          // Merge with existing
          const mergeInput: MergeInput = {
            existingIdentity: existingSoul.identity,
            existingStyle: existingSoul.style,
            existingBehaviors: existingSoul.behaviors,
          }
          const merged = await mergeSoulFiles(client, mergeInput, deltaFeatures, name)
          generateSoulFiles(supplementSoul.dir, merged, ['identity', 'style', 'behaviors'])
        }

        // Record evolve history
        appendEvolveEntry(supplementSoul.dir, {
          timestamp: new Date().toISOString(),
          sources: [{ type: 'supplement', chunk_count: chunks.length }],
          dimensions_updated: ['identity', 'style', 'behaviors'],
          mode: 'delta',
          snapshot_id: new Date().toISOString().replace(/[:.]/g, '-'),
          total_chunks_after: chunks.length,
        })
      } else {
        // Normal create: generate manifest
        // Use chunkCount state (includes sessionDir articles) when chunks array is empty
        const manifestChunkCount = chunks.length > 0 ? chunks.length : chunkCount
        generateManifest(soulDir, name, name, description, manifestChunkCount, ['zh'], soulType, parsedTags)
      }

      result.agentLog?.close()
      agentLogRef.current = undefined

      setStep('done')
      onComplete(name, soulDir)
    } catch (err) {
      agentLogRef.current?.close()
      setError(String(err))
      setStep('error')
    }
  }

  const sourceLabels: Record<DataSourceOption, string> = {
    'web-search': t('create.source.web_search'),
    markdown: t('create.source.markdown'),
    twitter: 'Twitter Archive',
  }

  function formatTagsDisplay(): string {
    const parts: string[] = []
    if (parsedTags.personality.length > 0) parts.push(parsedTags.personality.join(' '))
    if (parsedTags.communication.length > 0) parts.push(parsedTags.communication.join(' '))
    if (parsedTags.values.length > 0) parts.push(parsedTags.values.join(' '))
    if (parsedTags.behavior.length > 0) parts.push(parsedTags.behavior.join(' '))
    if (parsedTags.domain.length > 0) parts.push(parsedTags.domain.join(' '))
    return parts.join(' · ') || t('create.none')
  }

  if (step === 'error') {
    const options = [t('create.error.retry'), t('create.error.back')]
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT}>✗ {t('create.failed')}</Text>
        <Text color={DIM}>  {error}</Text>
        <Text> </Text>
        {options.map((opt, i) => (
          <Text key={i} color={i === errorCursor ? ACCENT : DIM}>
            {i === errorCursor ? '  ❯ ' : '    '}{opt}
          </Text>
        ))}
      </Box>
    )
  }

  if (step === 'done') {
    // Batch mode done
    if (batchResult && soulInputs.length > 1) {
      const successSouls = batchResult.souls.filter((s) => s.phase === 'done')
      return (
        <Box flexDirection="column" paddingLeft={2}>
          {successSouls.map((soul) => (
            <Text key={soul.name} color={PRIMARY} bold>✓ soul captured: {soul.name}</Text>
          ))}
          <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? t('create.type.personal') : t('create.type.public')}</Text>
        </Box>
      )
    }
    // Single mode done
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={PRIMARY} bold>✓ soul captured: {soulName}</Text>
        <Text color={DIM}>  {t('create.done.path')}: {path.join(SOULS_DIR, soulName)}</Text>
        <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? t('create.type.personal') : t('create.type.public')}</Text>
        <Text color={DIM}>  fragments: {chunkCount}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {step === 'type-select' && (
        <>
          <Text color={ACCENT} bold>SOULKILLER PROTOCOL</Text>
          <Text color={DIM}>  {t('create.esc_anytime')}</Text>
          <Text> </Text>
          <Text color={PRIMARY}>▓ {t('create.step.type')}：</Text>
          <Box flexDirection="column" paddingLeft={2}>
            <Text>
              <Text color={typeCursor === 0 ? PRIMARY : DIM}>{typeCursor === 0 ? '● ' : '○ '}</Text>
              <Text color={typeCursor === 0 ? PRIMARY : undefined}>🔒 {t('create.type.personal')}</Text>
              <Text color={DIM}> — {t('create.type.personal_desc')}</Text>
            </Text>
            <Text>
              <Text color={typeCursor === 1 ? PRIMARY : DIM}>{typeCursor === 1 ? '● ' : '○ '}</Text>
              <Text color={typeCursor === 1 ? PRIMARY : undefined}>🌐 {t('create.type.public')}</Text>
              <Text color={DIM}> — {t('create.type.public_desc')}</Text>
            </Text>
          </Box>
        </>
      )}

      {step === 'name' && (
        <>
          <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? '🔒 ' + t('create.type.personal') : '🌐 ' + t('create.type.public')}</Text>
          <Text> </Text>
          <Text color={PRIMARY}>▓ Q1 — {t('create.step.target')}：</Text>
          <TextInput prompt="target:" placeholder={t('create.placeholder.target')} onEscape={onCancel} onSubmit={handleNameSubmit} />
        </>
      )}

      {step === 'description' && (
        <>
          <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? '🔒 ' + t('create.type.personal') : '🌐 ' + t('create.type.public')}</Text>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          <Text> </Text>
          <Text color={PRIMARY}>▓ Q2 — {t('create.step.desc')}：</Text>
          <TextInput
            prompt="desc:"
            placeholder={soulType === 'personal' ? t('create.placeholder.desc_personal') : t('create.placeholder.desc_public')}
            onEscape={onCancel}
            onSubmit={handleDescriptionSubmit}
          />
        </>
      )}

      {step === 'soul-list' && (
        <>
          <Text color={ACCENT} bold>── {t('batch.soul_list.title')} ──</Text>
          <Text> </Text>
          {soulInputs.map((soul, i) => (
            <Text key={i} color={DIM}>
              {'  '}{i + 1}. <Text color={PRIMARY}>{soul.name}</Text>
              {soul.description ? ` — ${soul.description}` : ''}
            </Text>
          ))}
          <Text> </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {[
              { key: 'add', label: `[+] ${t('batch.soul_list.add')}` },
              { key: 'continue', label: `[→] ${t('batch.soul_list.continue')}${soulInputs.length > 1 ? ` (${soulInputs.length} ${t('batch.complete')})` : ''}` },
              ...(soulInputs.length > 1 ? [{ key: 'remove', label: `[✕] ${t('batch.soul_list.remove')}` }] : []),
            ].map((item, i) => (
              <Text key={item.key}>
                <Text color={soulListCursor === i ? PRIMARY : DIM}>
                  {soulListCursor === i ? '● ' : '○ '}
                </Text>
                <Text color={soulListCursor === i ? PRIMARY : undefined}>{item.label}</Text>
              </Text>
            ))}
          </Box>
        </>
      )}

      {step === 'tags' && (
        <>
          <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? '🔒 ' + t('create.type.personal') : '🌐 ' + t('create.type.public')}</Text>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          {description && <Text color={DIM}>  {t('create.label.desc')}: {description}</Text>}
          <Text> </Text>
          <Text color={PRIMARY}>▓ Q3 — {t('create.step.tags')}：</Text>
          <TextInput
            prompt="tags:"
            placeholder={t('create.placeholder.tags')}
            onEscape={onCancel}
            onSubmit={handleTagsSubmit}
          />
        </>
      )}

      {step === 'confirm' && (
        <>
          <Text color={ACCENT} bold>── {t('create.summary.title')} ──</Text>
          <Text> </Text>
          <Text>  <Text color={PRIMARY}>👤</Text> {soulName}</Text>
          <Text>  <Text color={PRIMARY}>📋</Text> {soulType === 'personal' ? t('create.type.personal') : t('create.type.public')}</Text>
          {description && <Text>  <Text color={PRIMARY}>💬</Text> {description}</Text>}
          <Text>  <Text color={PRIMARY}>🏷️</Text> {tagsRaw ? formatTagsDisplay() : t('create.none')}</Text>
          <Text> </Text>
          {parsingTags ? (
            <Text color={DIM}>  {t('create.summary.parsing_tags')}</Text>
          ) : (
            <Box gap={2}>
              <Text color={confirmCursor === 0 ? PRIMARY : DIM}>
                {confirmCursor === 0 ? '▶ ' : '  '}{t('create.confirm')}
              </Text>
              <Text color={confirmCursor === 1 ? PRIMARY : DIM}>
                {confirmCursor === 1 ? '▶ ' : '  '}{t('create.modify')}
              </Text>
            </Box>
          )}
        </>
      )}

      {step === 'name-conflict' && (
        <>
          <Text color={ACCENT} bold>── {t('create.conflict.title')} ──</Text>
          <Text> </Text>
          <Text color={PRIMARY}>  "{soulName}" {t('create.conflict.exists')}</Text>
          {existingManifest ? (
            <Text color={DIM}>
              {'  '}{t('create.done.type')}: {existingManifest.soulType === 'personal' ? t('create.type.personal') : t('create.type.public')}
              {' | '}fragments: {existingManifest.chunk_count}
              {' | '}{t('create.conflict.created_at')} {existingManifest.created_at.slice(0, 10)}
            </Text>
          ) : (
            <Text color={DIM}>  {t('create.conflict.no_metadata')}</Text>
          )}
          <Text> </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {(['overwrite', 'append', 'rename'] as const).map((choice, i) => {
              const labels = {
                overwrite: t('create.conflict.overwrite'),
                append: t('create.conflict.append'),
                rename: t('create.conflict.rename'),
              }
              return (
                <Text key={choice}>
                  <Text color={conflictCursor === i ? PRIMARY : DIM}>
                    {conflictCursor === i ? '● ' : '○ '}
                  </Text>
                  <Text color={conflictCursor === i ? PRIMARY : undefined}>{labels[choice]}</Text>
                </Text>
              )
            })}
          </Box>
        </>
      )}

      {step === 'capturing' && (
        <SoulkillerProtocolPanel
          mode="soul"
          targetName={soulName}
          classification={classification}
          origin={origin}
          toolCalls={toolCalls}
          totalFragments={chunkCount}
          elapsedTime={agentElapsed}
          filterProgress={filterProgress}
          phase={protocolPhase}
          searchPlan={searchPlan}
        />
      )}

      {step === 'search-confirm' && (
        <>
          <Text color={ACCENT} bold>── {t('create.search.done')} ──</Text>
          <Text> </Text>
          <Text>  <Text color={PRIMARY}>{t('create.label.target')}:</Text> {soulName}</Text>
          {classification && (
            <Text>  <Text color={PRIMARY}>{t('create.search.class')}:</Text> {getClassificationLabels()[classification]}</Text>
          )}
          {origin && <Text>  <Text color={PRIMARY}>{t('create.search.origin')}:</Text> {origin}</Text>}
          <Text>  <Text color={PRIMARY}>{t('create.search.fragments')}:</Text> {chunkCount} {t('create.search.unit')}</Text>

          {/* Dimension quality breakdown (aligned with world-create-wizard) */}
          {Object.keys(dimBreakdown).length > 0 && (
            <>
              <Text> </Text>
              {Object.entries(dimBreakdown).map(([dim, qualified]) => {
                const dimDef = capturedDimensions?.find((d: any) => d.name === dim)
                const minRequired = dimDef?.minArticles ?? 2
                const sufficient = qualified >= minRequired
                const bar = '█'.repeat(Math.min(qualified, 10))
                const pLabel = dimDef?.priority === 'required' ? t('protocol.priority.required')
                  : dimDef?.priority === 'important' ? t('protocol.priority.important')
                  : t('protocol.priority.supplementary')
                return (
                  <Text key={dim} color={DIM}>
                    {'    '}{dim.padEnd(20)} <Text color={sufficient ? PRIMARY : WARNING}>{bar}</Text> {qualified}/{minRequired} <Text color={DARK}>({pLabel})</Text>
                  </Text>
                )
              })}
            </>
          )}
          <Text> </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {(['confirm', 'retry'] as const).map((choice, i) => {
              const labels = {
                confirm: t('create.search.confirm'),
                retry: t('create.search.retry'),
              }
              return (
                <Text key={choice}>
                  <Text color={searchConfirmCursor === i ? PRIMARY : DIM}>
                    {searchConfirmCursor === i ? '● ' : '○ '}
                  </Text>
                  <Text color={searchConfirmCursor === i ? PRIMARY : undefined}>{labels[choice]}</Text>
                </Text>
              )
            })}
          </Box>
        </>
      )}

      {step === 'search-detail' && (
        <>
          <Text color={ACCENT} bold>── {t('create.search.detail_title')} ──</Text>
          <Text color={DIM}>  {t('create.search.detail_hint')}</Text>
          <Text> </Text>
          {agentChunks.slice(detailScroll, detailScroll + 5).map((chunk, i) => (
            <Box key={chunk.id} flexDirection="column" paddingLeft={2} marginBottom={1}>
              <Text color={PRIMARY}>
                [{detailScroll + i + 1}/{agentChunks.length}] <Text color={DIM}>{chunk.source}{chunk.metadata?.extraction_step ? ` · ${chunk.metadata.extraction_step}` : ''}</Text>
                {chunk.metadata?.url ? <Text color={DIM}> — {truncateStr(String(chunk.metadata.url), 50)}</Text> : null}
              </Text>
              <Text color={undefined}>{truncateStr(chunk.content, 200)}</Text>
            </Box>
          ))}
          {agentChunks.length > 5 && (
            <Text color={DIM}>  {t('create.search.showing')} {detailScroll + 1}-{Math.min(detailScroll + 5, agentChunks.length)} / {agentChunks.length}</Text>
          )}
        </>
      )}

      {step === 'data-sources' && (
        <>
          {appendChunks.length > 0 && (
            <Text color={DIM}>  {t('create.source.existing_fragments', { count: String(appendChunks.length) })}</Text>
          )}
          <Text> </Text>
          <Text color={PRIMARY}>▓ {t('create.source.select')}：</Text>
          <CheckboxSelect<DataSourceOption>
            items={[
              ...(soulType === 'public' ? [{ value: 'web-search' as const, label: t('create.source.web_search'), checked: true }] : []),
              { value: 'markdown' as const, label: t('create.source.markdown') },
              { value: 'twitter' as const, label: 'Twitter Archive' },
            ]}
            onEscape={onCancel}
            onSubmit={handleSourcesSubmit}
          />
        </>
      )}

      {step === 'source-path' && (
        <>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          <Text color={PRIMARY}>▓ {t('create.path_hint', { source: sourceLabels[selectedSources[currentSourceIndex]!] })}：</Text>
          <TextInput
            prompt="path:"
            placeholder="/path/to/data"
            pathCompletion
            onEscape={onCancel}
            onSubmit={handleSourcePathSubmit}
          />
        </>
      )}

      {step === 'ingesting' && (
        <>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          <Text color={PRIMARY}>▓ {t('create.ingesting')}</Text>
          <Text color={DIM}>  {progressMsg}</Text>
        </>
      )}

      {step === 'distilling' && (
        <>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          <Text color={DIM}>  fragments: {chunkCount}</Text>
          <DistillProgressPanel toolCalls={distillToolCalls} phase={distillPhase} />
        </>
      )}

      {step === 'batch-capturing' && (
        <BatchProtocolPanel statuses={batchStatuses} onCancel={onCancel} />
      )}

      {step === 'batch-summary' && batchResult && (
        <>
          <Text color={ACCENT} bold>── {t('batch.summary.title')} ──</Text>
          <Text> </Text>
          {batchResult.souls.map((soul) => (
            <Text key={soul.name}>
              <Text color={soul.phase === 'done' ? PRIMARY : ACCENT}>
                {soul.phase === 'done' ? '  ✓ ' : '  ✗ '}
              </Text>
              <Text color={soul.phase === 'done' ? PRIMARY : undefined}>
                {soul.name.padEnd(16)}
              </Text>
              {soul.phase === 'done' ? (
                <Text color={DIM}>
                  {soul.classification ?? ''} · {soul.fragments} frags · {(soul.elapsedMs / 1000).toFixed(1)}s
                </Text>
              ) : (
                <Text color={ACCENT}>{soul.error ?? 'FAILED'}</Text>
              )}
            </Text>
          ))}
          <Text> </Text>
          <Text color={DIM}>
            {'  '}{t('batch.summary.success', { count: String(batchResult.souls.filter((s) => s.phase === 'done').length) })}
            {'  ·  '}{t('batch.summary.elapsed', { time: (batchResult.totalElapsedMs / 1000).toFixed(1) })}
            {batchResult.souls.some((s) => s.phase === 'failed') &&
              `  ·  ${t('batch.summary.failed', { count: String(batchResult.souls.filter((s) => s.phase === 'failed').length) })}`
            }
          </Text>
          <Text> </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {(() => {
              const hasFailures = batchResult.souls.some((s) => s.phase === 'failed')
              const items = hasFailures
                ? [
                    { key: 'finish', label: t('batch.summary.finish') },
                    { key: 'retry', label: t('batch.summary.retry') },
                    { key: 'detail', label: t('batch.summary.detail') },
                  ]
                : [
                    { key: 'finish', label: t('batch.summary.finish') },
                    { key: 'detail', label: t('batch.summary.detail') },
                  ]
              return items.map((item, i) => (
                <Text key={item.key}>
                  <Text color={batchSummaryCursor === i ? PRIMARY : DIM}>
                    {batchSummaryCursor === i ? '● ' : '○ '}
                  </Text>
                  <Text color={batchSummaryCursor === i ? PRIMARY : undefined}>{item.label}</Text>
                </Text>
              ))
            })()}
          </Box>
        </>
      )}
    </Box>
  )
}

function truncateStr(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}
