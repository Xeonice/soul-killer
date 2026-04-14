import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DIM, DARK } from './colors.js'
import { bootingBar } from './booting-bar.js'
import { loadArasakaLogo } from './logo-loader.js'
import { isAnimationEnabled } from './use-animation.js'
import { CenteredStage, getContentWidth } from './layout.js'
import { t } from '../../infra/i18n/index.js'

interface BootAnimationProps {
  onComplete: () => void
}

const BIOS_LINES = [
  'NEURAL INTERFACE BOOT',
  '//',
  'LOADING KERNEL............',
  'PARTITION TOOLS',
  'SOUL ENGINE - X64',
  'CONSOLE MODE (1)',
]

const PANEL_INFO = [
  t('anim.boot.terminal'),
  t('anim.boot.corp'),
  '',
  'DEVICE_OVERVIEW:',
  '--CLI_TERMINAL--',
  '',
  'STATUS: ONLINE',
  'CATEGORY: soul_extraction',
  'CURRENT_USER: ********',
  '─────────────────────────────',
  'SECURITY:',
  ". ' _ . ' _",
]

// How many lines to keep visible in the scrolling buffer
const SCROLL_VISIBLE = 22

export function BootAnimation({ onComplete }: BootAnimationProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)

  // Unified scrolling buffer: BIOS lines + hex lines share this
  const [scrollBuffer, setScrollBuffer] = useState<string[]>([])
  // Current BIOS line being typed
  const [biosIdx, setBiosIdx] = useState(0)
  const [biosCharPos, setBiosCharPos] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const [biosComplete, setBiosComplete] = useState(false)

  // Waterfall
  const [waterfallStarted, setWaterfallStarted] = useState(false)
  const [waterfallComplete, setWaterfallComplete] = useState(false)

  // Panel
  const [panelStarted, setPanelStarted] = useState(false)
  const [panelProgress, setPanelProgress] = useState(0)
  const [panelReveal, setPanelReveal] = useState(0)

  const [done, setDone] = useState(false)

  const engine = getGlitchEngine()
  const termWidth = process.stdout.columns ?? 80
  const contentWidth = getContentWidth(termWidth)

  useEffect(() => {
    if (!animationEnabled) {
      onComplete()
      return
    }

    const timers: NodeJS.Timeout[] = []

    // === BIOS Phase: type out lines one by one ===
    // Each line types out, then gets committed to buffer, then next line starts
    let t = 800 // start after header renders
    for (let lineIdx = 0; lineIdx < BIOS_LINES.length; lineIdx++) {
      const lineLen = BIOS_LINES[lineIdx]!.length
      // Type each character
      for (let c = 0; c <= lineLen; c++) {
        timers.push(setTimeout(() => {
          setBiosIdx(lineIdx)
          setBiosCharPos(c)
        }, t + c * 60))
      }
      // After line is fully typed, commit it to buffer and move to next
      const lineEndTime = t + lineLen * 60 + 200
      timers.push(setTimeout(() => {
        setScrollBuffer((buf) => [...buf, BIOS_LINES[lineIdx]!])
        setBiosIdx(lineIdx + 1)
        setBiosCharPos(0)
      }, lineEndTime))
      t = lineEndTime + 200 // gap before next line
    }

    const biosEndTime = t
    timers.push(setTimeout(() => setBiosComplete(true), biosEndTime))

    // Cursor blink
    const cursorBlink = setInterval(() => setShowCursor((c) => !c), 500)
    timers.push(setTimeout(() => clearInterval(cursorBlink), biosEndTime))

    // === Waterfall Phase: starts right after BIOS completes ===
    timers.push(setTimeout(() => setWaterfallStarted(true), biosEndTime))

    let wt = biosEndTime + 100
    const totalWaterfallLines = 45
    for (let i = 0; i < totalWaterfallLines; i++) {
      const progress = i / totalWaterfallLines
      const interval = Math.max(60, 350 - progress * 290)
      timers.push(setTimeout(() => {
        const newLine = generateWaterfallLine(engine, i)
        setScrollBuffer((buf) => {
          const updated = [...buf, newLine]
          // Trim to keep scroll buffer from growing too large
          return updated.length > 100 ? updated.slice(-100) : updated
        })
      }, wt))
      wt += interval
    }

    const waterfallEndTime = wt
    timers.push(setTimeout(() => setWaterfallComplete(true), waterfallEndTime))

    // === Panel Phase ===
    timers.push(setTimeout(() => setPanelStarted(true), waterfallEndTime))

    // Info lines reveal first (1.5s delay then 250ms per line)
    for (let i = 1; i <= PANEL_INFO.length; i++) {
      timers.push(setTimeout(() => setPanelReveal(i), waterfallEndTime + 1500 + i * 250))
    }
    // Progress bar starts after info reveal (~5s in), fills over 3s
    const progressStart = waterfallEndTime + 1500 + PANEL_INFO.length * 250 + 500
    for (let i = 1; i <= 20; i++) {
      timers.push(setTimeout(() => setPanelProgress(i * 5), progressStart + i * 150))
    }

    const panelEndTime = progressStart + 20 * 150 + 1500

    // === Done ===
    timers.push(setTimeout(() => {
      setDone(true)
      onComplete()
    }, panelEndTime))

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(cursorBlink)
    }
  }, [onComplete])

  // Frame ticker
  useEffect(() => {
    if (done) return
    const timer = setInterval(() => setFrame((f) => f + 1), 50)
    return () => clearInterval(timer)
  }, [done])

  if (done) return null

  void frame

  const barWidth = contentWidth
  const logoLines = loadArasakaLogo(contentWidth)

  // Visible portion of the scroll buffer (last N lines)
  const visibleLines = scrollBuffer.slice(-SCROLL_VISIBLE)

  // Is there a BIOS line currently being typed?
  const isTyping = !biosComplete && biosIdx < BIOS_LINES.length
  const currentTypingText = isTyping
    ? BIOS_LINES[biosIdx]!.slice(0, biosCharPos) + (showCursor ? '█' : '')
    : null

  return (
    <CenteredStage>
      {/* === Fixed Header (always visible) === */}
      <Text> </Text>
      <Text color={PRIMARY}>ARASAKA</Text>
      <Text color={PRIMARY}>SOULKILLER PROTOCOL v0.1.0</Text>
      <Text color={DIM}>//</Text>
      <Text> </Text>
      <Text>{bootingBar('BOOTING...', barWidth)}</Text>
      <Text> </Text>
      <Text color={PRIMARY}>{t('anim.boot.footer')}</Text>
      <Text> </Text>
      <Text color={DIM}>//</Text>
      <Text> </Text>

      {/* === Scrolling Buffer (BIOS lines + Hex lines share this area) === */}
      {visibleLines.map((line, i) => (
        <Text key={`buf-${scrollBuffer.length - visibleLines.length + i}`} color={PRIMARY}>
          {line}
        </Text>
      ))}

      {/* Currently typing BIOS line (not yet committed to buffer) */}
      {currentTypingText !== null && (
        <Text color={PRIMARY}>{currentTypingText}</Text>
      )}

      {/* === Panel Section (appears after waterfall) === */}
      {panelStarted && (
        <>
          <Text> </Text>
          {logoLines.map((line, i) => (
            <Text key={`logo-${i}`}>{line}</Text>
          ))}

          <Text> </Text>

          {PANEL_INFO.slice(0, panelReveal).map((line, i) => (
            <Text key={`info-${i}`} color={i < 2 ? PRIMARY : DIM}>{line}</Text>
          ))}

          <Text> </Text>

          <Box flexDirection="column" alignItems="center" width={contentWidth}>
            <Text color={DARK}>╔═══════════════════════════════════════════╗</Text>
            <Text color={ACCENT}>║{'      < SYSTEM INITIALIZING >              '}║</Text>
            <Text color={DIM}>║{'   SOULKILLER VER 0.1.0 BOOT               '}║</Text>
            <Text color={DIM}>║{'        PROCESS:  '}{String(panelProgress).padStart(3)}%{'                     '}║</Text>
            <Text color={PRIMARY}>║{'   ['}{progressBar(panelProgress)}{']   '}║</Text>
            <Text color={DARK}>╚═══════════════════════════════════════════╝</Text>

            <Text> </Text>
            <Text color={DIM}>POWER_BY</Text>
            <Text color={ACCENT}>ARASAKA ⊕</Text>
          </Box>
        </>
      )}
    </CenteredStage>
  )
}

function generateWaterfallLine(engine: ReturnType<typeof getGlitchEngine>, index: number): string {
  if (index % 3 === 2) {
    const chars = '-/.,'
    let line = ''
    for (let i = 0; i < 120; i++) {
      line += chars[engine.randomInt(chars.length)]!
    }
    return line
  }
  const groups: string[] = []
  for (let g = 0; g < 5; g++) {
    let hex = ''
    for (let h = 0; h < 16; h++) {
      hex += '0123456789ABCDEF'[engine.randomInt(16)]!
    }
    groups.push(hex)
  }
  return groups.join('  -  ')
}

function progressBar(percent: number): string {
  const width = 36
  const filled = Math.floor((percent / 100) * width)
  return '█'.repeat(filled) + '·'.repeat(width - filled)
}
