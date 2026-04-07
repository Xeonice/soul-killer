import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import { packSoul, packWorld, type PackOptions } from '../../pack/packer.js'

interface PackCommandProps {
  args: string
  onComplete: () => void
}

type PackPhase = 'packing' | 'done' | 'error'

export function PackCommand({ args, onComplete }: PackCommandProps) {
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

    // Parse optional flags
    const options: PackOptions = {}
    if (parts.includes('--with-snapshots')) {
      options.withSnapshots = true
    }
    const outputIdx = parts.indexOf('--output')
    if (outputIdx !== -1 && parts[outputIdx + 1]) {
      options.output = parts[outputIdx + 1]
    }

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
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('pack.packing')}</Text>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box flexDirection="column">
        <Text color={WARNING}>{t('pack.error', { message: error })}</Text>
      </Box>
    )
  }

  const sizeStr = resultSize < 1024
    ? `${resultSize} B`
    : resultSize < 1024 * 1024
      ? `${(resultSize / 1024).toFixed(1)} KB`
      : `${(resultSize / (1024 * 1024)).toFixed(1)} MB`

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('pack.success')}</Text>
      <Text color={DIM}>{t('pack.output_path', { path: resultPath })}</Text>
      <Text color={DIM}>{t('pack.file_size', { size: sizeStr })}</Text>
    </Box>
  )
}
