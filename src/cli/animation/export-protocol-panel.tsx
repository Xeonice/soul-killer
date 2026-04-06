import React, { useState, useEffect } from 'react'
import { Text, Box, useInput } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DARK, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'
import { t } from '../../i18n/index.js'
import type { ExportProgressEvent, ExportPhase, AskUserOption } from '../../agent/export-agent.js'

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

const TOOL_ICON: Record<string, string> = {
  list_souls: '🔍',
  list_worlds: '🔍',
  read_soul: '📖',
  read_world: '📖',
  package_skill: '📦',
}

// --- Trail step (completed step summary) ---

interface TrailStep {
  description: string
  summary?: string
}

// --- Active zone state ---

type ActiveZoneState =
  | { type: 'idle' }
  | { type: 'tool'; tool: string; args?: Record<string, unknown> }
  | { type: 'select'; question: string; options: AskUserOption[]; cursor: number }
  | { type: 'text_input'; question: string; value: string; items: string[] }
  | { type: 'packaging'; steps: { name: string; status: 'pending' | 'running' | 'done' }[] }
  | { type: 'complete'; output_dir: string; files: string[]; skill_name?: string }
  | { type: 'error'; error: string }

// --- Props ---

interface ExportProtocolPanelProps {
  phase: ExportPhase
  trail: TrailStep[]
  activeZone: ActiveZoneState
  onSelectConfirm?: (index: number) => void
  onTextSubmit?: (value: string) => void
  onCancel?: () => void
}

export function ExportProtocolPanel({
  phase,
  trail,
  activeZone,
  onSelectConfirm,
  onTextSubmit,
  onCancel,
}: ExportProtocolPanelProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)
  const engine = getGlitchEngine()

  useEffect(() => {
    if (phase === 'complete' || phase === 'error' || !animationEnabled) return
    const timer = setInterval(() => setFrame((f) => f + 1), 80)
    return () => clearInterval(timer)
  }, [phase, animationEnabled])

  const spinnerChar = SPINNER_CHARS[frame % SPINNER_CHARS.length]

  // Handle keyboard input for select and text_input modes
  useInput((input, key) => {
    if (key.escape) {
      onCancel?.()
      return
    }

    if (activeZone.type === 'select') {
      if (key.upArrow) {
        onSelectConfirm?.(-1) // signal: move up
      } else if (key.downArrow) {
        onSelectConfirm?.(-2) // signal: move down
      } else if (key.return) {
        onSelectConfirm?.(activeZone.cursor)
      }
    }

    if (activeZone.type === 'text_input') {
      if (key.return) {
        onTextSubmit?.(activeZone.value)
      }
    }
  })

  // --- Render trail (collapse if > 4 steps) ---
  const renderTrail = () => {
    if (trail.length === 0) return null

    if (trail.length <= 4) {
      return trail.map((step, i) => (
        <React.Fragment key={i}>
          <Text color={PRIMARY}>  ▓ {step.description} ✓</Text>
          {step.summary && <Text color={DIM}>    ▸ {step.summary}</Text>}
        </React.Fragment>
      ))
    }

    // Collapse early steps into summary
    const early = trail.slice(0, -2)
    const recent = trail.slice(-2)

    const summaryParts: string[] = []
    for (const s of early) {
      if (s.summary) summaryParts.push(s.summary)
    }

    return (
      <>
        <Text color={PRIMARY}>  ▓ {summaryParts.join(' · ') || early.map((s) => s.description).join(' · ')} ✓</Text>
        {recent.map((step, i) => (
          <React.Fragment key={i}>
            <Text color={PRIMARY}>  ▓ {step.description} ✓</Text>
            {step.summary && <Text color={DIM}>    ▸ {step.summary}</Text>}
          </React.Fragment>
        ))}
      </>
    )
  }

  // --- Render active zone ---
  const renderActiveZone = () => {
    switch (activeZone.type) {
      case 'idle':
        return phase === 'initiating' ? (
          <Text color={ACCENT}>
            {'  ▓'}{engine.glitchText(t('export.initiating'), Math.max(0.1, 0.5 - frame * 0.01))}
          </Text>
        ) : null

      case 'tool': {
        const icon = TOOL_ICON[activeZone.tool] ?? '🔧'
        const argsStr = activeZone.args
          ? `(${Object.values(activeZone.args).map(String).join(', ')})`
          : ''
        return (
          <Text color={ACCENT}>
            {'  ▓ '}{icon} {activeZone.tool}{argsStr} {spinnerChar}
          </Text>
        )
      }

      case 'select':
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={ACCENT}>  ▓ {activeZone.question}</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={DARK} paddingX={1}>
              {activeZone.options.map((opt, i) => {
                const selected = i === activeZone.cursor
                return (
                  <Box key={i} flexDirection="column">
                    <Text color={selected ? ACCENT : PRIMARY}>
                      {selected ? '  ❯ ' : '    '}{opt.label}
                    </Text>
                    {opt.description && (
                      <Text color={DIM}>{'      '}{opt.description}</Text>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )

      case 'text_input':
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={ACCENT}>  ▓ {activeZone.question}</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={DARK} paddingX={1}>
              <Text color={PRIMARY}>  {'> '}{activeZone.value}<Text color={ACCENT}>_</Text></Text>
              {activeZone.items.length > 0 && (
                <>
                  <Text> </Text>
                  <Text color={DIM}>  已输入:</Text>
                  {activeZone.items.map((item, i) => (
                    <Text key={i} color={DIM}>    {i + 1}. {item}</Text>
                  ))}
                </>
              )}
            </Box>
          </Box>
        )

      case 'packaging':
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={ACCENT}>  ▓ {t('export.step.packaging')} {spinnerChar}</Text>
            <Text> </Text>
            {activeZone.steps.map((step, i) => {
              const icon = step.status === 'done' ? '✓' : step.status === 'running' ? `▸ ${spinnerChar}` : '○'
              const color = step.status === 'done' ? PRIMARY : step.status === 'running' ? ACCENT : DIM
              return (
                <Text key={i} color={color}>    {icon} {t(`export.${step.name}` as 'export.copy_soul')}</Text>
              )
            })}
          </Box>
        )

      case 'complete': {
        const hint = activeZone.skill_name
          ? t('export.done_hint', { name: activeZone.skill_name })
          : t('export.step.complete')
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={PRIMARY}>  ▓ {t('export.step.complete')} ✓</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1}>
              <Text color={ACCENT}>  {activeZone.output_dir}</Text>
              <Text> </Text>
              {activeZone.files.map((f, i) => (
                <Text key={i} color={DIM}>  {'├── '}{f}</Text>
              ))}
              <Text> </Text>
              <Text color={PRIMARY}>  {hint}</Text>
            </Box>
          </Box>
        )
      }

      case 'error':
        return (
          <Text color={ACCENT}>  ▓ {t('export.error', { error: activeZone.error })}</Text>
        )
    }
  }

  // --- Status bar ---
  const renderStatusBar = () => {
    let hint = t('export.status.esc')
    if (activeZone.type === 'select') hint = t('export.status.select')
    else if (activeZone.type === 'text_input') hint = t('export.status.input')

    return <Text color={DIM}>  {hint}</Text>
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={60}>
      <Text color={ACCENT} bold> {t('export.title')} </Text>
      <Text> </Text>

      {/* Progress trail */}
      {phase !== 'initiating' && trail.length > 0 && (
        <>
          {renderTrail()}
          <Text> </Text>
        </>
      )}

      {/* Active zone */}
      {renderActiveZone()}

      <Text> </Text>
      {renderStatusBar()}
      <Text> </Text>
    </Box>
  )
}

