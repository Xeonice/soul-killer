import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DARK, DIM } from '../animation/colors.js'
import { isAnimationEnabled } from '../animation/use-animation.js'
import { t } from '../../infra/i18n/index.js'
import type { WorldDistillProgress, DimensionStats } from '../../world/distill.js'
import { ALL_WORLD_DIMENSIONS, WORLD_DIMENSIONS } from '../../world/capture/world-dimensions.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

interface WorldDistillPanelProps {
  progress: WorldDistillProgress | null
  worldName: string
}

export function WorldDistillPanel({ progress, worldName }: WorldDistillPanelProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)

  const isDone = progress?.phase === 'extract' && progress.current === progress.total && progress.total > 0

  useEffect(() => {
    if (isDone || !animationEnabled) return
    const timer = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(timer)
  }, [isDone, animationEnabled])

  const spinner = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  if (!progress) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={56}>
        <Text color={ACCENT} bold> {t('worldforge.title')} — {t('wizard.distill.running')} </Text>
        <Text> </Text>
        <Text color={ACCENT}>  {spinner} {t('wizard.distill.running')}</Text>
        <Text> </Text>
      </Box>
    )
  }

  const phaseOrder = ['ingest', 'classify', 'cluster', 'extract']
  const currentPhaseIdx = phaseOrder.indexOf(progress.phase)

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={56}>
      <Text color={ACCENT} bold> {t('worldforge.title')} — {worldName} </Text>
      <Text> </Text>

      {/* Phase 1: Ingest */}
      <PhaseRow
        label="数据摄入"
        done={currentPhaseIdx > 0}
        active={progress.phase === 'ingest'}
        detail={progress.phase === 'ingest' ? progress.message : `${progress.total > 0 ? progress.message : ''}`}
        spinner={spinner}
      />

      {/* Phase 2: Classify */}
      {currentPhaseIdx >= 1 && (
        <>
          <Text> </Text>
          <PhaseRow
            label="维度分类"
            done={currentPhaseIdx > 1}
            active={progress.phase === 'classify'}
            detail={progress.phase === 'classify'
              ? `${progress.current}/${progress.total}`
              : progress.message}
            spinner={spinner}
          />
          {progress.dimensionStats && (
            <DimensionStatsDisplay stats={progress.dimensionStats} />
          )}
        </>
      )}

      {/* Phase 3: Cluster */}
      {currentPhaseIdx >= 2 && (
        <>
          <Text> </Text>
          <PhaseRow
            label="语义聚类"
            done={currentPhaseIdx > 2}
            active={progress.phase === 'cluster'}
            detail={progress.message}
            spinner={spinner}
          />
        </>
      )}

      {/* Phase 4: Extract */}
      {currentPhaseIdx >= 3 && (
        <>
          <Text> </Text>
          <PhaseRow
            label="条目生成"
            done={isDone}
            active={progress.phase === 'extract' && !isDone}
            detail={`${progress.current}/${progress.total}`}
            spinner={spinner}
          />
          {progress.generatedEntries && progress.generatedEntries.length > 0 && (
            <GeneratedEntriesDisplay
              entries={progress.generatedEntries}
              currentDimension={progress.entryDimension}
              isExtracting={!isDone}
              spinner={spinner}
            />
          )}
        </>
      )}

      <Text> </Text>
    </Box>
  )
}

function PhaseRow({ label, done, active, detail, spinner }: {
  label: string; done?: boolean; active?: boolean; detail?: string; spinner: string
}) {
  const color = done ? PRIMARY : active ? ACCENT : DIM
  const icon = done ? '✓' : active ? spinner : '○'
  return (
    <Text color={color}>
      {'  ▓ '}{label}{'  '}{detail ? <Text color={DIM}>{detail}</Text> : ''}{' '}{icon}
    </Text>
  )
}

function DimensionStatsDisplay({ stats }: { stats: DimensionStats }) {
  // Show dimensions in a compact grid
  const dims = ALL_WORLD_DIMENSIONS.filter((d) => (stats[d] ?? 0) > 0)
  if (dims.length === 0) return null

  // 3 per row
  const rows: string[][] = []
  for (let i = 0; i < dims.length; i += 3) {
    rows.push(dims.slice(i, i + 3))
  }

  return (
    <Box flexDirection="column" paddingLeft={4}>
      {rows.map((row, ri) => (
        <Text key={ri} color={DIM}>
          {row.map((d) => `${d}: ${stats[d] ?? 0}`).join('  ').padEnd(48)}
        </Text>
      ))}
    </Box>
  )
}

function GeneratedEntriesDisplay({ entries, currentDimension, isExtracting, spinner }: {
  entries: { name: string; dimension?: string; scope: string }[]
  currentDimension?: string
  isExtracting: boolean
  spinner: string
}) {
  // Show last 5 generated entries
  const visible = entries.slice(-5)
  return (
    <Box flexDirection="column" paddingLeft={4}>
      {visible.map((e, i) => (
        <Text key={i} color={PRIMARY}>
          {'▸ '}{e.name}{e.dimension ? <Text color={DIM}> ({e.dimension})</Text> : ''}{' ✓'}
        </Text>
      ))}
      {isExtracting && currentDimension && (
        <Text color={ACCENT}>
          {'▸ '}{currentDimension}{` ${spinner}`}
        </Text>
      )}
    </Box>
  )
}
