import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Text, Box, useInput } from 'ink'
import { TextInput } from '../components/text-input.js'
import { IngestPipeline } from '../../ingest/pipeline.js'
import { sampleChunks } from '../../distill/sampler.js'
import { extractFeatures, type DistillDimension } from '../../distill/extractor.js'
import { mergeSoulFiles, type MergeInput } from '../../distill/merger.js'
import { generateSoulFiles, loadSoulFiles } from '../../distill/generator.js'
import { getLLMClient } from '../../llm/client.js'
import { loadConfig } from '../../config/loader.js'
import { createSnapshot } from '../../soul/snapshot.js'
import { appendEvolveEntry } from '../../soul/package.js'
import { textToChunks } from '../../ingest/text-adapter.js'
import { extractUrl, urlResultToChunks } from '../../ingest/url-adapter.js'
import { readUnconsumedFeedback, feedbackToChunks, markFeedbackConsumed } from '../../ingest/feedback-adapter.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import type { EngineAdapter } from '../../engine/adapter.js'
import { detectEngine } from '../../engine/detect.js'
import type { IngestProgress, SoulChunk } from '../../ingest/types.js'
import path from 'node:path'

type SourceType = 'markdown' | 'url' | 'text' | 'feedback'
type EvolvePhase =
  | 'source-select'
  | 'path-input'
  | 'url-input'
  | 'text-input'
  | 'dimension-select'
  | 'executing'
  | 'done'
  | 'error'

type StepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error'

interface SubStep {
  label: string
  status: StepStatus
  detail?: string
}

interface PipelineStep {
  label: string
  status: StepStatus
  detail?: string
  subSteps?: SubStep[]
}

const SOURCE_OPTIONS: { key: SourceType; label: string }[] = [
  { key: 'markdown', label: t('evolve.source.markdown') },
  { key: 'url', label: t('evolve.source.url') },
  { key: 'text', label: t('evolve.source.text') },
  { key: 'feedback', label: t('evolve.source.feedback') },
]

const DIMENSION_OPTIONS: { key: DistillDimension | 'all'; label: string }[] = [
  { key: 'all', label: t('evolve.dim.all') },
  { key: 'identity', label: t('evolve.dim.identity') },
  { key: 'style', label: t('evolve.dim.style') },
  { key: 'behaviors', label: t('evolve.dim.behaviors') },
]

const STEP_ICON: Record<StepStatus, string> = {
  pending: '○',
  active: '▓',
  done: '✓',
  skipped: '–',
  error: '✗',
}

const STEP_COLOR: Record<StepStatus, string> = {
  pending: DIM,
  active: PRIMARY,
  done: PRIMARY,
  skipped: DIM,
  error: WARNING,
}

function buildInitialSteps(needsEngineInit: boolean): PipelineStep[] {
  const steps: PipelineStep[] = []
  if (needsEngineInit) {
    steps.push({ label: t('evolve.step.init_engine'), status: 'pending' })
  }
  steps.push(
    { label: t('evolve.step.ingest'), status: 'pending' },
    { label: t('evolve.step.write_engine'), status: 'pending' },
    { label: t('evolve.step.snapshot'), status: 'pending' },
    { label: t('evolve.step.sample'), status: 'pending' },
    { label: t('evolve.step.extract'), status: 'pending' },
    { label: t('evolve.step.merge'), status: 'pending' },
    { label: t('evolve.step.write_soul'), status: 'pending' },
    { label: t('evolve.step.history'), status: 'pending' },
  )
  return steps
}

interface EvolveCommandProps {
  soulName: string
  soulDir: string
  engine: EngineAdapter | null
  chunks: SoulChunk[]
  onComplete: () => void
  onExit: () => void
}

