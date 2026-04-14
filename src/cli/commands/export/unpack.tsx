import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'
import {
  inspectPack,
  applyUnpack,
  suggestRename,
  batchUnpackDir,
  type ConflictItem,
  type ConflictResolution,
  type UnpackResult,
  type BatchUnpackResult,
} from '../../../export/pack/unpacker.js'
import type { PackMeta } from '../../../export/pack/meta.js'
import { downloadPack } from '../../../export/pack/downloader.js'
import { worldExists } from '../../../world/manifest.js'
import { TextInput } from '../../components/text-input.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

interface UnpackCommandProps {
  args: string
  onComplete: () => void
  onCancel: () => void
}

type WizardPhase =
  | 'type-select'
  | 'source-select'
  | 'path-input'
  | 'url-input'
  | 'downloading'
  | 'inspecting'
  | 'conflict-strategy'
  | 'conflict-item'
  | 'applying'
  | 'done'
  | 'error'

// ─── Init from args ───────────────────────────────────────────────────────────

function initFromArgs(args: string): {
  phase: WizardPhase
  resolvedPath: string
  isDir: boolean
  error: string
} {
  const trimmed = args.trim()
  if (!trimmed) return { phase: 'type-select', resolvedPath: '', isDir: false, error: '' }

  const filePart = trimmed.split(/\s+/)[0]!
  const resolved = filePart.startsWith('/') ? filePart : path.resolve(process.cwd(), filePart)

  try {
    const stat = fs.statSync(resolved)
    const isDir = stat.isDirectory()
    return {
      phase: isDir ? 'conflict-strategy' : 'inspecting',
      resolvedPath: resolved,
      isDir,
      error: '',
    }
  } catch {
    return { phase: 'error', resolvedPath: '', isDir: false, error: `Not found: ${filePart}` }
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UnpackCommand({ args, onComplete, onCancel }: UnpackCommandProps) {
  const [init] = useState(() => initFromArgs(args))

  const [phase, setPhase] = useState<WizardPhase>(init.phase)
  const [resolvedPath, setResolvedPath] = useState(init.resolvedPath)
  const [isDir, setIsDir] = useState(init.isDir)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [batchStrategy, setBatchStrategy] = useState<'skip' | 'overwrite'>('skip')
  const tempFileRef = useRef<string | null>(null)

  // Inspect result (set after inspecting phase)
  const [inspectResult, setInspectResult] = useState<{
    meta: PackMeta
    stagingDir: string
    conflicts: ConflictItem[]
  } | null>(null)
  const [checksumWarning, setChecksumWarning] = useState(false)

  // Selector indices
  const [typeIdx, setTypeIdx] = useState(0)      // 0=soul, 1=world
  const [sourceIdx, setSourceIdx] = useState(0)  // 0=local, 1=online
  const [strategyIdx, setStrategyIdx] = useState(0)  // 0=skip-all, 1=overwrite-all, [2=one-by-one]
  const [conflictOptionIdx, setConflictOptionIdx] = useState(0)  // 0=overwrite, 1=rename, 2=skip

  // Per-item conflict resolution state
  const [conflictCurrent, setConflictCurrent] = useState(0)
  const conflictResolutionsRef = useRef(new Map<string, ConflictResolution>())

  // Results
  const [applyResult, setApplyResult] = useState<UnpackResult | null>(null)
  const [batchResult, setBatchResult] = useState<BatchUnpackResult | null>(null)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState(init.error)

  // ── Cleanup temp file on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tempFileRef.current) {
        try { fs.unlinkSync(tempFileRef.current) } catch {}
      }
    }
  }, [])

  // ── Phase: downloading ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'downloading') return
    downloadPack(downloadUrl)
      .then((tmpPath) => {
        tempFileRef.current = tmpPath
        setResolvedPath(tmpPath)
        setIsDir(false)
        setPhase('inspecting')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [phase, downloadUrl])

  // ── Phase: inspecting ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'inspecting') return
    inspectPack(resolvedPath)
      .then((res) => {
        if (res.meta.checksum.startsWith('MISMATCH:')) {
          setChecksumWarning(true)
          res.meta.checksum = res.meta.checksum.replace('MISMATCH:', '')
        }
        setInspectResult(res)
        if (res.conflicts.length > 0) {
          setStrategyIdx(0)
          setPhase('conflict-strategy')
        } else {
          // No conflicts — apply immediately
          try {
            const result = applyUnpack(res.meta, res.stagingDir, new Map())
            setApplyResult(result)
            setPhase('done')
          } catch (applyErr) {
            setError(applyErr instanceof Error ? applyErr.message : String(applyErr))
            setPhase('error')
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [phase, resolvedPath])

  // ── Phase: applying (directory batch only) ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'applying') return
    setBatchProgress({ current: 0, total: 0 })
    batchUnpackDir(resolvedPath, {
      onConflict: batchStrategy,
      onProgress: (event) => {
        setBatchProgress({ current: event.current, total: event.total })
      },
    })
      .then((result) => {
        setBatchResult(result)
        setPhase('done')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [phase, resolvedPath, batchStrategy])

  // ── Apply single file (sync, called directly) ────────────────────────────────
  const applySingle = useCallback((resolutions: Map<string, ConflictResolution>) => {
    if (!inspectResult) return
    try {
      const result = applyUnpack(inspectResult.meta, inspectResult.stagingDir, resolutions)
      setApplyResult(result)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }, [inspectResult])

  // ── Per-item conflict confirm ────────────────────────────────────────────────
  const handleConflictConfirm = useCallback(() => {
    const items = inspectResult?.conflicts ?? []
    const item = items[conflictCurrent]
    if (!item) return

    const key = `${item.type}:${item.name}`
    if (conflictOptionIdx === 0) {
      conflictResolutionsRef.current.set(key, 'overwrite')
    } else if (conflictOptionIdx === 1) {
      const existsCheck = item.type === 'soul'
        ? (n: string) => fs.existsSync(path.join(os.homedir(), '.soulkiller', 'souls', n, 'manifest.json'))
        : (n: string) => worldExists(n)
      conflictResolutionsRef.current.set(key, { rename: suggestRename(item.name, existsCheck) })
    } else {
      conflictResolutionsRef.current.set(key, 'skip')
    }

    const next = conflictCurrent + 1
    if (next >= items.length) {
      applySingle(new Map(conflictResolutionsRef.current))
    } else {
      setConflictCurrent(next)
      setConflictOptionIdx(0)
    }
  }, [inspectResult, conflictCurrent, conflictOptionIdx, applySingle])

  // ── Path submit ───────────────────────────────────────────────────────────────
  const handlePathSubmit = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const resolved = trimmed.startsWith('/') ? trimmed : path.resolve(process.cwd(), trimmed)
    try {
      const stat = fs.statSync(resolved)
      const dir = stat.isDirectory()
      setResolvedPath(resolved)
      setIsDir(dir)
      setStrategyIdx(0)
      setPhase(dir ? 'conflict-strategy' : 'inspecting')
    } catch {
      setError(`Not found: ${trimmed}`)
      setPhase('error')
    }
  }, [])

  // ── URL submit ────────────────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setDownloadUrl(trimmed)
    setPhase('downloading')
  }, [])

  // ── Keyboard input ────────────────────────────────────────────────────────────
  const isTextPhase = phase === 'path-input' || phase === 'url-input'
  const isAsyncPhase = phase === 'downloading' || phase === 'inspecting' || phase === 'applying'

  useInput((input, key) => {
    if (phase === 'type-select') {
      if (key.upArrow)    setTypeIdx((i) => Math.max(0, i - 1))
      else if (key.downArrow) setTypeIdx((i) => Math.min(1, i + 1))
      else if (key.return)    setPhase('source-select')
      else if (key.escape)    onCancel()

    } else if (phase === 'source-select') {
      if (key.upArrow)    setSourceIdx((i) => Math.max(0, i - 1))
      else if (key.downArrow) setSourceIdx((i) => Math.min(1, i + 1))
      else if (key.return)    setPhase(sourceIdx === 0 ? 'path-input' : 'url-input')
      else if (key.escape)    setPhase('type-select')

    } else if (phase === 'conflict-strategy') {
      const maxIdx = isDir ? 1 : 2
      if (key.upArrow)    setStrategyIdx((i) => Math.max(0, i - 1))
      else if (key.downArrow) setStrategyIdx((i) => Math.min(maxIdx, i + 1))
      else if (key.return) {
        if (isDir) {
          // Directory: use batchUnpackDir
          setBatchStrategy(strategyIdx === 1 ? 'overwrite' : 'skip')
          setPhase('applying')
        } else if (strategyIdx === 2) {
          // Per-item
          conflictResolutionsRef.current.clear()
          setConflictCurrent(0)
          setConflictOptionIdx(0)
          setPhase('conflict-item')
        } else {
          // Skip-all or overwrite-all
          const resolution: ConflictResolution = strategyIdx === 1 ? 'overwrite' : 'skip'
          const resolutions = new Map<string, ConflictResolution>()
          for (const c of inspectResult?.conflicts ?? []) {
            resolutions.set(`${c.type}:${c.name}`, resolution)
          }
          applySingle(resolutions)
        }
      }
      else if (key.escape) onCancel()

    } else if (phase === 'conflict-item') {
      if (key.upArrow)    setConflictOptionIdx((i) => Math.max(0, i - 1))
      else if (key.downArrow) setConflictOptionIdx((i) => Math.min(2, i + 1))
      else if (key.return)    handleConflictConfirm()
      else if (key.escape)    onCancel()

    } else if (phase === 'done' || phase === 'error') {
      if (key.return || key.escape) onComplete()
    }
  }, { isActive: !isTextPhase && !isAsyncPhase })

  // ─── Rendering ────────────────────────────────────────────────────────────────

  if (phase === 'type-select') {
    const options = [t('unpack.wizard_type_soul'), t('unpack.wizard_type_world')]
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.wizard_type_title')}</Text>
        <Text> </Text>
        {options.map((opt, i) => (
          <Text key={opt} color={i === typeIdx ? ACCENT : DIM}>
            {i === typeIdx ? '> ' : '  '}{opt}
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('unpack.wizard_hint_nav')}</Text>
      </Box>
    )
  }

  if (phase === 'source-select') {
    const options = [t('unpack.wizard_source_local'), t('unpack.wizard_source_online')]
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.wizard_source_title')}</Text>
        <Text> </Text>
        {options.map((opt, i) => (
          <Text key={opt} color={i === sourceIdx ? ACCENT : DIM}>
            {i === sourceIdx ? '> ' : '  '}{opt}
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('unpack.wizard_hint_nav')}</Text>
      </Box>
    )
  }

  if (phase === 'path-input') {
    return (
      <Box flexDirection="column">
        <Text color={DIM}>{t('unpack.wizard_path_prompt')}</Text>
        <TextInput pathCompletion onSubmit={handlePathSubmit} onEscape={onCancel} />
      </Box>
    )
  }

  if (phase === 'url-input') {
    return (
      <Box flexDirection="column">
        <Text color={DIM}>{t('unpack.wizard_url_prompt')}</Text>
        <TextInput onSubmit={handleUrlSubmit} onEscape={onCancel} />
      </Box>
    )
  }

  if (phase === 'downloading') {
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.wizard_downloading')}</Text>
        <Text color={DIM}>  {downloadUrl}</Text>
      </Box>
    )
  }

  if (phase === 'inspecting') {
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>{t('unpack.inspecting')}</Text>
      </Box>
    )
  }

  if (phase === 'conflict-strategy') {
    const conflicts = inspectResult?.conflicts ?? []
    const strategyOptions = [
      t('unpack.wizard_conflict_skip_all'),
      t('unpack.wizard_conflict_overwrite_all'),
      ...(!isDir ? [t('unpack.wizard_conflict_one_by_one')] : []),
    ]
    const displayConflicts = conflicts.slice(0, 5)
    const moreCount = conflicts.length - displayConflicts.length

    return (
      <Box flexDirection="column">
        {checksumWarning && <Text color={WARNING}>{t('unpack.checksum_warning')}</Text>}
        {isDir ? (
          <Text color={PRIMARY}>{t('unpack.wizard_conflicts_dir')}</Text>
        ) : (
          <Text color={WARNING}>{t('unpack.wizard_conflicts_title', { count: String(conflicts.length) })}</Text>
        )}
        {!isDir && displayConflicts.map((c) => (
          <Text key={`${c.type}:${c.name}`} color={DIM}>
            {'  • '}{c.name}  <Text color={DIM}>({c.type})</Text>
          </Text>
        ))}
        {!isDir && moreCount > 0 && (
          <Text color={DIM}>{'  '}... {moreCount} more</Text>
        )}
        <Text> </Text>
        {strategyOptions.map((opt, i) => (
          <Text key={opt} color={i === strategyIdx ? ACCENT : DIM}>
            {i === strategyIdx ? '> ' : '  '}{opt}
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('unpack.wizard_hint_nav')}</Text>
      </Box>
    )
  }

  if (phase === 'conflict-item') {
    const conflicts = inspectResult?.conflicts ?? []
    const item = conflicts[conflictCurrent]
    if (!item) return null
    const conflictOptions = [
      t('unpack.conflict_overwrite'),
      t('unpack.conflict_rename'),
      t('unpack.conflict_skip'),
    ]
    return (
      <Box flexDirection="column">
        {checksumWarning && <Text color={WARNING}>{t('unpack.checksum_warning')}</Text>}
        <Text color={WARNING}>
          {t('unpack.conflict_found', {
            type: item.type,
            name: item.name,
            current: String(conflictCurrent + 1),
            total: String(conflicts.length),
          })}
        </Text>
        <Box flexDirection="column" marginLeft={2}>
          {conflictOptions.map((opt, i) => (
            <Text key={opt} color={i === conflictOptionIdx ? ACCENT : DIM}>
              {i === conflictOptionIdx ? '> ' : '  '}{opt}
            </Text>
          ))}
        </Box>
        <Text color={DIM}>{t('unpack.conflict_hint')}</Text>
      </Box>
    )
  }

  if (phase === 'applying') {
    const { current, total } = batchProgress
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY}>
          {t('unpack.applying')}{total > 0 ? `  (${current} / ${total})` : ''}
        </Text>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box flexDirection="column">
        <Text color={WARNING}>{t('unpack.error', { message: error })}</Text>
        <Text> </Text>
        <Text color={DIM}>{t('unpack.wizard_hint_close')}</Text>
      </Box>
    )
  }

  // ── done ─────────────────────────────────────────────────────────────────────
  const meta = applyResult?.meta ?? inspectResult?.meta ?? null
  const installed = applyResult?.installed ?? batchResult?.installed ?? []
  const skipped   = applyResult?.skipped  ?? batchResult?.skipped  ?? []
  const renamed   = applyResult?.renamed  ?? []
  const batchErrors = batchResult?.errors ?? []

  const sourceName = downloadUrl
    ? (() => { try { return new URL(downloadUrl).pathname.split('/').pop() ?? 'download' } catch { return downloadUrl } })()
    : path.basename(resolvedPath)

  const packTypeName = meta ? formatPackType(meta) : (isDir ? t('unpack.wizard_overview_dir') : '—')
  const soulsInstalled  = installed.filter((i) => i.type === 'soul').length
  const worldsInstalled = installed.filter((i) => i.type === 'world').length
  const installedParts = [
    soulsInstalled  > 0 ? `${soulsInstalled} Soul`  : '',
    worldsInstalled > 0 ? `${worldsInstalled} World` : '',
  ].filter(Boolean)
  const installedSummary = installedParts.length > 0 ? installedParts.join(' + ') : '0'

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('unpack.success')}</Text>
      <Text> </Text>
      <Text color={DIM}>  {padLabel(t('unpack.wizard_overview_type'))}{packTypeName}</Text>
      <Text color={DIM}>  {padLabel(t('unpack.wizard_overview_source'))}{sourceName}</Text>
      <Text color={installed.length > 0 ? ACCENT : DIM}>
        {'  '}{padLabel(t('unpack.wizard_overview_installed'))}{installedSummary}
      </Text>
      {skipped.length > 0 && (
        <Text color={DIM}>  {padLabel(t('unpack.wizard_overview_skipped'))}{skipped.length}</Text>
      )}
      {renamed.length > 0 && (
        <Text color={DIM}>  {padLabel(t('unpack.wizard_overview_renamed'))}{renamed.length}</Text>
      )}
      {batchErrors.length > 0 && (
        <Text color={WARNING}>  {padLabel(t('unpack.wizard_overview_errors'))}{batchErrors.length}</Text>
      )}
      <Text> </Text>
      <Text color={DIM}>{t('unpack.wizard_hint_close')}</Text>
    </Box>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPackType(meta: PackMeta): string {
  const n = meta.items?.length ?? 0
  switch (meta.type) {
    case 'souls-bundle':  return `Soul Bundle  (${n} 个角色)`
    case 'worlds-bundle': return `World Bundle  (${n} 个世界)`
    case 'soul':          return `Soul — ${meta.display_name}`
    case 'world':         return `World — ${meta.display_name}`
    default:              return meta.type
  }
}

/** Pad a label to a fixed display width (accounts for double-width CJK chars). */
function padLabel(label: string): string {
  // Each CJK char counts as 2 display columns; target column width = 12
  let width = 0
  for (const ch of label) {
    width += ch.codePointAt(0)! > 0x2E7F ? 2 : 1
  }
  const pad = Math.max(0, 12 - width)
  return label + ' '.repeat(pad)
}
