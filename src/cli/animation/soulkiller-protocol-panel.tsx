import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DARK, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'
import type { TargetClassification } from '../../agent/soul-capture-agent.js'
import { t } from '../../i18n/index.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const CLASSIFICATION_LABELS: Record<TargetClassification, string> = {
  DIGITAL_CONSTRUCT: 'DIGITAL CONSTRUCT',
  PUBLIC_ENTITY: 'PUBLIC ENTITY',
  HISTORICAL_RECORD: 'HISTORICAL RECORD',
  UNKNOWN_ENTITY: 'UNKNOWN ENTITY',
}

export type AgentPhase = 'initiating' | 'searching' | 'classifying' | 'analyzing' | 'filtering' | 'complete' | 'unknown'

export interface ToolCallDisplay {
  tool: string
  query: string
  status: 'running' | 'done'
  resultCount?: number
  phase?: AgentPhase
}

export interface SearchPlanDimDisplay {
  dimension: string
  priority: string
  queries: string[]
}

interface SoulkillerProtocolPanelProps {
  targetName: string
  classification?: TargetClassification
  origin?: string
  toolCalls: ToolCallDisplay[]
  totalFragments?: number
  elapsedTime?: number
  filterProgress?: { kept: number; total: number }
  phase: AgentPhase
  searchPlan?: SearchPlanDimDisplay[]
}

const TOOL_ICON: Record<string, string> = {
  search: '🔍',
  extractPage: '📄',
  planSearch: '📋',
  checkCoverage: '📊',
  reportFindings: '📝',
}

function groupByPhase(toolCalls: ToolCallDisplay[]): { phase: AgentPhase; calls: ToolCallDisplay[] }[] {
  const groups: { phase: AgentPhase; calls: ToolCallDisplay[] }[] = []
  for (const tc of toolCalls) {
    const p = tc.phase ?? 'searching'
    const last = groups[groups.length - 1]
    if (last && last.phase === p) {
      last.calls.push(tc)
    } else {
      groups.push({ phase: p, calls: [tc] })
    }
  }
  return groups
}

function phaseLabel(phase: AgentPhase): string {
  switch (phase) {
    case 'searching': return t('protocol.phase_recon')
    case 'classifying': return t('protocol.phase_planning')
    case 'analyzing': return t('protocol.phase_collecting')
    default: return t('protocol.extracting')
  }
}

function isPhaseComplete(groupPhase: AgentPhase, currentPhase: AgentPhase): boolean {
  const order: AgentPhase[] = ['initiating', 'searching', 'classifying', 'analyzing', 'filtering', 'complete']
  return order.indexOf(groupPhase) < order.indexOf(currentPhase)
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
  searchPlan,
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
        <Text color={ACCENT} bold> {t('protocol.title')} </Text>
        <Text> </Text>
        <Text color={PRIMARY}>  ▓ {t('protocol.initiating_done')}</Text>
        <Text> </Text>
        <Text color={DARK}>  ▓ {t('protocol.unknown_scan', { name: targetName })}</Text>
        <Text color={DARK}>    {t('protocol.unknown_classification')}</Text>
        <Text color={DARK}>    {t('protocol.unknown_footprint')}</Text>
        <Text> </Text>
        <Text color={DARK}>  {t('protocol.manual_required')}</Text>
        <Text> </Text>
        <Text color={DIM}>  {t('protocol.not_found')}</Text>
        <Text color={DIM}>  {t('protocol.provide_data')}</Text>
        <Text> </Text>
      </Box>
    )
  }

  const groups = groupByPhase(toolCalls)

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={56}>
      <Text color={ACCENT} bold> {t('protocol.title')} </Text>
      <Text> </Text>

      {/* Phase 0: Initiating */}
      {phase === 'initiating' && (
        <Text color={ACCENT}>
          {'  ▓'}{engine.glitchText(t('protocol.initiating'), Math.max(0.1, 0.5 - frame * 0.01))}
        </Text>
      )}

      {/* Active phases: show progress grouped by phase */}
      {phase !== 'initiating' && (
        <>
          <Text color={PRIMARY}>  ▓ {t('protocol.initiating_done')}</Text>

          {groups.map((group, gi) => {
            const done = isPhaseComplete(group.phase, phase)
            return (
              <React.Fragment key={gi}>
                <Text> </Text>
                <Text color={done ? PRIMARY : ACCENT}>
                  {'  ▓'}{phaseLabel(group.phase)}
                  {done ? ' ✓' : ` ${spinnerChar}`}
                </Text>
                {group.calls.map((tc, i) => (
                  <Text key={i} color={tc.status === 'done' ? PRIMARY : ACCENT}>
                    {'    ▸ '}
                    {TOOL_ICON[tc.tool] ?? '🔍'}{' '}
                    {truncate(tc.query, 32)}
                    {tc.status === 'done'
                      ? ` ${t('protocol.results', { count: String(tc.resultCount ?? 0) })}`
                      : ` ${spinnerChar}`
                    }
                  </Text>
                ))}
              </React.Fragment>
            )
          })}

          {/* Classification reveal — after planning phase */}
          {classification && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>  ▓ {t('protocol.target_acquired')} <Text color={ACCENT}>{targetName}</Text></Text>
              <Text color={PRIMARY}>    {t('protocol.classification')} <Text bold>{CLASSIFICATION_LABELS[classification]}</Text></Text>
              {origin && <Text color={DIM}>    {t('protocol.origin')} {origin}</Text>}
            </>
          )}

          {/* Search plan — after classification */}
          {searchPlan && searchPlan.length > 0 && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>  ▓ {t('protocol.search_plan')}</Text>
              {searchPlan.map((d) => {
                const priorityLabel = d.priority === 'required' ? t('protocol.priority.required')
                  : d.priority === 'important' ? t('protocol.priority.important')
                  : t('protocol.priority.supplementary')
                const queryPreview = d.queries.length > 0
                  ? d.queries.slice(0, 2).map((q) => truncate(q, 24)).join(' / ')
                  : ''
                return (
                  <Text key={d.dimension} color={DIM}>
                    {'    '}{d.dimension.padEnd(12)} <Text color={d.priority === 'required' ? PRIMARY : DIM}>({priorityLabel})</Text>{queryPreview ? `  ${queryPreview}` : ''}
                  </Text>
                )
              })}
            </>
          )}

          {/* Filtering / Compiling report */}
          {phase === 'filtering' && (
            <>
              <Text> </Text>
              <Text color={ACCENT}>
                {'  ▓'}{filterProgress ? t('protocol.filtering') : t('protocol.compiling')}{' '}{spinnerChar}
              </Text>
              {filterProgress && (
                <Text color={DIM}>
                  {'    '}{t('protocol.filter_progress', { kept: String(filterProgress.kept), total: String(filterProgress.total) })}
                </Text>
              )}
            </>
          )}

          {/* Complete */}
          {phase === 'complete' && (
            <>
              <Text> </Text>
              <Text color={PRIMARY}>
                {'  ▓'}{t('protocol.fragments')}{' '}<Text bold>{totalFragments ?? 0}</Text>
              </Text>
              {elapsedTime !== undefined && (
                <Text color={DIM}>    {t('protocol.elapsed', { time: (elapsedTime / 1000).toFixed(1) })}</Text>
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
