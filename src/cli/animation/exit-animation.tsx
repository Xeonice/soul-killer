import React, { useState, useEffect, useRef } from 'react'
import { Text, Box } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DARK, DIM } from './colors.js'
import { loadArasakaLogoCentered } from './logo-loader.js'
import { LogoAnnihilator } from './logo-annihilator.js'
import { isAnimationEnabled } from './use-animation.js'
import { CenteredStage, getContentWidth } from './layout.js'
import { t } from '../../infra/i18n/index.js'

interface ExitAnimationProps {
  onComplete: () => void
}

export function ExitAnimation({ onComplete }: ExitAnimationProps) {
  const [frame, setFrame] = useState(0)

  // Logo annihilation
  const [logoLines, setLogoLines] = useState<string[]>([])
  const [logoReady, setLogoReady] = useState(false)
  const [logoGone, setLogoGone] = useState(false)
  const annihilatorRef = useRef<LogoAnnihilator | null>(null)

  // Shutdown info (appears after logo dissolves)
  const [shutdownStarted, setShutdownStarted] = useState(false)
  const [shutdownStep, setShutdownStep] = useState(0)
  const [saveProgress, setSaveProgress] = useState(0)

  // Data collapse
  const [collapseStarted, setCollapseStarted] = useState(false)
  const [scrollBuffer, setScrollBuffer] = useState<string[]>([])

  // Final message
  const [finalMessage, setFinalMessage] = useState(false)
  const [done, setDone] = useState(false)

  const engine = getGlitchEngine()
  const termWidth = process.stdout.columns ?? 80
  const contentWidth = getContentWidth(termWidth)

  useEffect(() => {
    if (!isAnimationEnabled()) {
      onComplete()
      return
    }

    const timers: NodeJS.Timeout[] = []

    // === Phase 1: Logo appears immediately, annihilates (0-5s) ===
    // Use pre-padded lines so the logo renders centered without relying on
    // yoga's alignItems (which miscounts ANSI escape bytes as visible width)
    const rawLines = loadArasakaLogoCentered(contentWidth)
    setLogoLines(rawLines)
    setLogoReady(true)
    annihilatorRef.current = new LogoAnnihilator(rawLines)

    // Logo stays 0.8s, then annihilation over 4s
    const annStart = 800
    const annFrames = 80
    for (let i = 1; i <= annFrames; i++) {
      timers.push(setTimeout(() => {
        const ann = annihilatorRef.current
        if (!ann) return
        const progress = i / annFrames
        ann.advanceFrame(progress, () => engine.random())
        setLogoLines(ann.render(() => engine.random()))
        if (ann.isFullyDissolved) setLogoGone(true)
      }, annStart + i * 50))
    }

    const phase1End = annStart + annFrames * 50 + 200
    timers.push(setTimeout(() => setLogoGone(true), phase1End))

    // === Phase 2: Shutdown info (5s-8s) ===
    timers.push(setTimeout(() => setShutdownStarted(true), phase1End))
    timers.push(setTimeout(() => setShutdownStep(1), phase1End + 100))
    for (let i = 1; i <= 10; i++) {
      timers.push(setTimeout(() => setSaveProgress(i * 10), phase1End + 100 + i * 50))
    }
    timers.push(setTimeout(() => setShutdownStep(2), phase1End + 700))
    timers.push(setTimeout(() => setShutdownStep(3), phase1End + 1200))

    const phase2End = phase1End + 2500

    // === Phase 3: Data Collapse (8s-12s) ===
    timers.push(setTimeout(() => setCollapseStarted(true), phase2End))

    let ct = phase2End + 100
    const totalCollapseLines = 35
    for (let i = 0; i < totalCollapseLines; i++) {
      const progress = i / totalCollapseLines
      const interval = Math.min(350, 80 + progress * 270)
      const glitchIntensity = Math.min(1.0, progress * 1.3)
      timers.push(setTimeout(() => {
        const line = generateCollapseLine(engine, glitchIntensity)
        setScrollBuffer((buf) => {
          const updated = [...buf, line]
          return updated.length > 80 ? updated.slice(-80) : updated
        })
      }, ct))
      ct += interval
    }

    const phase3End = phase2End + 4000

    // === Phase 4: Final message (12s-13.5s) ===
    timers.push(setTimeout(() => setFinalMessage(true), phase3End + 300))
    timers.push(setTimeout(() => {
      setDone(true)
      onComplete()
    }, phase3End + 1500))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  useEffect(() => {
    if (done) return
    const timer = setInterval(() => setFrame((f) => f + 1), 50)
    return () => clearInterval(timer)
  }, [done])

  if (done) return null
  void frame

  const visibleScroll = scrollBuffer.slice(-18)

  return (
    <CenteredStage>
      {/* === Fixed Header === */}
      <Text> </Text>
      <Text color={ACCENT}>{'< SYSTEM SHUTDOWN INITIATED >'}</Text>
      <Text color={DIM}>{t('anim.exit.disconnecting')}</Text>
      <Text> </Text>

      {/* === Logo Annihilation (dissolves in place, then disappears) === */}
      {/* Lines are pre-padded — render in plain Box to avoid yoga double-centering ANSI bytes */}
      {logoReady && !logoGone && (
        <>
          <Box flexDirection="column" width={contentWidth}>
            {logoLines.map((line, i) => (
              <Text key={`logo-${i}`}>{line}</Text>
            ))}
          </Box>
          <Text> </Text>
        </>
      )}

      {/* === Shutdown Steps (appear after logo gone) === */}
      {shutdownStarted && (
        <>
          {shutdownStep >= 1 && (
            <Text color={DIM}>
              {'▓ compressing neural state...      '}
              <Text color={PRIMARY}>{progressBar(saveProgress)}</Text>
              {' '}{saveProgress}%
            </Text>
          )}
          {shutdownStep >= 2 && (
            <Text color={DIM}>{'▓ flushing memory cortex...        saved.'}</Text>
          )}
          {shutdownStep >= 3 && (
            <Text color={DIM}>{'▓ severing neural link...           ✓'}</Text>
          )}
          <Text> </Text>
          <Text color={DARK}>{'NEURAL LINK STATUS: ░░░░░░░░░░ SEVERED'}</Text>
        </>
      )}

      {/* === Data Collapse (scrolling buffer) === */}
      {collapseStarted && (
        <>
          <Text> </Text>
          {visibleScroll.map((line, i) => (
            <Text key={`cl-${scrollBuffer.length - visibleScroll.length + i}`} color={PRIMARY}>
              {line}
            </Text>
          ))}
        </>
      )}

      {/* === Final Message === */}
      {finalMessage && (
        <>
          <Text> </Text>
          <Text> </Text>
          <Text color={DIM}>{'「 flatline. connection terminated 」'}</Text>
          <Text> </Text>
        </>
      )}
    </CenteredStage>
  )
}

function generateCollapseLine(engine: ReturnType<typeof getGlitchEngine>, glitchIntensity: number): string {
  let line: string
  if (engine.random() < 0.33) {
    const chars = '-/.,'
    line = ''
    for (let i = 0; i < 60; i++) {
      line += chars[engine.randomInt(chars.length)]!
    }
  } else {
    const groups: string[] = []
    for (let g = 0; g < 3; g++) {
      let hex = ''
      for (let h = 0; h < 13; h++) {
        hex += '0123456789ABCDEF'[engine.randomInt(16)]!
      }
      groups.push(hex)
    }
    line = groups.join('  -  ')
  }
  return engine.glitchText(line, glitchIntensity)
}

function progressBar(percent: number): string {
  const filled = Math.floor(percent / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}
