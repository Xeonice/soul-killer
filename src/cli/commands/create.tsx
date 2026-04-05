import React, { useState, useEffect, useRef } from 'react'
import { Text, Box, useInput } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TextInput, CheckboxSelect } from '../components/text-input.js'
import { SoulkillerProtocolPanel } from '../animation/soulkiller-protocol-panel.js'
import { DistillProgressPanel, type DistillToolCallDisplay } from '../components/distill-progress.js'
import { IngestPipeline } from '../../ingest/pipeline.js'
import type { AdapterType } from '../../ingest/pipeline.js'
import { distillSoul, type DistillAgentProgress } from '../../distill/distill-agent.js'
import { getLLMClient } from '../../llm/client.js'
import { loadConfig } from '../../config/loader.js'
import { generateManifest, packageSoul, readManifest } from '../../soul/package.js'
import { captureSoul, type CaptureProgress, type TargetClassification } from '../../agent/soul-capture-agent.js'
import type { ToolCallDisplay, AgentPhase, SearchPlanDimDisplay } from '../animation/soulkiller-protocol-panel.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import type { IngestProgress, SoulChunk } from '../../ingest/types.js'
import type { SoulType, SoulManifest } from '../../soul/manifest.js'
import { type TagSet, emptyTagSet } from '../../tags/taxonomy.js'
import { parseTags } from '../../tags/parser.js'
import { createSyntheticChunks } from '../../ingest/synthetic-adapter.js'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

function getClassificationLabels(): Record<TargetClassification, string> {
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
  | 'done'
  | 'error'

type DataSourceOption = 'web-search' | 'markdown' | 'twitter'
type ConflictChoice = 'overwrite' | 'append' | 'rename'
type SearchConfirmChoice = 'confirm' | 'retry' | 'detail'

interface CreateCommandProps {
  onComplete: (soulName: string, soulDir: string) => void
  onCancel: () => void
}

export function CreateCommand({ onComplete, onCancel }: CreateCommandProps) {
  const [step, setStep] = useState<CreateStep>('type-select')
  const [soulType, setSoulType] = useState<SoulType>('public')
  const [soulName, setSoulName] = useState('')
  const [description, setDescription] = useState('')
  const [parsedTags, setParsedTags] = useState<TagSet>(emptyTagSet())
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
  const [classification, setClassification] = useState<TargetClassification | undefined>()
  const [origin, setOrigin] = useState<string | undefined>()
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([])
  const [protocolPhase, setProtocolPhase] = useState<AgentPhase>('initiating')
  const currentPhaseRef = useRef<AgentPhase>('initiating')
  const [agentChunks, setAgentChunks] = useState<SoulChunk[]>([])
  const [agentElapsed, setAgentElapsed] = useState(0)
  const [searchPlan, setSearchPlan] = useState<SearchPlanDimDisplay[]>([])

  const agentLogRef = useRef<import('../../utils/agent-logger.js').AgentLogger | undefined>(undefined)

  // Distill progress state
  const [distillToolCalls, setDistillToolCalls] = useState<DistillToolCallDisplay[]>([])
  const [distillPhase, setDistillPhase] = useState<'distilling' | 'complete'>('distilling')

  // Unified input handler
  useInput((_input, key) => {
    // Esc during processing phases
    if (key.escape && (step === 'capturing' || step === 'ingesting' || step === 'distilling')) {
      onCancel()
      return
    }

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
      if (key.downArrow) setSearchConfirmCursor((c) => Math.min(2, c + 1))
      if (key.return) {
        const choices: SearchConfirmChoice[] = ['confirm', 'detail', 'retry']
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
    } else if (choice === 'detail') {
      setDetailScroll(0)
      setStep('search-detail')
    } else if (choice === 'retry') {
      setAgentChunks([])
      setToolCalls([])
      currentPhaseRef.current = 'initiating'
      setClassification(undefined)
      setOrigin(undefined)
      setChunkCount(0)
      setSearchPlan([])
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
    setStep('tags')
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
        const model = config.llm.default_model
        const tags = await parseTags(value.trim(), client, model)
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

      if (result.classification === 'UNKNOWN_ENTITY' || result.chunks.length === 0) {
        result.agentLog?.close()
        agentLogRef.current = undefined
        setProtocolPhase('unknown')
        // Web search failed/empty — continue to local sources if any selected
        setTimeout(() => proceedToLocalSources(), 2000)
      } else {
        setAgentChunks(result.chunks)
        setChunkCount(result.chunks.length)
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

    if (selected.length === 0) {
      // Nothing selected — skip to distill with synthetic chunks only
      const syntheticChunks = createSyntheticChunks(soulName, description, parsedTags)
      const allChunks = [...appendChunks, ...agentChunks, ...syntheticChunks]
      setChunkCount(allChunks.length)
      startDistill(soulName, allChunks)
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
      const allChunks = [...appendChunks, ...agentChunks, ...syntheticChunks]
      setChunkCount(allChunks.length)
      startDistill(soulName, allChunks)
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
      const allChunks = [...appendChunks, ...agentChunks, ...syntheticChunks, ...chunks]
      setChunkCount(allChunks.length)

      await startDistill(soulName, allChunks)
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

  async function startDistill(name: string, chunks: SoulChunk[]) {
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
      const result = await distillSoul(name, chunks, soulDir, config, parsedTags, handleDistillAgentProgress, aLog)

      // Generate manifest (agent writes soul files, we write manifest)
      generateManifest(soulDir, name, name, description, chunks.length, ['zh'], soulType, parsedTags)

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

      {step === 'tags' && (
        <>
          <Text color={DIM}>  {t('create.done.type')}: {soulType === 'personal' ? '🔒 ' + t('create.type.personal') : '🌐 ' + t('create.type.public')}</Text>
          <Text color={DIM}>  {t('create.label.target')}: {soulName}</Text>
          {description && <Text color={DIM}>  {t('create.label.desc')}: {description}</Text>}
          <Text> </Text>
          <Text color={PRIMARY}>▓ Q3 — {t('create.step.tags')}：</Text>
          <TextInput
            prompt="tags:"
            placeholder="INTJ 话少 冷幽默 技术洁癖"
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
          <Text>  <Text color={PRIMARY}>{t('create.search.fragments')}:</Text> {agentChunks.length} {t('create.search.unit')}</Text>
          <Text> </Text>
          {agentChunks.length > 0 && (() => {
            const dimCounts: Record<string, number> = {}
            for (const c of agentChunks) {
              const dim = String(c.metadata?.extraction_step ?? '')
              if (dim) dimCounts[dim] = (dimCounts[dim] ?? 0) + 1
            }
            const entries = Object.entries(dimCounts).sort(([, a], [, b]) => b - a)
            if (entries.length === 0) return null
            const maxCount = Math.max(...entries.map(([, v]) => v))
            return (
              <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
                <Text color={PRIMARY}>  {t('create.search.coverage')}:</Text>
                {entries.map(([dim, count]) => {
                  const barLen = Math.round((count / maxCount) * 8)
                  const bar = '█'.repeat(barLen).padEnd(8)
                  return (
                    <Text key={dim} color={DIM}>    {dim.padEnd(12)} {bar} {count}</Text>
                  )
                })}
              </Box>
            )
          })()}
          <Box flexDirection="column" paddingLeft={2}>
            {(['confirm', 'detail', 'retry'] as const).map((choice, i) => {
              const labels = {
                confirm: t('create.search.confirm'),
                detail: t('create.search.detail'),
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
    </Box>
  )
}

function truncateStr(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}
