import React, { useState, useEffect, useRef } from 'react'
import { Text, Box, useInput } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DARK, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'
import { t } from '../../i18n/index.js'
import type { ExportProgressEvent, ExportPhase, ExportPlan, AskUserOption } from '../../export/agent/index.js'

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
  /**
   * `idle.reasoning` carries the latest reasoning_progress event from the
   * agent. When present, the active zone shows "推理中 (N tokens)" instead
   * of the generic "思考中" — so the user can tell a reasoning model is
   * actively thinking, not stuck on the network.
   */
  | { type: 'idle'; reasoning?: { tokens: number; chars: number } }
  | { type: 'tool'; tool: string; args?: Record<string, unknown> }
  | { type: 'select'; question: string; options: AskUserOption[]; cursor: number; multi?: boolean; selected?: number[] }
  | { type: 'text_input'; question: string; value: string; items: string[] }
  | { type: 'plan_review'; plan: ExportPlan }
  | { type: 'packaging'; steps: { name: string; status: 'pending' | 'running' | 'done' }[] }
  | { type: 'complete'; output_file: string; file_count: number; size_bytes: number; skill_name?: string }
  | { type: 'error'; error: string }

// --- Props ---

interface ExportProtocolPanelProps {
  phase: ExportPhase
  planningTrail: TrailStep[]
  trail: TrailStep[]
  activeZone: ActiveZoneState
  onSelectConfirm?: (index: number) => void
  onTextSubmit?: (value: string) => void
  onPlanConfirm?: () => void
  onCancel?: () => void
}

