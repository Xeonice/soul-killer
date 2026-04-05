import React, { useState, useEffect } from 'react'
import { Text, Box, useInput } from 'ink'
import { TextInput } from '../components/text-input.js'
import { WorldDistillReview } from './world-distill-review.js'
import { createWorld, worldExists, deleteWorld } from '../../world/manifest.js'
import { addEntry, loadAllEntries, type EntryMeta } from '../../world/entry.js'
import { WorldDistiller, type WorldDistillProgress, type GeneratedEntry } from '../../world/distill.js'
import { extractPageContent } from '../../agent/tools/page-extractor.js'
import { getLLMClient } from '../../llm/client.js'
import { loadConfig } from '../../config/loader.js'
import type { SoulChunk } from '../../ingest/types.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import crypto from 'node:crypto'

type WizardStep =
  | 'name'
  | 'name-conflict'
  | 'display-name'
  | 'description'
  | 'method-select'
  // manual
  | 'manual-background'
  | 'manual-rules'
  | 'manual-atmosphere'
  | 'manual-more'
  | 'manual-entry-name'
  | 'manual-entry-kw'
  | 'manual-entry-content'
  // distill
  | 'distill-path'
  | 'distilling'
  | 'distill-review'
  // url
  | 'url-input'
  | 'url-fetching'
  | 'url-review'
  // common
  | 'confirm'
  | 'creating'
  | 'done'
  | 'error'

type CreateMethod = 'manual' | 'distill' | 'url' | 'blank'
type ConflictChoice = 'overwrite' | 'rename'

interface WorldCreateWizardProps {
  onComplete: () => void
  onCancel: () => void
}

const METHODS: { value: CreateMethod; labelKey: string; descKey: string }[] = [
  { value: 'manual', labelKey: 'wizard.method.manual', descKey: 'wizard.method.manual_desc' },
  { value: 'distill', labelKey: 'wizard.method.distill', descKey: 'wizard.method.distill_desc' },
  { value: 'url', labelKey: 'wizard.method.url', descKey: 'wizard.method.url_desc' },
  { value: 'blank', labelKey: 'wizard.method.blank', descKey: 'wizard.method.blank_desc' },
]

