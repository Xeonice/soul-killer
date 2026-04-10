import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { SoulkillerProtocolPanel } from './soulkiller-protocol-panel.js'
import { DistillProgressPanel } from '../components/distill-progress.js'
import { PRIMARY, ACCENT, DIM, DARK } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'
import { t } from '../../i18n/index.js'
import type { SoulTaskStatus, SoulTaskPhase } from '../../soul/batch-pipeline.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const PHASE_LABEL: Record<SoulTaskPhase, string> = {
  pending: 'pending',
  capturing: 'capturing',
  distilling: 'distilling',
  done: 'done',
  failed: 'FAILED',
}

function phaseColor(phase: SoulTaskPhase): string {
  switch (phase) {
    case 'done': return PRIMARY
    case 'failed': return ACCENT
    case 'pending': return DIM
    default: return ACCENT
  }
}

function progressBar(status: SoulTaskStatus): string {
  if (status.phase === 'done') return '████████████'
  if (status.phase === 'failed') return '████████████'
  if (status.phase === 'pending') return '░░░░░░░░░░░░'

  // Estimate progress based on tool calls
  const totalSteps = 15 // approximate max steps per agent
  let progress = 0
  if (status.phase === 'capturing') {
    progress = Math.min(status.toolCalls.length / totalSteps, 0.5)
  } else if (status.phase === 'distilling') {
    progress = 0.5 + Math.min(status.distillToolCalls.length / 12, 0.5)
  }

  const filled = Math.round(progress * 12)
  return '█'.repeat(filled) + '░'.repeat(12 - filled)
}

interface BatchProtocolPanelProps {
  statuses: SoulTaskStatus[]
  /** Called when user wants to cancel (Esc in compact view) */
  onCancel?: () => void
}

export function BatchProtocolPanel({ statuses, onCancel }: BatchProtocolPanelProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)
  const [viewMode, setViewMode] = useState<'compact' | 'detail'>('compact')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Throttle: only re-render at animation frame rate
  const lastRenderRef = useRef(0)

  useEffect(() => {
    const allDone = statuses.every((s) => s.phase === 'done' || s.phase === 'failed')
    if (allDone || !animationEnabled) return
    const timer = setInterval(() => {
      const now = Date.now()
      if (now - lastRenderRef.current >= 80) {
        lastRenderRef.current = now
        setFrame((f) => f + 1)
      }
    }, 80)
    return () => clearInterval(timer)
  }, [statuses, animationEnabled])

  useInput(useCallback((_input: string, key: any) => {
    if (viewMode === 'compact') {
      if (key.escape) {
        onCancel?.()
        return
      }
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1))
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(statuses.length - 1, i + 1))
      }
      if (key.return) {
        setViewMode('detail')
      }
    } else {
      // Detail view
      if (key.escape) {
        setViewMode('compact')
      }
    }
  }, [viewMode, statuses.length, onCancel]))

  const spinnerChar = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  const doneCount = statuses.filter((s) => s.phase === 'done').length
  const failedCount = statuses.filter((s) => s.phase === 'failed').length
  const activeCount = statuses.filter((s) => s.phase === 'capturing' || s.phase === 'distilling').length

  if (viewMode === 'detail') {
    const soul = statuses[selectedIndex]
    if (!soul) {
      setViewMode('compact')
      return null
    }

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>SOULKILLER PROTOCOL — {soul.name}</Text>
        <Text color={DIM}>  [Esc] {t('batch.back_to_list')}</Text>
        <Text> </Text>
        {(soul.phase === 'capturing' || (soul.phase === 'distilling' && soul.toolCalls.length > 0) || soul.phase === 'done' || soul.phase === 'failed') && (
          <SoulkillerProtocolPanel
            mode="soul"
            targetName={soul.name}
            classification={soul.classification}
            origin={soul.origin}
            toolCalls={soul.toolCalls}
            totalFragments={soul.fragments}
            elapsedTime={soul.elapsedMs}
            filterProgress={soul.filterProgress}
            phase={soul.capturePhase ?? (soul.phase === 'capturing' ? 'initiating' : 'complete')}
            searchPlan={soul.searchPlan}
          />
        )}
        {(soul.phase === 'distilling' || (soul.phase === 'done' && soul.distillToolCalls.length > 0) || (soul.phase === 'failed' && soul.distillToolCalls.length > 0)) && (
          <Box flexDirection="column" marginTop={1}>
            <DistillProgressPanel
              toolCalls={soul.distillToolCalls}
              phase={soul.distillPhase ?? 'distilling'}
            />
          </Box>
        )}
        {soul.phase === 'pending' && (
          <Text color={DIM}>  {t('batch.waiting')}</Text>
        )}
        {soul.error && (
          <Text color={ACCENT}>  ✗ {soul.error}</Text>
        )}
      </Box>
    )
  }

  // Compact view
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>SOULKILLER PROTOCOL — BATCH CAPTURE [{statuses.length}]</Text>
      <Text> </Text>
      {statuses.map((soul, index) => {
        const isSelected = index === selectedIndex
        const prefix = isSelected ? '▸ ' : '  '
        const label = PHASE_LABEL[soul.phase]
        const bar = progressBar(soul)
        const isActive = soul.phase === 'capturing' || soul.phase === 'distilling'
        const fragText = soul.fragments > 0 ? `${soul.fragments} frags` : '—'

        return (
          <Text key={soul.name}>
            <Text color={isSelected ? PRIMARY : DIM}>{prefix}</Text>
            <Text color={isSelected ? PRIMARY : undefined}>{soul.name.padEnd(16)}</Text>
            <Text color={phaseColor(soul.phase)}>
              {label.padEnd(12)}
            </Text>
            <Text color={soul.phase === 'failed' ? ACCENT : isActive ? ACCENT : PRIMARY}>
              {bar}
            </Text>
            <Text color={DIM}> {fragText}</Text>
            {isActive && <Text color={ACCENT}> {spinnerChar}</Text>}
            {soul.phase === 'done' && <Text color={PRIMARY}> ✓</Text>}
            {soul.phase === 'failed' && <Text color={ACCENT}> ✗</Text>}
          </Text>
        )
      })}
      <Text> </Text>
      <Text color={DIM}>
        {'  '}{doneCount}/{statuses.length} {t('batch.complete')}  ·  {activeCount} {t('batch.active')}  ·  {failedCount} {t('batch.failed')}
      </Text>
      <Text> </Text>
      <Text color={DIM}>  [↑↓] {t('batch.select')}  [Enter] {t('batch.expand')}  [Esc] {t('batch.cancel')}</Text>
    </Box>
  )
}