// --- Export panel state manager (used by ExportCommand) ---

export interface ExportPanelState {
  phase: ExportPhase
  trail: TrailStep[]
  activeZone: ActiveZoneState
}

export function createInitialPanelState(): ExportPanelState {
  return {
    phase: 'initiating',
    trail: [],
    activeZone: { type: 'idle' },
  }
}

export function reducePanelEvent(
  state: ExportPanelState,
  event: ExportProgressEvent,
): ExportPanelState {
  switch (event.type) {
    case 'phase':
      return { ...state, phase: event.phase }

    case 'tool_start':
      return {
        ...state,
        activeZone: { type: 'tool', tool: event.tool, args: event.args },
      }

    case 'tool_end': {
      // Move completed tool to trail
      const description = event.tool
      const summary = event.result_summary
      return {
        ...state,
        trail: [...state.trail, { description, summary }],
        activeZone: { type: 'idle' },
      }
    }

    case 'ask_user_start': {
      if (event.options && event.options.length > 0) {
        return {
          ...state,
          activeZone: { type: 'select', question: event.question, options: event.options, cursor: 0 },
        }
      }
      return {
        ...state,
        activeZone: { type: 'text_input', question: event.question, value: '', items: [] },
      }
    }

    case 'ask_user_end': {
      // Move to trail
      const prevZone = state.activeZone
      const desc = prevZone.type === 'select' || prevZone.type === 'text_input'
        ? prevZone.question
        : 'user input'
      return {
        ...state,
        trail: [...state.trail, { description: desc, summary: event.answer }],
        activeZone: { type: 'idle' },
      }
    }

    case 'package_step': {
      if (state.activeZone.type !== 'packaging') {
        return {
          ...state,
          activeZone: {
            type: 'packaging',
            steps: [{ name: event.step, status: event.status }],
          },
        }
      }
      const steps = [...state.activeZone.steps]
      const existing = steps.find((s) => s.name === event.step)
      if (existing) {
        existing.status = event.status
      } else {
        steps.push({ name: event.step, status: event.status })
      }
      return {
        ...state,
        activeZone: { type: 'packaging', steps },
      }
    }

    case 'complete':
      return {
        ...state,
        phase: 'complete',
        activeZone: { type: 'complete', output_dir: event.output_dir, files: event.files, skill_name: event.skill_name },
      }

    case 'error':
      return {
        ...state,
        phase: 'error',
        activeZone: { type: 'error', error: event.error },
      }

    default:
      return state
  }
}