export function WorldCreateWizard({ onComplete, onCancel }: WorldCreateWizardProps) {
  const [step, setStep] = useState<WizardStep>('name')
  const [worldName, setWorldName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState<CreateMethod>('manual')
  const [errorMsg, setErrorMsg] = useState('')

  // Cursor states
  const [methodCursor, setMethodCursor] = useState(0)
  const [conflictCursor, setConflictCursor] = useState(0)
  const [confirmCursor, setConfirmCursor] = useState(0)
  const [moreCursor, setMoreCursor] = useState(0)

  // Collected entries (from all branches)
  const [entries, setEntries] = useState<GeneratedEntry[]>([])

  // Manual entry temp state
  const [tempEntryName, setTempEntryName] = useState('')
  const [tempEntryKw, setTempEntryKw] = useState('')

  // Distill state
  const [distillProgress, setDistillProgress] = useState<WorldDistillProgress | null>(null)
  const [distillEntries, setDistillEntries] = useState<GeneratedEntry[]>([])

  // URL state
  const [urls, setUrls] = useState<string[]>([])
  const [urlFetchStatus, setUrlFetchStatus] = useState('')

  // --- Input handling ---
  useInput((_input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (step === 'method-select') {
      if (key.upArrow) setMethodCursor((c) => (c - 1 + METHODS.length) % METHODS.length)
      if (key.downArrow) setMethodCursor((c) => (c + 1) % METHODS.length)
      if (key.return) {
        const selected = METHODS[methodCursor]!
        setMethod(selected.value)
        switch (selected.value) {
          case 'manual': setStep('manual-background'); break
          case 'distill': setStep('distill-path'); break
          case 'url': setStep('url-input'); break
          case 'blank': setStep('confirm'); break
        }
      }
      return
    }

    if (step === 'name-conflict') {
      if (key.upArrow || key.downArrow) setConflictCursor((c) => (c + 1) % 2)
      if (key.return) {
        if (conflictCursor === 0) {
          // overwrite
          deleteWorld(worldName)
          setStep('display-name')
        } else {
          // rename
          setWorldName('')
          setStep('name')
        }
      }
      return
    }

    if (step === 'confirm') {
      if (key.upArrow || key.downArrow) setConfirmCursor((c) => (c + 1) % 2)
      if (key.return) {
        if (confirmCursor === 0) {
          doCreate()
        } else {
          // back to method select, keep name/display/desc
          setEntries([])
          setStep('method-select')
        }
      }
      return
    }

    if (step === 'manual-more') {
      if (key.upArrow || key.downArrow) setMoreCursor((c) => (c + 1) % 2)
      if (key.return) {
        if (moreCursor === 0) {
          setTempEntryName('')
          setTempEntryKw('')
          setStep('manual-entry-name')
        } else {
          setStep('confirm')
        }
      }
      return
    }
  })

  // --- Actions ---
  function handleName(value: string) {
    const name = value.trim()
    if (!name) return
    setWorldName(name)
    if (worldExists(name)) {
      setStep('name-conflict')
    } else {
      setStep('display-name')
    }
  }

  function handleDisplayName(value: string) {
    setDisplayName(value.trim() || worldName)
    setStep('description')
  }

  function handleDescription(value: string) {
    setDescription(value.trim())
    setStep('method-select')
  }

  function handleManualBackground(value: string) {
    if (value.trim()) {
      setEntries((prev) => [...prev, {
        meta: { name: 'core-background', keywords: [], priority: 900, mode: 'always', scope: 'background' },
        content: value.trim(),
      }])
    }
    setStep('manual-rules')
  }

  function handleManualRules(value: string) {
    if (value.trim()) {
      setEntries((prev) => [...prev, {
        meta: { name: 'core-rules', keywords: [], priority: 800, mode: 'always', scope: 'rule' },
        content: value.trim(),
      }])
    }
    setStep('manual-atmosphere')
  }

  function handleManualAtmosphere(value: string) {
    if (value.trim()) {
      setEntries((prev) => [...prev, {
        meta: { name: 'core-atmosphere', keywords: [], priority: 700, mode: 'always', scope: 'atmosphere' },
        content: value.trim(),
      }])
    }
    setStep('manual-more')
  }

  function handleManualEntryName(value: string) {
    if (!value.trim()) { setStep('manual-more'); return }
    setTempEntryName(value.trim())
    setStep('manual-entry-kw')
  }

  function handleManualEntryKw(value: string) {
    setTempEntryKw(value.trim())
    setStep('manual-entry-content')
  }

  function handleManualEntryContent(value: string) {
    if (value.trim()) {
      setEntries((prev) => [...prev, {
        meta: {
          name: tempEntryName,
          keywords: tempEntryKw.split(',').map((k) => k.trim()).filter(Boolean),
          priority: 100,
          mode: 'keyword',
          scope: 'lore',
        },
        content: value.trim(),
      }])
    }
    setMoreCursor(0)
    setStep('manual-more')
  }

  // --- Distill ---
  function handleDistillPath(sourcePath: string) {
    if (!sourcePath.trim()) return
    setStep('distilling')

    const config = loadConfig()
    if (!config) { setErrorMsg('Config not loaded'); setStep('error'); return }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)
    distiller.on('progress', (p: WorldDistillProgress) => setDistillProgress(p))

    distiller.distill(worldName, sourcePath.trim(), 'markdown')
      .then((generated) => {
        setDistillEntries(generated)
        if (generated.length === 0) {
          setStep('confirm')
        } else {
          setStep('distill-review')
        }
      })
      .catch((err) => { setErrorMsg(String(err)); setStep('error') })
  }

  function handleDistillReviewComplete(accepted: GeneratedEntry[]) {
    setEntries((prev) => [...prev, ...accepted])
    setStep('confirm')
  }

  // --- URL ---
  function handleUrlInput(value: string) {
    if (value.trim()) {
      setUrls((prev) => [...prev, value.trim()])
    } else if (urls.length > 0) {
      // empty line = done entering URLs
      setStep('url-fetching')
      fetchUrls()
    }
  }

  async function fetchUrls() {
    const chunks: SoulChunk[] = []
    for (let i = 0; i < urls.length; i++) {
      setUrlFetchStatus(`${t('wizard.url.fetching')} [${i + 1}/${urls.length}]: ${urls[i]}`)
      try {
        const content = await extractPageContent(urls[i])
        if (content) {
          chunks.push({
            id: crypto.randomUUID(),
            source: 'web',
            content,
            timestamp: new Date().toISOString(),
            context: 'public',
            type: 'knowledge',
            metadata: { url: urls[i] },
          })
        }
      } catch {
        // Skip failed URLs
      }
    }

    if (chunks.length === 0) {
      setUrlFetchStatus(t('wizard.url.no_content'))
      setStep('confirm')
      return
    }

    setUrlFetchStatus(t('wizard.url.distilling'))
    const config = loadConfig()
    if (!config) { setErrorMsg('Config not loaded'); setStep('error'); return }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)
    distiller.on('progress', (p: WorldDistillProgress) => setDistillProgress(p))

    // Use the distiller's classify → cluster → extract on the fetched chunks
    // We call distill with a temp dir approach — but since we already have chunks,
    // we use the internal flow. For simplicity, write chunks to temp markdown and distill.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-url-'))
    for (let i = 0; i < chunks.length; i++) {
      fs.writeFileSync(path.join(tmpDir, `url-${i}.md`), `# ${urls[i]}\n\n${chunks[i].content}`)
    }

    try {
      const generated = await distiller.distill(worldName, tmpDir, 'markdown')
      fs.rmSync(tmpDir, { recursive: true })
      setDistillEntries(generated)
      if (generated.length === 0) {
        setStep('confirm')
      } else {
        setStep('url-review')
      }
    } catch (err) {
      fs.rmSync(tmpDir, { recursive: true })
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  function handleUrlReviewComplete(accepted: GeneratedEntry[]) {
    setEntries((prev) => [...prev, ...accepted])
    setStep('confirm')
  }

  // --- Create ---
  function doCreate() {
    setStep('creating')
    try {
      createWorld(worldName, displayName || worldName, description)
      for (const entry of entries) {
        addEntry(worldName, entry.meta, entry.content)
      }
      setStep('done')
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  // --- Render ---

  if (step === 'error') {
    setTimeout(onCancel, 100)
    return <Text color="red">ERROR: {errorMsg}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    const entryCount = entries.length
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY} bold>✓ {t('wizard.done', { name: worldName })}</Text>
        <Text color={DIM}>  {displayName} — {description}</Text>
        <Text color={DIM}>  {t('wizard.done_entries', { count: String(entryCount) })}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>{t('wizard.title')}</Text>
      <Text color={DIM}>  {t('wizard.esc_hint')}</Text>
      <Text> </Text>

      {/* Step: name */}
      {step === 'name' && (
        <Box>
          <Text color={DIM}>{t('wizard.step.name')}: </Text>
          <TextInput onSubmit={handleName} />
        </Box>
      )}

      {/* Step: name conflict */}
      {step === 'name-conflict' && (
        <Box flexDirection="column">
          <Text color={WARNING}>⚠ {t('wizard.conflict.title', { name: worldName })}</Text>
          {[t('wizard.conflict.overwrite'), t('wizard.conflict.rename')].map((label, i) => (
            <Text key={i}>
              <Text color={i === conflictCursor ? ACCENT : DIM}>{i === conflictCursor ? '  ❯ ' : '    '}</Text>
              <Text color={i === conflictCursor ? PRIMARY : DIM}>{label}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Step: display name */}
      {step === 'display-name' && (
        <Box>
          <Text color={DIM}>{t('wizard.step.display_name', { name: worldName })}: </Text>
          <TextInput onSubmit={handleDisplayName} />
        </Box>
      )}

      {/* Step: description */}
      {step === 'description' && (
        <Box>
          <Text color={DIM}>{t('wizard.step.description')}: </Text>
          <TextInput onSubmit={handleDescription} />
        </Box>
      )}

      {/* Step: method select */}
      {step === 'method-select' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.step.method')}</Text>
          {METHODS.map((m, i) => (
            <Text key={m.value}>
              <Text color={i === methodCursor ? ACCENT : DIM}>{i === methodCursor ? '  ❯ ' : '    '}</Text>
              <Text color={i === methodCursor ? PRIMARY : DIM} bold={i === methodCursor}>
                {t(m.labelKey).padEnd(14)}
              </Text>
              <Text color={DIM}>{t(m.descKey)}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Manual branch */}
      {step === 'manual-background' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.manual.background_hint')}</Text>
          <Box>
            <Text color={ACCENT}>❯ </Text>
            <TextInput onSubmit={handleManualBackground} />
          </Box>
        </Box>
      )}

      {step === 'manual-rules' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.manual.rules_hint')}</Text>
          <Box>
            <Text color={ACCENT}>❯ </Text>
            <TextInput onSubmit={handleManualRules} />
          </Box>
        </Box>
      )}

      {step === 'manual-atmosphere' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.manual.atmosphere_hint')}</Text>
          <Box>
            <Text color={ACCENT}>❯ </Text>
            <TextInput onSubmit={handleManualAtmosphere} />
          </Box>
        </Box>
      )}

      {step === 'manual-more' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.manual.more_hint')}</Text>
          {[t('wizard.manual.add_entry'), t('wizard.manual.finish')].map((label, i) => (
            <Text key={i}>
              <Text color={i === moreCursor ? ACCENT : DIM}>{i === moreCursor ? '  ❯ ' : '    '}</Text>
              <Text color={i === moreCursor ? PRIMARY : DIM}>{label}</Text>
            </Text>
          ))}
          {entries.length > 0 && (
            <Text color={DIM}>  ({t('wizard.manual.current_count', { count: String(entries.length) })})</Text>
          )}
        </Box>
      )}

      {step === 'manual-entry-name' && (
        <Box>
          <Text color={DIM}>{t('wizard.manual.entry_name')}: </Text>
          <TextInput onSubmit={handleManualEntryName} />
        </Box>
      )}

      {step === 'manual-entry-kw' && (
        <Box>
          <Text color={DIM}>{t('wizard.manual.entry_kw')}: </Text>
          <TextInput onSubmit={handleManualEntryKw} />
        </Box>
      )}

      {step === 'manual-entry-content' && (
        <Box>
          <Text color={DIM}>{t('wizard.manual.entry_content')}: </Text>
          <TextInput onSubmit={handleManualEntryContent} />
        </Box>
      )}

      {/* Distill branch */}
      {step === 'distill-path' && (
        <Box>
          <Text color={DIM}>{t('wizard.distill.path_hint')}: </Text>
          <TextInput pathCompletion onSubmit={handleDistillPath} />
        </Box>
      )}

      {step === 'distilling' && (
        <Box flexDirection="column">
          <Text color={ACCENT}>{t('wizard.distill.running')}</Text>
          {distillProgress && (
            <Text color={DIM}>  [{distillProgress.phase}] {distillProgress.current}/{distillProgress.total} — {distillProgress.message}</Text>
          )}
        </Box>
      )}

      {step === 'distill-review' && (
        <WorldDistillReview entries={distillEntries} onComplete={handleDistillReviewComplete} />
      )}

      {/* URL branch */}
      {step === 'url-input' && (
        <Box flexDirection="column">
          <Text color={DIM}>{t('wizard.url.input_hint')}</Text>
          {urls.map((u, i) => (
            <Text key={i} color={DIM}>  {i + 1}. {u}</Text>
          ))}
          <Box>
            <Text color={ACCENT}>❯ </Text>
            <TextInput onSubmit={handleUrlInput} />
          </Box>
        </Box>
      )}

      {step === 'url-fetching' && (
        <Box flexDirection="column">
          <Text color={ACCENT}>{urlFetchStatus}</Text>
          {distillProgress && (
            <Text color={DIM}>  [{distillProgress.phase}] {distillProgress.current}/{distillProgress.total}</Text>
          )}
        </Box>
      )}

      {step === 'url-review' && (
        <WorldDistillReview entries={distillEntries} onComplete={handleUrlReviewComplete} />
      )}

      {/* Confirm */}
      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text color={ACCENT} bold>{t('wizard.confirm.title')}</Text>
          <Text color={DIM}>  {t('wizard.confirm.name')}: <Text color={PRIMARY}>{worldName}</Text></Text>
          <Text color={DIM}>  {t('wizard.confirm.display_name')}: <Text color={PRIMARY}>{displayName || worldName}</Text></Text>
          <Text color={DIM}>  {t('wizard.confirm.description')}: <Text color={PRIMARY}>{description || '—'}</Text></Text>
          <Text color={DIM}>  {t('wizard.confirm.method')}: <Text color={PRIMARY}>{t(`wizard.method.${method}`)}</Text></Text>
          <Text color={DIM}>  {t('wizard.confirm.entries')}: <Text color={PRIMARY}>{entries.length}</Text></Text>
          {entries.length > 0 && (
            <Text color={DIM}>    {summarizeEntries(entries)}</Text>
          )}
          <Text> </Text>
          {[t('wizard.confirm.confirm'), t('wizard.confirm.modify')].map((label, i) => (
            <Text key={i}>
              <Text color={i === confirmCursor ? ACCENT : DIM}>{i === confirmCursor ? '  ❯ ' : '    '}</Text>
              <Text color={i === confirmCursor ? PRIMARY : DIM}>{label}</Text>
            </Text>
          ))}
        </Box>
      )}

      {step === 'creating' && <Text color={DIM}>{t('wizard.creating')}</Text>}
    </Box>
  )
}

function summarizeEntries(entries: GeneratedEntry[]): string {
  const byScope = new Map<string, number>()
  for (const e of entries) {
    byScope.set(e.meta.scope, (byScope.get(e.meta.scope) ?? 0) + 1)
  }
  return [...byScope.entries()].map(([scope, count]) => `${scope}: ${count}`).join(', ')
}
