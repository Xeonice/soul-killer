import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'
import { isAnimationEnabled } from '../animation/use-animation.js'
import { t } from '../../infra/i18n/index.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const DISTILL_TOOL_ICON: Record<string, string> = {
  sampleChunks: '📖',
  writeIdentity: '✏️',
  writeStyle: '✏️',
  writeBehavior: '✏️',
  writeExample: '💬',
  reviewSoul: '🔍',
  finalize: '📝',
}

export interface DistillToolCallDisplay {
  tool: string
  detail: string
  status: 'running' | 'done'
  resultSummary?: string
}

interface DistillProgressPanelProps {
  toolCalls: DistillToolCallDisplay[]
  phase: 'distilling' | 'complete'
}

export function DistillProgressPanel({ toolCalls, phase }: DistillProgressPanelProps) {
  const [frame, setFrame] = useState(0)
  const animationEnabled = isAnimationEnabled()

  useEffect(() => {
    if (phase === 'complete' || !animationEnabled) return
    const timer = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(timer)
  }, [phase, animationEnabled])

  const spinnerChar = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  return (
    <Box flexDirection="column">
      <Text color={phase === 'complete' ? PRIMARY : ACCENT}>
        ▓ {phase === 'complete' ? t('distill.complete') : t('distill.in_progress')}
        {phase === 'complete' ? ' ✓' : ` ${spinnerChar}`}
      </Text>
      {toolCalls.map((tc, i) => (
        <Text key={i} color={tc.status === 'done' ? PRIMARY : ACCENT}>
          {'  ▸ '}
          {DISTILL_TOOL_ICON[tc.tool] ?? '🔧'}{' '}
          {tc.tool}{tc.detail ? ` (${tc.detail})` : ''}
          {tc.status === 'done'
            ? ` → ${tc.resultSummary ?? ''} ✓`
            : ` ${spinnerChar}`
          }
        </Text>
      ))}
    </Box>
  )
}