export function EvolveCommand({ soulName, soulDir, engine, chunks, onComplete, onExit }: EvolveCommandProps) {
  const [phase, setPhase] = useState<EvolvePhase>('source-select')
  const [sourceIndex, setSourceIndex] = useState(0)
  const [selectedSource, setSelectedSource] = useState<SourceType>('markdown')
  const [dimIndex, setDimIndex] = useState(0)
  const [selectedDimensions, setSelectedDimensions] = useState<DistillDimension[]>(['identity', 'style', 'behaviors'])

  // Data collection state
  const [feedPath, setFeedPath] = useState('')
  const [urls, setUrls] = useState<string[]>([])
  const urlCountRef = useRef(0)
  const [newChunks, setNewChunks] = useState<SoulChunk[]>([])

  // Pipeline execution state
  const needsEngineInit = engine === null
  const [steps, setSteps] = useState<PipelineStep[]>(() => buildInitialSteps(needsEngineInit))
  const engineRef = useRef<EngineAdapter | null>(engine)
  const [allChunks, setAllChunks] = useState<SoulChunk[]>(chunks)
  const [error, setError] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)

  // Step update helper
  const updateStep = useCallback((index: number, update: Partial<PipelineStep>) => {
    setSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...update } : s))
  }, [])

  // Source selection & dimension selection via useInput
  useInput((_, key) => {
    if (phase === 'source-select') {
      if (key.escape) { onExit(); return }
      if (key.upArrow) setSourceIndex((i) => Math.max(0, i - 1))
      if (key.downArrow) setSourceIndex((i) => Math.min(SOURCE_OPTIONS.length - 1, i + 1))
      if (key.return) {
        const src = SOURCE_OPTIONS[sourceIndex]!.key
        setSelectedSource(src)
        if (src === 'markdown') setPhase('path-input')
        else if (src === 'url') setPhase('url-input')
        else if (src === 'text') setPhase('text-input')
        else if (src === 'feedback') handleFeedbackSource()
      }
    } else if (phase === 'dimension-select') {
      if (key.escape) { onExit(); return }
      if (key.upArrow) setDimIndex((i) => Math.max(0, i - 1))
      if (key.downArrow) setDimIndex((i) => Math.min(DIMENSION_OPTIONS.length - 1, i + 1))
      if (key.return) {
        const dim = DIMENSION_OPTIONS[dimIndex]!.key
        if (dim === 'all') {
          setSelectedDimensions(['identity', 'style', 'behaviors'])
        } else {
          setSelectedDimensions([dim])
        }
        setPhase('executing')
      }
    } else if (phase !== 'path-input' && phase !== 'url-input' && phase !== 'text-input') {
      if (key.escape) onExit()
    }
  })

  // Handle feedback source (no user input needed)
  const handleFeedbackSource = useCallback(() => {
    const feedbackPath = path.join(soulDir, 'feedback.json')
    const records = readUnconsumedFeedback(feedbackPath)
    if (records.length === 0) {
      setError(t('evolve.no_feedback'))
      setPhase('error')
      return
    }
    const fbChunks = feedbackToChunks(records)
    setNewChunks(fbChunks)
    markFeedbackConsumed(feedbackPath, records.map((r) => r.id))
    setPhase('dimension-select')
  }, [soulDir])

  // Path submit for markdown
  const handlePathSubmit = useCallback((p: string) => {
    if (!p.trim()) return
    setFeedPath(p.trim())
    setPhase('dimension-select')
  }, [])

  // URL input
  const handleUrlSubmit = useCallback((url: string) => {
    if (!url.trim()) {
      if (urlCountRef.current === 0) return
      setPhase('dimension-select')
      return
    }
    urlCountRef.current++
    setUrls((prev) => [...prev, url.trim()])
  }, [])

  // Text input
  const handleTextSubmit = useCallback((text: string) => {
    if (!text.trim()) return
    const chunks = textToChunks(text.trim(), soulName)
    setNewChunks(chunks)
    setPhase('dimension-select')
  }, [soulName])

  // ── Pipeline execution ──────────────────────────────────────────────────

  // Snapshot values into refs so the effect only re-fires when phase changes
  const selectedSourceRef = useRef(selectedSource)
  const feedPathRef = useRef(feedPath)
  const urlsRef = useRef(urls)
  const newChunksRef = useRef(newChunks)
  const selectedDimensionsRef = useRef(selectedDimensions)
  const chunksRef = useRef(chunks)

  useEffect(() => { selectedSourceRef.current = selectedSource }, [selectedSource])
  useEffect(() => { feedPathRef.current = feedPath }, [feedPath])
  useEffect(() => { urlsRef.current = urls }, [urls])
  useEffect(() => { newChunksRef.current = newChunks }, [newChunks])
  useEffect(() => { selectedDimensionsRef.current = selectedDimensions }, [selectedDimensions])
  useEffect(() => { chunksRef.current = chunks }, [chunks])

  useEffect(() => {
    if (phase !== 'executing') return
    let cancelled = false
    const startTime = Date.now()
    const ticker = setInterval(() => {
      if (!cancelled) setElapsedMs(Date.now() - startTime)
    }, 500)

    // Read from refs to avoid stale closures without adding deps
    const curSource = selectedSourceRef.current
    const curFeedPath = feedPathRef.current
    const curUrls = urlsRef.current
    const curNewChunks = newChunksRef.current
    const curDimensions = selectedDimensionsRef.current
    const curChunks = chunksRef.current

    async function runPipeline() {
      try {
        let si = 0 // step index offset

        // Step: 初始化引擎 (conditional)
        if (!engineRef.current) {
          updateStep(si, { status: 'active' })
          engineRef.current = await detectEngine(soulDir)
          if (cancelled) return
          updateStep(si, { status: 'done' })
          si++
        }

        const activeEngine = engineRef.current!

        // Step: 导入数据
        const S_INGEST = si; si++
        const S_ENGINE = si; si++
        const S_SNAP = si; si++
        const S_SAMPLE = si; si++
        const S_EXTRACT = si; si++
        const S_MERGE = si; si++
        const S_WRITE = si; si++
        const S_HISTORY = si

        updateStep(S_INGEST, { status: 'active' })
        let feedChunks: SoulChunk[] = []

        if (curSource === 'markdown') {
          const pipeline = new IngestPipeline()
          pipeline.on('progress', (p: IngestProgress) => {
            if (!cancelled) updateStep(S_INGEST, { detail: p.message ?? `${p.current} chunks` })
          })
          feedChunks = await pipeline.run({ adapters: [{ type: 'markdown', path: curFeedPath }] })
        } else if (curSource === 'url') {
          const urlSubs: SubStep[] = curUrls.map((u) => ({ label: u, status: 'pending' as StepStatus }))
          updateStep(S_INGEST, { subSteps: urlSubs, detail: `0/${curUrls.length}` })

          for (let i = 0; i < curUrls.length; i++) {
            if (cancelled) return
            urlSubs[i] = { ...urlSubs[i]!, status: 'active' }
            updateStep(S_INGEST, { subSteps: [...urlSubs], detail: `${i}/${curUrls.length}` })

            const result = await extractUrl(curUrls[i]!)
            const urlChunks = urlResultToChunks(result)
            feedChunks.push(...urlChunks)

            if (result.error) {
              urlSubs[i] = { label: curUrls[i]!, status: 'error', detail: result.error }
            } else {
              urlSubs[i] = { label: curUrls[i]!, status: 'done', detail: `${urlChunks.length} chunks${result.title ? ` · ${result.title}` : ''}` }
            }
            updateStep(S_INGEST, { subSteps: [...urlSubs], detail: `${i + 1}/${curUrls.length}` })
          }
        } else if (curSource === 'text' || curSource === 'feedback') {
          feedChunks = curNewChunks
        }

        if (cancelled) return
        updateStep(S_INGEST, { status: 'done', detail: `${feedChunks.length} chunks` })

        // Step: 写入引擎
        updateStep(S_ENGINE, { status: 'active' })
        await activeEngine.ingest(feedChunks)
        if (cancelled) return
        setNewChunks(feedChunks)
        setAllChunks((prev) => [...prev, ...feedChunks])
        updateStep(S_ENGINE, { status: 'done' })

        // Step: 创建快照
        updateStep(S_SNAP, { status: 'active' })
        try {
          createSnapshot(soulDir, 'pre-evolve', curChunks.length + feedChunks.length)
          updateStep(S_SNAP, { status: 'done' })
        } catch {
          updateStep(S_SNAP, { status: 'skipped', detail: t('evolve.no_existing_files') })
        }
        if (cancelled) return

        // Step: 采样
        updateStep(S_SAMPLE, { status: 'active' })
        const sampled = sampleChunks(feedChunks)
        if (cancelled) return
        updateStep(S_SAMPLE, { status: 'done', detail: `${sampled.length}/${feedChunks.length}` })

        // Step: 提取特征
        updateStep(S_EXTRACT, { status: 'active', detail: curDimensions.join(', ') })
        const config = loadConfig()
        if (!config) throw new Error(t('evolve.config_not_init'))
        const client = getLLMClient()
        const model = config.llm.distill_model ?? config.llm.default_model

        const deltaFeatures = await extractFeatures(
          client, model, sampled, soulName, undefined,
          (p) => {
            if (!cancelled) updateStep(S_EXTRACT, { detail: `${p.phase} ${p.status}${p.batch ? ` (${p.batch}/${p.totalBatches})` : ''}` })
          },
          curDimensions,
        )
        if (cancelled) return
        updateStep(S_EXTRACT, { status: 'done' })

        // Step: 合并特征
        const existingSoul = loadSoulFiles(soulDir)
        if (existingSoul) {
          updateStep(S_MERGE, { status: 'active' })
          const mergeInput: MergeInput = {
            existingIdentity: existingSoul.identity,
            existingStyle: existingSoul.style,
            existingBehaviors: existingSoul.behaviors,
          }
          const merged = await mergeSoulFiles(client, model, mergeInput, deltaFeatures, soulName)
          if (cancelled) return
          updateStep(S_MERGE, { status: 'done' })

          updateStep(S_WRITE, { status: 'active' })
          generateSoulFiles(soulDir, merged, curDimensions)
          updateStep(S_WRITE, { status: 'done' })
        } else {
          updateStep(S_MERGE, { status: 'skipped', detail: t('evolve.first_create') })
          updateStep(S_WRITE, { status: 'active' })
          generateSoulFiles(soulDir, deltaFeatures, curDimensions)
          updateStep(S_WRITE, { status: 'done' })
        }
        if (cancelled) return

        // Step: 记录历史
        updateStep(S_HISTORY, { status: 'active' })
        const totalAfter = curChunks.length + feedChunks.length
        appendEvolveEntry(soulDir, {
          timestamp: new Date().toISOString(),
          sources: [{ type: curSource, chunk_count: feedChunks.length }],
          dimensions_updated: curDimensions,
          mode: 'delta',
          snapshot_id: new Date().toISOString().replace(/[:.]/g, '-'),
          total_chunks_after: totalAfter,
        })
        updateStep(S_HISTORY, { status: 'done' })

        setElapsedMs(Date.now() - startTime)
        setPhase('done')
      } catch (err) {
        if (!cancelled) {
          // Mark current active step as error
          setSteps((prev) => prev.map((s) =>
            s.status === 'active' ? { ...s, status: 'error' as StepStatus, detail: String(err) } : s
          ))
          setError(String(err))
          setPhase('error')
        }
      } finally {
        clearInterval(ticker)
      }
    }

    runPipeline()
    return () => { cancelled = true; clearInterval(ticker) }
  }, [phase, soulName, soulDir, updateStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-complete
  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(onComplete, 2500)
      return () => clearTimeout(timer)
    }
  }, [phase, onComplete])

  // ── Pipeline Render ───────────────────────────────────────────────────────

  const PipelineView = () => (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
      <Text color={DIM}>  {selectedSource} → {selectedDimensions.join(', ')} · {formatMs(elapsedMs)}</Text>
      <Text> </Text>
      {steps.map((step, i) => (
        <Box key={i} flexDirection="column">
          <Box>
            <Text color={STEP_COLOR[step.status]}> {STEP_ICON[step.status]} {step.label}</Text>
            {step.detail && <Text color={DIM}> — {step.detail}</Text>}
          </Box>
          {step.subSteps && step.subSteps.map((sub, j) => (
            <Box key={j} paddingLeft={2}>
              <Text color={STEP_COLOR[sub.status]}> {STEP_ICON[sub.status]} </Text>
              <Text color={sub.status === 'error' ? WARNING : DIM}>{sub.label}</Text>
              {sub.detail && <Text color={DIM}> — {sub.detail}</Text>}
            </Box>
          ))}
        </Box>
      ))}
      {phase === 'error' && (
        <>
          <Text> </Text>
          <Text color={WARNING}>  {error}</Text>
        </>
      )}
      {phase === 'done' && (
        <>
          <Text> </Text>
          <Text color={PRIMARY} bold>  Evolve {t('evolve.complete')}  ({formatMs(elapsedMs)})</Text>
        </>
      )}
    </Box>
  )

  // ── Phase Render ──────────────────────────────────────────────────────────

  if (phase === 'executing' || phase === 'done' || phase === 'error') {
    return <PipelineView />
  }

  if (phase === 'source-select') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
        <Text color={DIM}>  {t('evolve.select_source')}</Text>
        {SOURCE_OPTIONS.map((opt, i) => (
          <Text key={opt.key} color={i === sourceIndex ? PRIMARY : DIM}>
            {i === sourceIndex ? '▸ ' : '  '}{opt.label}
          </Text>
        ))}
        <Text color={DIM} dimColor>  ↑↓ Enter · Esc {t('evolve.cancel')}</Text>
      </Box>
    )
  }

  if (phase === 'path-input') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
        <Text color={DIM}>  {t('evolve.enter_path')}</Text>
        <TextInput prompt="path>" pathCompletion onSubmit={handlePathSubmit} onEscape={onExit} />
      </Box>
    )
  }

  if (phase === 'url-input') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
        <Text color={DIM}>  {t('evolve.enter_url')}</Text>
        {urls.length > 0 && urls.map((u, i) => (
          <Text key={i} color={DIM}>  ✓ {u}</Text>
        ))}
        <TextInput prompt="url>" onSubmit={handleUrlSubmit} onEscape={onExit} />
      </Box>
    )
  }

  if (phase === 'text-input') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
        <Text color={DIM}>  {t('evolve.enter_text')}</Text>
        <TextInput prompt="text>" onSubmit={handleTextSubmit} onEscape={onExit} />
      </Box>
    )
  }

  // dimension-select
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>EVOLVE — {soulName}</Text>
      <Text color={DIM}>  {t('evolve.select_dimensions')}</Text>
      {DIMENSION_OPTIONS.map((opt, i) => (
        <Text key={opt.key} color={i === dimIndex ? PRIMARY : DIM}>
          {i === dimIndex ? '▸ ' : '  '}{opt.label}
        </Text>
      ))}
      <Text color={DIM} dimColor>  ↑↓ Enter · Esc {t('evolve.cancel')}</Text>
    </Box>
  )
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
