import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { WorldDistiller, type WorldDistillProgress, type GeneratedEntry } from '../../world/distill.js'
import { WorldDistillReview } from './world-distill-review.js'
import { worldExists } from '../../world/manifest.js'
import { getLLMClient } from '../../llm/client.js'
import { loadConfig } from '../../config/loader.js'
import type { AdapterType } from '../../ingest/pipeline.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'

type Step = 'distilling' | 'review' | 'writing' | 'done' | 'error'

interface WorldDistillProps {
  worldName: string
  sourcePath: string
  adapterType: AdapterType
  noReview?: boolean
  onComplete: () => void
}

export function WorldDistillCommand({
  worldName,
  sourcePath,
  adapterType,
  noReview,
  onComplete,
}: WorldDistillProps) {
  const [step, setStep] = useState<Step>('distilling')
  const [progress, setProgress] = useState<WorldDistillProgress | null>(null)
  const [entries, setEntries] = useState<GeneratedEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 'distilling') return
    if (!worldExists(worldName)) {
      setError(t('world.error.not_found', { name: worldName }))
      setStep('error')
      return
    }

    const config = loadConfig()
    if (!config) {
      setError('Config not loaded')
      setStep('error')
      return
    }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.on('progress', (p: WorldDistillProgress) => setProgress(p))

    distiller.distill(worldName, sourcePath, adapterType)
      .then((generated) => {
        setEntries(generated)
        if (noReview || generated.length === 0) {
          return distiller.writeEntries(worldName, generated).then(() => {
            setStep('done')
          })
        } else {
          setStep('review')
        }
      })
      .catch((err) => {
        setError(String(err))
        setStep('error')
      })
  }, [])

  function handleReviewComplete(accepted: GeneratedEntry[]) {
    setStep('writing')
    const config = loadConfig()
    if (!config) return

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.writeEntries(worldName, accepted)
      .then(() => setStep('done'))
      .catch((err) => {
        setError(String(err))
        setStep('error')
      })
  }

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">ERROR: {error}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {t('world.distill.done', { name: worldName, count: String(entries.length) })}</Text>
  }

  if (step === 'review') {
    return <WorldDistillReview entries={entries} onComplete={handleReviewComplete} />
  }

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('world.distill.running', { name: worldName })}</Text>
      {progress && (
        <Text color={DIM}>
          [{progress.phase}] {progress.current}/{progress.total} — {progress.message}
        </Text>
      )}
      {step === 'writing' && <Text color={DIM}>{t('world.distill.writing')}</Text>}
    </Box>
  )
}

interface WorldEvolveProps {
  worldName: string
  sourcePath: string
  adapterType: AdapterType
  onComplete: () => void
}

export function WorldEvolveCommand({
  worldName,
  sourcePath,
  adapterType,
  onComplete,
}: WorldEvolveProps) {
  const [step, setStep] = useState<'evolving' | 'done' | 'error'>('evolving')
  const [progress, setProgress] = useState<WorldDistillProgress | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 'evolving') return

    const config = loadConfig()
    if (!config) {
      setError('Config not loaded')
      setStep('error')
      return
    }

    const client = getLLMClient()
    const model = config.llm.distill_model ?? config.llm.default_model
    const distiller = new WorldDistiller(client, model)

    distiller.on('progress', (p: WorldDistillProgress) => setProgress(p))

    distiller.evolve(worldName, sourcePath, adapterType)
      .then(({ newEntries, conflicts }) => {
        // For now, auto-add new entries and skip conflicts
        // TODO: interactive conflict resolution
        return distiller.finalizeEvolve(worldName, newEntries)
      })
      .then(() => setStep('done'))
      .catch((err) => {
        setError(String(err))
        setStep('error')
      })
  }, [])

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">ERROR: {error}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {t('world.evolve.done', { name: worldName })}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('world.evolve.running', { name: worldName })}</Text>
      {progress && (
        <Text color={DIM}>
          [{progress.phase}] {progress.current}/{progress.total} — {progress.message}
        </Text>
      )}
    </Box>
  )
}
