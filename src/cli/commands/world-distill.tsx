import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { TextInput } from '../components/text-input.js'
import { WorldDistillPanel } from '../components/world-distill-panel.js'
import { WorldDistiller, type WorldDistillProgress, type GeneratedEntry } from '../../world/distill.js'
import { WorldDistillReview } from './world-distill-review.js'
import { worldExists } from '../../world/manifest.js'
import { getLLMClient } from '../../llm/client.js'
import { loadConfig } from '../../config/loader.js'
import type { AdapterType } from '../../ingest/pipeline.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'

type DistillStep = 'collect-path' | 'distilling' | 'review' | 'writing' | 'done' | 'error'

interface WorldDistillProps {
  worldName: string
  sourcePath?: string
  adapterType?: AdapterType
  noReview?: boolean
  onComplete: () => void
}

export function WorldDistillCommand({
  worldName,
  sourcePath: initialPath,
  adapterType = 'markdown',
  noReview,
  onComplete,
}: WorldDistillProps) {
  const [step, setStep] = useState<DistillStep>(initialPath ? 'distilling' : 'collect-path')
  const [sourcePath, setSourcePath] = useState(initialPath ?? '')
  const [progress, setProgress] = useState<WorldDistillProgress | null>(null)
  const [entries, setEntries] = useState<GeneratedEntry[]>([])
  const [error, setError] = useState('')

  function handlePathSubmit(path: string) {
    if (!path.trim()) return
    setSourcePath(path.trim())
    setStep('distilling')
  }

  useEffect(() => {
    if (step !== 'distilling' || !sourcePath) return
    if (!worldExists(worldName)) {
      setError(t('world.error.not_found', { name: worldName }))
      setStep('error')
      return
    }

    const config = loadConfig()
    if (!config) { setError('Config not loaded'); setStep('error'); return }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.on('progress', (p: WorldDistillProgress) => setProgress(p))

    distiller.distill(worldName, sourcePath, adapterType)
      .then((generated) => {
        setEntries(generated)
        if (noReview || generated.length === 0) {
          return distiller.writeEntries(worldName, generated).then(() => setStep('done'))
        } else {
          setStep('review')
        }
      })
      .catch((err) => { setError(String(err)); setStep('error') })
  }, [step, sourcePath])

  function handleReviewComplete(accepted: GeneratedEntry[]) {
    setStep('writing')
    const config = loadConfig()
    if (!config) return

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.writeEntries(worldName, accepted)
      .then(() => { setEntries(accepted); setStep('done') })
      .catch((err) => { setError(String(err)); setStep('error') })
  }

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">ERROR: {error}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {t('world.distill.done', { name: worldName, count: String(entries.length) })}</Text>
  }

  if (step === 'collect-path') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('world.menu.distill')} — {worldName}</Text>
        <Box>
          <Text color={DIM}>{t('world.collect.source_path')}: </Text>
          <TextInput pathCompletion onSubmit={handlePathSubmit} />
        </Box>
      </Box>
    )
  }

  if (step === 'review') {
    return <WorldDistillReview entries={entries} onComplete={handleReviewComplete} />
  }

  // distilling or writing
  return <WorldDistillPanel progress={progress} worldName={worldName} />
}

// ─── Evolve Command ───

type EvolveStep = 'collect-path' | 'evolving' | 'done' | 'error'

interface WorldEvolveProps {
  worldName: string
  sourcePath?: string
  adapterType?: AdapterType
  onComplete: () => void
}

export function WorldEvolveCommand({
  worldName,
  sourcePath: initialPath,
  adapterType = 'markdown',
  onComplete,
}: WorldEvolveProps) {
  const [step, setStep] = useState<EvolveStep>(initialPath ? 'evolving' : 'collect-path')
  const [sourcePath, setSourcePath] = useState(initialPath ?? '')
  const [progress, setProgress] = useState<WorldDistillProgress | null>(null)
  const [error, setError] = useState('')

  function handlePathSubmit(path: string) {
    if (!path.trim()) return
    setSourcePath(path.trim())
    setStep('evolving')
  }

  useEffect(() => {
    if (step !== 'evolving' || !sourcePath) return

    const config = loadConfig()
    if (!config) { setError('Config not loaded'); setStep('error'); return }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.on('progress', (p: WorldDistillProgress) => setProgress(p))

    distiller.evolve(worldName, sourcePath, adapterType)
      .then(({ newEntries }) => {
        return distiller.finalizeEvolve(worldName, newEntries)
      })
      .then(() => setStep('done'))
      .catch((err) => { setError(String(err)); setStep('error') })
  }, [step, sourcePath])

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">ERROR: {error}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {t('world.evolve.done', { name: worldName })}</Text>
  }

  if (step === 'collect-path') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>{t('world.menu.evolve')} — {worldName}</Text>
        <Box>
          <Text color={DIM}>{t('world.collect.source_path')}: </Text>
          <TextInput pathCompletion onSubmit={handlePathSubmit} />
        </Box>
      </Box>
    )
  }

  // evolving
  return <WorldDistillPanel progress={progress} worldName={worldName} />
}
