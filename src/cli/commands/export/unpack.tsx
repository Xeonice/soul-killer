import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import {
  inspectPack,
  applyUnpack,
  suggestRename,
  type ConflictItem,
  type ConflictResolution,
} from '../../../export/pack/unpacker.js'
import { worldExists } from '../../../world/manifest.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

interface UnpackCommandProps {
  args: string
  onComplete: () => void
  onCancel: () => void
}

type UnpackPhase = 'inspecting' | 'conflict' | 'applying' | 'done' | 'error'

interface ConflictState {
  items: ConflictItem[]
  current: number
  resolutions: Map<string, ConflictResolution>
  selectedOption: number  // 0=overwrite, 1=rename, 2=skip
}

export function UnpackCommand({ args, onComplete, onCancel }: UnpackCommandProps) {
  const [phase, setPhase] = useState<UnpackPhase>('inspecting')
  const [error, setError] = useState('')
  const [checksumWarning, setChecksumWarning] = useState(false)

  // Inspection results stored in ref-like state
  const [inspectResult, setInspectResult] = useState<{
    meta: Awaited<ReturnType<typeof inspectPack>>['meta']
    stagingDir: string
    conflicts: ConflictItem[]
  } | null>(null)

  const [conflict, setConflict] = useState<ConflictState>({
    items: [],
    current: 0,
    resolutions: new Map(),
    selectedOption: 0,
  })

  const [result, setResult] = useState<{
    installed: { type: string; name: string }[]
    skipped: { type: string; name: string }[]
    renamed: { type: string; from: string; to: string }[]
  } | null>(null)

  const filePath = args.trim()

  useEffect(() => {
    if (!filePath) {
      setError(t('unpack.missing_path'))
      setPhase('error')
      return
    }

    const resolvedPath = filePath.startsWith('/')
      ? filePath
      : path.resolve(process.cwd(), filePath)

    inspectPack(resolvedPath)
      .then((res) => {
        // Check for checksum mismatch
        if (res.meta.checksum.startsWith('MISMATCH:')) {
          setChecksumWarning(true)
          res.meta.checksum = res.meta.checksum.replace('MISMATCH:', '')
        }

        setInspectResult(res)

        if (res.conflicts.length > 0) {
          setConflict({
            items: res.conflicts,
            current: 0,
            resolutions: new Map(),
            selectedOption: 0,
          })
          setPhase('conflict')
        } else {
          // No conflicts, apply directly
          setPhase('applying')
          const unpackResult = applyUnpack(res.meta, res.stagingDir, new Map())
          setResult(unpackResult)
          setPhase('done')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [filePath])

  // Handle conflict resolution keyboard input
  useInput((input, key) => {
    if (phase !== 'conflict') return

    if (key.upArrow) {
      setConflict((prev) => ({
        ...prev,
        selectedOption: (prev.selectedOption - 1 + 3) % 3,
      }))
    } else if (key.downArrow) {
      setConflict((prev) => ({
        ...prev,
        selectedOption: (prev.selectedOption + 1) % 3,
      }))
    } else if (key.return) {
      handleConflictConfirm()
    } else if (key.escape) {
      // Cancel unpack, cleanup staging
      if (inspectResult) {
        try { fs.rmSync(inspectResult.stagingDir, { recursive: true, force: true }) } catch {}
      }
      onCancel()
    }
  }, { isActive: phase === 'conflict' })

  const handleConflictConfirm = useCallback(() => {
    setConflict((prev) => {
      const item = prev.items[prev.current]
      if (!item) return prev

      const key = `${item.type}:${item.name}`
      const newResolutions = new Map(prev.resolutions)

      if (prev.selectedOption === 0) {
        newResolutions.set(key, 'overwrite')
      } else if (prev.selectedOption === 1) {
        const existsCheck = item.type === 'soul'
          ? (n: string) => fs.existsSync(path.join(os.homedir(), '.soulkiller', 'souls', n, 'manifest.json'))
          : (n: string) => worldExists(n)
        const suggested = suggestRename(item.name, existsCheck)
        newResolutions.set(key, { rename: suggested })
      } else {
        newResolutions.set(key, 'skip')
      }

      const nextCurrent = prev.current + 1

      if (nextCurrent >= prev.items.length) {
        // All conflicts resolved, apply
        if (inspectResult) {
          try {
            const unpackResult = applyUnpack(inspectResult.meta, inspectResult.stagingDir, newResolutions)
            setResult(unpackResult)
            setPhase('done')
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setPhase('error')
          }
        }
        return { ...prev, resolutions: newResolutions, current: nextCurrent }
      }

      return {
        ...prev,
        current: nextCurrent,
        resolutions: newResolutions,
        selectedOption: 0,
      }
    })
  }, [inspectResult])

  if (phase === 'inspecting') {
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.inspecting')}</Text>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box flexDirection="column">
        <Text color={WARNING}>{t('unpack.error', { message: error })}</Text>
      </Box>
    )
  }

  if (phase === 'conflict') {
    const item = conflict.items[conflict.current]
    if (!item) return null

    const options = [
      t('unpack.conflict_overwrite'),
      t('unpack.conflict_rename'),
      t('unpack.conflict_skip'),
    ]

    return (
      <Box flexDirection="column">
        {checksumWarning && (
          <Text color={WARNING}>{t('unpack.checksum_warning')}</Text>
        )}
        <Text color={WARNING}>
          {t('unpack.conflict_found', {
            type: item.type,
            name: item.name,
            current: String(conflict.current + 1),
            total: String(conflict.items.length),
          })}
        </Text>
        <Box flexDirection="column" marginLeft={2}>
          {options.map((opt, i) => (
            <Text key={opt} color={i === conflict.selectedOption ? ACCENT : DIM}>
              {i === conflict.selectedOption ? '> ' : '  '}{opt}
            </Text>
          ))}
        </Box>
        <Text color={DIM}>{t('unpack.conflict_hint')}</Text>
      </Box>
    )
  }

  if (phase === 'applying') {
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.applying')}</Text>
      </Box>
    )
  }

  // phase === 'done'
  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('unpack.success')}</Text>
      {result?.installed.map((item) => (
        <Text key={`${item.type}:${item.name}`} color={DIM}>
          {'  '}{t('unpack.item_installed', { type: item.type, name: item.name })}
        </Text>
      ))}
      {result?.renamed.map((item) => (
        <Text key={`${item.type}:${item.from}`} color={DIM}>
          {'  '}{t('unpack.item_renamed', { type: item.type, from: item.from, to: item.to })}
        </Text>
      ))}
      {result?.skipped.map((item) => (
        <Text key={`${item.type}:${item.name}`} color={DIM}>
          {'  '}{t('unpack.item_skipped', { type: item.type, name: item.name })}
        </Text>
      ))}
    </Box>
  )
}
