import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { isAnimationEnabled } from '../animation/use-animation.js'
import type { DistillPhase } from '../../distill/extractor.js'
import { t } from '../../i18n/index.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const PHASE_LABEL_KEYS: Record<DistillPhase, string> = {
  identity: 'distill.phase.identity',
  style: 'distill.phase.style',
  behavior: 'distill.phase.behavior',
  merge: 'distill.phase.merge',
  generate: 'distill.phase.generate',
}

const PHASE_ORDER: DistillPhase[] = ['identity', 'style', 'behavior', 'merge', 'generate']

export interface PhaseState {
  status: 'pending' | 'active' | 'done'
  batch?: number
  totalBatches?: number
}

interface DistillProgressPanelProps {
  phases: Record<DistillPhase, PhaseState>
}

export function DistillProgressPanel({ phases }: DistillProgressPanelProps) {
  const [frame, setFrame] = useState(0)
  const animationEnabled = isAnimationEnabled()

  const hasActive = PHASE_ORDER.some((p) => phases[p].status === 'active')

  useEffect(() => {
    if (!hasActive || !animationEnabled) return
    const timer = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(timer)
  }, [hasActive, animationEnabled])

  const spinnerChar = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  return (
    <Box flexDirection="column">
      <Text color={PRIMARY}>▓ {t('distill.in_progress')}</Text>
      {PHASE_ORDER.map((phase) => {
        const state = phases[phase]
        const label = t(PHASE_LABEL_KEYS[phase])

        if (state.status === 'done') {
          return (
            <Text key={phase} color={PRIMARY}>
              {'  ▸ '}{label} ✓
            </Text>
          )
        }

        if (state.status === 'active') {
          const batchInfo = state.batch && state.totalBatches && state.totalBatches > 1
            ? ` (${state.batch}/${state.totalBatches})`
            : ''
          return (
            <Text key={phase} color={ACCENT}>
              {'  ▸ '}{label}{batchInfo} {spinnerChar}
            </Text>
          )
        }

        return (
          <Text key={phase} color={DIM}>
            {'  ○ '}{label}
          </Text>
        )
      })}
    </Box>
  )
}

export function createInitialPhases(): Record<DistillPhase, PhaseState> {
  return {
    identity: { status: 'pending' },
    style: { status: 'pending' },
    behavior: { status: 'pending' },
    merge: { status: 'pending' },
    generate: { status: 'pending' },
  }
}
