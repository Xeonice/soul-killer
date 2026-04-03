import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DARK, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'
import type { TargetClassification } from '../../agent/soul-capture-agent.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const CLASSIFICATION_LABELS: Record<TargetClassification, string> = {
  DIGITAL_CONSTRUCT: 'DIGITAL CONSTRUCT',
  PUBLIC_ENTITY: 'PUBLIC ENTITY',
  HISTORICAL_RECORD: 'HISTORICAL RECORD',
  UNKNOWN_ENTITY: 'UNKNOWN ENTITY',
}

export interface ToolCallDisplay {
  tool: string
  query: string
  status: 'running' | 'done'
  resultCount?: number
}

interface SoulkillerProtocolPanelProps {
  targetName: string
  classification?: TargetClassification
  origin?: string
  toolCalls: ToolCallDisplay[]
  totalFragments?: number
  elapsedTime?: number
  filterProgress?: { kept: number; total: number }
  phase: 'initiating' | 'searching' | 'classifying' | 'analyzing' | 'filtering' | 'complete' | 'unknown'
}

export function SoulkillerProtocolPanel({
  targetName,
  classification,
  origin,
  toolCalls,
  totalFragments,
  elapsedTime,
  filterProgress,
  phase,
}: SoulkillerProtocolPanelProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)
  const engine = getGlitchEngine()

  useEffect(() => {
    if (phase === 'complete' || !animationEnabled) return
    const timer = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(timer)
  }, [phase, animationEnabled])

  const spinnerChar = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  // UNKNOWN_ENTITY — malfunction panel
  if (phase === 'unknown') {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={DARK} paddingX={1} width={56}>
        <Text color={ACCENT} bold> SOULKILLER PROTOCOL </Text>
        <Text> </Text>
        <Text color={PRIMARY}>  ▓ initiating soul capture...         ✓</Text>
        <Text> </Text>
        <Text color={DARK}>  ▓ target scan: {targetName}</Text>
        <Text color={DARK}>    classification: {CLASSIFICATION_LABELS.UNKNOWN_ENTITY}</Text>
        <Text color={DARK}>    cyberspace footprint: INSUFFICIENT</Text>
        <Text> </Text>
        <Text color={DARK}>  ██ MANUAL EXTRACTION REQUIRED ██</Text>
        <Text> </Text>
        <Text color={DIM}>  target not found in cyberspace.</Text>
        <Text color={DIM}>  provide raw neural data to proceed.</Text>
        <Text> </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={56}>
      <Text color={ACCENT} bold> SOULKILLER PROTOCOL </Text>
      <Text> </Text>

      {/* Phase 1: Initiating */}
      {phase === 'initiating' && (
        <Text color={ACCENT}>
          {'  ▓ '}{engine.glitchText('initiating soul capture...', Math.max(0.1, 0.5 - frame * 0.01))}
        </Text>
      )}

      {/* Active phases: show progress */}
      {phase !== 'initiating' && (
        <>
          <Text color={PRIMARY}>  ▓ initiating soul capture...         ✓</Text>

          {/* Classification if detected */}
          {classification && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>  ▓ target acquired: <Text color={ACCENT}>{targetName}</Text></Text>
              <Text color={PRIMARY}>    classification: <Text bold>{CLASSIFICATION_LABELS[classification]}</Text></Text>
              {origin && <Text color={DIM}>    origin: {origin}</Text>}
            </>
          )}

          {/* Tool calls — the core realtime section */}
          {toolCalls.length > 0 && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>  ▓ extracting neural patterns...</Text>
              {toolCalls.map((tc, i) => (
                <Text key={i} color={tc.status === 'done' ? PRIMARY : ACCENT}>
                  {'    ▸ '}
                  {tc.tool === 'wikipedia' ? '📖' : '🔍'}{' '}
                  {truncate(tc.query, 32)}
                  {tc.status === 'done'
                    ? ` → ${tc.resultCount ?? 0} results ✓`
                    : ` ${spinnerChar}`
                  }
                </Text>
              ))}
            </>
          )}

          {/* Classifying — LLM analyzing search results */}
          {phase === 'classifying' && !classification && (
            <>
              <Text> </Text>
              <Text color={ACCENT}>
                {'  ▓ classifying target: '}{targetName}{'... '}{spinnerChar}
              </Text>
            </>
          )}

          {/* Filtering */}
          {phase === 'filtering' && (
            <>
              <Text> </Text>
              <Text color={ACCENT}>
                {'  ▓ filtering irrelevant data... '}{spinnerChar}
              </Text>
              {filterProgress && (
                <Text color={DIM}>
                  {'    '}{filterProgress.kept} relevant / {filterProgress.total} checked
                </Text>
              )}
            </>
          )}

          {/* Complete */}
          {phase === 'complete' && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>
                {'  ▓ soul fragments captured: '}<Text bold>{totalFragments ?? 0}</Text>
              </Text>
              {elapsedTime !== undefined && (
                <Text color={DIM}>    extraction time: {(elapsedTime / 1000).toFixed(1)}s</Text>
              )}
            </>
          )}
        </>
      )}

      <Text> </Text>
    </Box>
  )
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}
