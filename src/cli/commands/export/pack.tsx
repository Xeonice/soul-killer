import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import { packSoul, packWorld, packAll, type PackOptions, type PackAllProgress } from '../../../export/pack/packer.js'

interface PackCommandProps {
  args: string
  onComplete: () => void
}

type PackPhase = 'packing' | 'done' | 'error'

// ─── Single-item mode ───────────────────────────────────────────────────────

function PackSingleCommand({ args }: PackCommandProps) {
  const [phase, setPhase] = useState<PackPhase>('packing')
  const [resultPath, setResultPath] = useState('')
  const [resultSize, setResultSize] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const parts = args.trim().split(/\s+/)
    const subcommand = parts[0]  // 'soul' or 'world'
    const name = parts[1]

    if (!subcommand || !name) {
      setError(t('pack.missing_args'))
      setPhase('error')
      return
    }

    if (subcommand !== 'soul' && subcommand !== 'world') {
      setError(t('pack.invalid_subcommand', { sub: subcommand }))
      setPhase('error')
      return
    }

    const options: PackOptions = {}
    if (parts.includes('--with-snapshots')) options.withSnapshots = true
    const outputIdx = parts.indexOf('--output')
    if (outputIdx !== -1 && parts[outputIdx + 1]) options.output = parts[outputIdx + 1]

    const run = subcommand === 'soul' ? packSoul : packWorld

    run(name, options)
      .then((result) => {
        setResultPath(result.outputPath)
        setResultSize(result.size)
        setPhase('done')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [args])

  if (phase === 'packing') {
    return <Box flexDirection="column"><Text color={PRIMARY}>{t('pack.packing')}</Text></Box>
  }
  if (phase === 'error') {
    return <Box flexDirection="column"><Text color={WARNING}>{t('pack.error', { message: error })}</Text></Box>
  }

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('pack.success')}</Text>
      <Text color={DIM}>{t('pack.output_path', { path: resultPath })}</Text>
      <Text color={DIM}>{t('pack.file_size', { size: formatSize(resultSize) })}</Text>
    </Box>
  )
}

// ─── All mode ────────────────────────────────────────────────────────────────

type BundleStatus = 'waiting' | 'packing' | 'done' | 'error'

interface BundleState {
  status: BundleStatus
  count: number
  outputPath?: string
  size?: number
  error?: string
}

function PackAllCommand({ args }: PackCommandProps) {
  const [souls, setSouls] = useState<BundleState>({ status: 'waiting', count: 0 })
  const [worlds, setWorlds] = useState<BundleState>({ status: 'waiting', count: 0 })
  const [done, setDone] = useState(false)

  useEffect(() => {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const options: PackOptions = {}
    if (parts.includes('--with-snapshots')) options.withSnapshots = true
    const outputIdx = parts.indexOf('--output')
    if (outputIdx !== -1 && parts[outputIdx + 1]) options.output = parts[outputIdx + 1]

    packAll({
      ...options,
      onProgress: (event: PackAllProgress) => {
        const setState = event.type === 'souls-bundle' ? setSouls : setWorlds
        setState({
          status: event.status === 'packing' ? 'packing' : event.status === 'done' ? 'done' : 'error',
          count: event.count,
          outputPath: event.outputPath,
          size: event.size,
          error: event.error,
        })
      },
    }).then(() => setDone(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box flexDirection="column">
      <Text color={PRIMARY}>{t('pack.all_start')}</Text>
      <Text> </Text>

      <BundleRow label="Soul" state={souls} />
      <BundleRow label="World" state={worlds} />

      {done && (
        <>
          <Text> </Text>
          <Text color={ACCENT}>{t('pack.all_summary')}</Text>
        </>
      )}
    </Box>
  )
}

function BundleRow({ label, state }: { label: string; state: BundleState }) {
  const color = state.status === 'error' ? WARNING : state.status === 'done' ? ACCENT : DIM
  const icon = bundleIcon(state.status)

  let detail = ''
  if (state.status === 'done' && state.count > 0) {
    detail = ` (${state.count} 个)  →  ${state.outputPath}  (${formatSize(state.size ?? 0)})`
  } else if (state.status === 'error') {
    detail = `  ✗ ${state.error}`
  } else if (state.status === 'packing') {
    detail = ` (${state.count} 个) ...`
  }

  return (
    <Text color={color}>{icon} {label}{detail}</Text>
  )
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function PackCommand({ args, onComplete }: PackCommandProps) {
  const trimmed = args.trim()
  // All mode: no args, or only flags (--output / --with-snapshots)
  const isAllMode = !trimmed || trimmed.startsWith('--')
  return isAllMode
    ? <PackAllCommand args={trimmed} onComplete={onComplete} />
    : <PackSingleCommand args={trimmed} onComplete={onComplete} />
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bundleIcon(status: BundleStatus): string {
  switch (status) {
    case 'waiting': return '·'
    case 'packing': return '⟳'
    case 'done':    return '✓'
    case 'error':   return '✗'
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