export function ExportProtocolPanel({
  phase,
  planningTrail,
  trail,
  activeZone,
  onSelectConfirm,
  onTextSubmit,
  onPlanConfirm,
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

  // Track idle duration for "thinking Ns" display
  const idleStartRef = useRef<number>(Date.now())
  useEffect(() => {
    if (activeZone.type === 'idle') {
      idleStartRef.current = Date.now()
    }
  }, [activeZone.type])
  const idleElapsedSec = activeZone.type === 'idle'
    ? Math.floor((Date.now() - idleStartRef.current) / 1000)
    : 0

  // Handle keyboard input for plan_review, select, and text_input modes
  useInput((input, key) => {
    if (key.escape) {
      onCancel?.()
      return
    }

    if (activeZone.type === 'plan_review') {
      if (key.return) {
        onPlanConfirm?.()
      }
      return
    }

    if (activeZone.type === 'select') {
      if (key.upArrow) {
        onSelectConfirm?.(-1) // signal: move up
      } else if (key.downArrow) {
        onSelectConfirm?.(-2) // signal: move down
      } else if (activeZone.multi && input === ' ') {
        onSelectConfirm?.(-3) // signal: toggle current item (multi-select only)
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
        if (phase === 'initiating') {
          return (
            <Text color={ACCENT}>
              {'  ▓'}{engine.glitchText(t('export.initiating'), Math.max(0.1, 0.5 - frame * 0.01))}
            </Text>
          )
        }
        if (phase === 'planning') {
          if (activeZone.reasoning) {
            const tokens = activeZone.reasoning.tokens
            return (
              <Text color={ACCENT}>
                {'  ▓ '}{t('export.planning')} {spinnerChar}{' '}
                <Text color={DIM}>{tokens} tokens · {idleElapsedSec}s</Text>
              </Text>
            )
          }
          return (
            <Text color={ACCENT}>
              {'  ▓ '}{t('export.planning')} {spinnerChar} <Text color={DIM}>{idleElapsedSec}s</Text>
            </Text>
          )
        }
        if (phase === 'analyzing' || phase === 'selecting' || phase === 'configuring') {
          // If a reasoning model is actively streaming its thinking, show
          // "推理中 (N tokens)" so the user can see the model is working
          // instead of being stuck on the network. Otherwise fall back to
          // the generic "思考中" + elapsed seconds since last activity.
          if (activeZone.reasoning) {
            const tokens = activeZone.reasoning.tokens
            return (
              <Text color={ACCENT}>
                {'  ▓ '}{t('export.reasoning')} {spinnerChar}{' '}
                <Text color={DIM}>{tokens} tokens · {idleElapsedSec}s</Text>
              </Text>
            )
          }
          return (
            <Text color={ACCENT}>
              {'  ▓ '}{t('export.thinking')} {spinnerChar} <Text color={DIM}>{idleElapsedSec}s</Text>
            </Text>
          )
        }
        return null

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

      case 'select': {
        const isMulti = !!activeZone.multi
        const selectedSet = new Set(activeZone.selected ?? [])
        const WINDOW_SIZE = 10
        const total = activeZone.options.length
        const needsWindow = total > WINDOW_SIZE
        let windowStart = 0
        let windowEnd = total
        if (needsWindow) {
          windowStart = Math.max(0, Math.min(activeZone.cursor - 3, total - WINDOW_SIZE))
          windowEnd = windowStart + WINDOW_SIZE
        }
        const visibleOptions = activeZone.options.slice(windowStart, windowEnd)
        const hasAbove = windowStart > 0
        const hasBelow = windowEnd < total
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={ACCENT}>  ▓ {activeZone.question}</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={DARK} paddingX={1}>
              {hasAbove && (
                <Text color={DIM}>    ▲ {windowStart} more</Text>
              )}
              {visibleOptions.map((opt, vi) => {
                const i = windowStart + vi
                const focused = i === activeZone.cursor
                const checked = selectedSet.has(i)
                const checkbox = isMulti ? (checked ? '[✓] ' : '[ ] ') : ''
                return (
                  <Box key={i} flexDirection="column">
                    <Text color={focused ? ACCENT : (checked ? PRIMARY : DIM)}>
                      {focused ? '  ❯ ' : '    '}{checkbox}{opt.label}
                    </Text>
                    {opt.description && (
                      <Text color={DIM}>{'      '}{opt.description}</Text>
                    )}
                  </Box>
                )
              })}
              {hasBelow && (
                <Text color={DIM}>    ▼ {total - windowEnd} more</Text>
              )}
            </Box>
            {isMulti && (
              <Text color={DIM}>  {t('export.multi_select_hint')}</Text>
            )}
          </Box>
        )
      }

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

      case 'plan_review': {
        const { plan } = activeZone
        const roleLabel: Record<string, string> = {
          protagonist: 'P',
          deuteragonist: 'D',
          antagonist: 'A',
        }
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={ACCENT}>  ▓ {t('export.plan_review_title')}</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={DARK} paddingX={1}>
              <Text color={DIM}>  {t('export.plan_genre')}: <Text color={PRIMARY}>{plan.genre_direction}</Text></Text>
              <Text color={DIM}>  {t('export.plan_tone')}: <Text color={PRIMARY}>{plan.tone_direction}</Text></Text>
              <Text color={DIM}>  {t('export.plan_axes')}: <Text color={PRIMARY}>{plan.shared_axes.join(' / ')}</Text></Text>
              <Text color={DIM}>  Flags: <Text color={PRIMARY}>{plan.flags.length} {t('export.plan_flags_unit')}</Text></Text>
              <Text> </Text>
              <Text color={DIM}>  {t('export.plan_characters')}:</Text>
              {plan.characters.map((c, i) => (
                <Text key={i} color={PRIMARY}>
                  {'    '}{roleLabel[c.role] ?? '?'} {c.name}
                  {c.specific_axes_direction.length > 0
                    ? <Text color={DIM}> [{c.specific_axes_direction.join(', ')}]</Text>
                    : null}
                </Text>
              ))}
            </Box>
            <Text> </Text>
            <Text color={DIM}>  {t('export.plan_confirm_hint')}</Text>
          </Box>
        )
      }

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
        const sizeKB = Math.round(activeZone.size_bytes / 1024)
        return (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={PRIMARY}>  ▓ {t('export.step.complete')} ✓</Text>
            <Text> </Text>
            <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1}>
              <Text color={ACCENT}>  📦 {activeZone.output_file}</Text>
              <Text color={DIM}>     {activeZone.file_count} files · {sizeKB} KB</Text>
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
    if (activeZone.type === 'select') {
      hint = activeZone.multi ? t('export.status.multi_select') : t('export.status.select')
    } else if (activeZone.type === 'text_input') {
      hint = t('export.status.input')
    }

    return <Text color={DIM}>  {hint}</Text>
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} paddingX={1} width={60}>
      <Text color={ACCENT} bold> {t('export.title')} </Text>
      <Text> </Text>

      {/* Planning trail */}
      {planningTrail.length > 0 && (
        <>
          <Text color={DIM}>  ── {t('export.phase_planning')} ──</Text>
          {planningTrail.map((step, i) => (
            <React.Fragment key={`p-${i}`}>
              <Text color={PRIMARY}>  ▓ {step.description} ✓</Text>
              {step.summary && <Text color={DIM}>    ▸ {step.summary}</Text>}
            </React.Fragment>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Execution trail */}
      {phase !== 'initiating' && phase !== 'planning' && phase !== 'plan_review' && trail.length > 0 && (
        <>
          <Text color={DIM}>  ── {t('export.phase_execution')} ──</Text>
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
  planningTrail: TrailStep[]
  trail: TrailStep[]
  activeZone: ActiveZoneState
  /** Tracks the current character being processed (add_character done, awaiting set_character_axes) */
  _pendingCharacter?: { name: string; addSummary: string }
}

export function createInitialPanelState(): ExportPanelState {
  return {
    phase: 'initiating',
    planningTrail: [],
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
      // Move completed tool to trail. Reset to plain idle (no reasoning
      // payload) so the next "推理中" display starts fresh on the next
      // reasoning burst.
      const description = event.tool
      const summary = event.result_summary
      // Route to planningTrail during planning phase
      if (state.phase === 'planning') {
        return {
          ...state,
          planningTrail: [...state.planningTrail, { description, summary }],
          activeZone: { type: 'idle' },
        }
      }

      // Character grouping: merge add_character + set_character_axes into one trail entry
      if (event.tool === 'add_character') {
        // Extract character name from summary (format: "Character N/M added: NAME (ROLE)")
        const nameMatch = summary?.match(/added:\s*(.+?)\s*\(/)
        const charName = nameMatch?.[1] ?? summary ?? ''
        return {
          ...state,
          _pendingCharacter: { name: charName, addSummary: summary ?? '' },
          activeZone: { type: 'idle' },
        }
      }
      if (event.tool === 'set_character_axes' && state._pendingCharacter) {
        // Merge with pending character into one trail entry
        const merged = `${state._pendingCharacter.addSummary} · ${summary}`
        return {
          ...state,
          trail: [...state.trail, { description: state._pendingCharacter.name, summary: merged }],
          _pendingCharacter: undefined,
          activeZone: { type: 'idle' },
        }
      }

      // Flush any pending character that wasn't followed by set_character_axes
      const trailWithFlush = state._pendingCharacter
        ? [...state.trail, { description: state._pendingCharacter.name, summary: state._pendingCharacter.addSummary }]
        : state.trail
      return {
        ...state,
        trail: [...trailWithFlush, { description, summary }],
        _pendingCharacter: undefined,
        activeZone: { type: 'idle' },
      }
    }

    case 'ask_user_start': {
      if (event.options && event.options.length > 0) {
        return {
          ...state,
          activeZone: {
            type: 'select',
            question: event.question,
            options: event.options,
            cursor: 0,
            multi: event.multi_select,
            selected: event.multi_select ? [] : undefined,
          },
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

    case 'reasoning_progress': {
      // Only attach reasoning info to an idle zone — if a tool / select /
      // packaging zone is active, the model's reasoning is irrelevant to the
      // user (they're seeing concrete progress). This avoids stomping the
      // active interaction.
      if (state.activeZone.type !== 'idle') return state
      return {
        ...state,
        activeZone: {
          type: 'idle',
          reasoning: { tokens: event.tokens, chars: event.chars },
        },
      }
    }

    case 'plan_ready':
      return {
        ...state,
        phase: 'plan_review',
        activeZone: { type: 'plan_review', plan: event.plan },
      }

    case 'plan_confirmed': {
      // Move plan summary to planningTrail and reset for execution phase
      const planSummary = state.activeZone.type === 'plan_review'
        ? `${state.activeZone.plan.characters.length} 角色 · ${state.activeZone.plan.shared_axes.join('/')}`
        : undefined
      return {
        ...state,
        planningTrail: [...state.planningTrail, { description: t('export.plan_confirmed'), summary: planSummary }],
        activeZone: { type: 'idle' },
      }
    }

    case 'complete':
      return {
        ...state,
        phase: 'complete',
        activeZone: { type: 'complete', output_file: event.output_file, file_count: event.file_count, size_bytes: event.size_bytes, skill_name: event.skill_name },
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
