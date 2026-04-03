import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { HeartbeatLine } from './heartbeat-line.js'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

type Phase = 'link' | 'sync' | 'info' | 'tagline' | 'done'

interface RelicLoadAnimationProps {
  soulName: string
  chunkCount?: number
  languages?: string[]
  onComplete: () => void
}

export function RelicLoadAnimation({
  soulName,
  chunkCount = 0,
  languages,
  onComplete,
}: RelicLoadAnimationProps) {
  const animationEnabled = isAnimationEnabled()
  const [phase, setPhase] = useState<Phase>('link')
  const [frame, setFrame] = useState(0)
  const [health, setHealth] = useState(0)
  const [syncProgress, setSyncProgress] = useState(0)
  // Line-by-line reveal counter for info phase
  const [revealedLines, setRevealedLines] = useState(0)
  const engine = getGlitchEngine()

  useEffect(() => {
    if (!animationEnabled) {
      onComplete()
      return
    }

    const timers: NodeJS.Timeout[] = []

    // Phase 1: link (~1.2s) — glitch text with decaying intensity
    timers.push(setTimeout(() => setPhase('sync'), 1200))

    // Phase 2: sync (~2s) — heartbeat + progress bar
    // Health 0 → 1 over 1200-3200ms (20 steps, 100ms each)
    for (let i = 1; i <= 20; i++) {
      timers.push(setTimeout(() => setHealth(i / 20), 1200 + i * 100))
    }
    // Sync progress 0 → 100 over 1200-3200ms
    for (let i = 1; i <= 20; i++) {
      timers.push(setTimeout(() => setSyncProgress(i * 5), 1200 + i * 100))
    }

    // Phase 3: info at 3200ms — lines revealed one by one
    timers.push(setTimeout(() => setPhase('info'), 3200))
    // Reveal 7 info lines, 300ms apart (3200 → 5300ms)
    for (let i = 1; i <= 7; i++) {
      timers.push(setTimeout(() => setRevealedLines(i), 3200 + i * 300))
    }

    // Phase 4: tagline at 5500ms
    timers.push(setTimeout(() => setPhase('tagline'), 5500))

    // Done at 6500ms
    timers.push(setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 6500))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  // Frame ticker for glitch
  useEffect(() => {
    if (phase === 'done') return
    const timer = setInterval(() => setFrame((f) => f + 1), 50)
    return () => clearInterval(timer)
  }, [phase])

  if (phase === 'done') return null

  void frame

  const langStr = languages?.join('/') ?? 'unknown'

  // Glitch intensity decays over phase 1
  const linkGlitchIntensity = phase === 'link' ? Math.max(0.1, 0.6 - frame * 0.015) : 0

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {/* Phase 1: Neural Link — glitch decays */}
      {phase === 'link' && (
        <Box flexDirection="column">
          <Text> </Text>
          <Text color={ACCENT}>
            {'  ▓ '}{engine.glitchText('establishing neural link...', linkGlitchIntensity)}
          </Text>
          <Text> </Text>
        </Box>
      )}

      {/* Phase 2: Relic Sync — heartbeat activates */}
      {phase === 'sync' && (
        <Box flexDirection="column" borderStyle="single" borderColor={health > 0.5 ? PRIMARY : ACCENT} width={50}>
          <Text> </Text>
          <Text color={PRIMARY}>  ▓ establishing neural link...       ✓</Text>
          <Text> </Text>
          <Text>  <HeartbeatLine health={health} width={42} /></Text>
          <Text> </Text>
          <Text color={health > 0.5 ? PRIMARY : ACCENT}>
            {'  RELIC STATUS: '}{progressBar(syncProgress)}{' '}
            {syncProgress < 100 ? `${syncProgress}%` : 'SYNCED'}
          </Text>
          <Text> </Text>
        </Box>
      )}

      {/* Phase 3: Soul Info — lines appear one by one */}
      {phase === 'info' && (
        <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} width={50}>
          <Text> </Text>
          {revealedLines >= 1 && (
            <Text color={PRIMARY}>  ▓ establishing neural link...       ✓</Text>
          )}
          {revealedLines >= 2 && (
            <Text color={PRIMARY}>  ▓ relic sync complete                ✓</Text>
          )}
          {revealedLines >= 3 && <Text> </Text>}
          {revealedLines >= 3 && (
            <Text color={PRIMARY}>  RELIC STATUS: {progressBar(100)} SYNCED</Text>
          )}
          {revealedLines >= 4 && <Text> </Text>}
          {revealedLines >= 4 && (
            <Text color={ACCENT}>  soul:       <Text color={PRIMARY}>{soulName}</Text></Text>
          )}
          {revealedLines >= 5 && (
            <Text color={ACCENT}>  memories:   <Text color={DIM}>{chunkCount.toLocaleString()}</Text></Text>
          )}
          {revealedLines >= 6 && (
            <Text color={ACCENT}>  languages:  <Text color={DIM}>{langStr}</Text></Text>
          )}
          {revealedLines >= 7 && <Text> </Text>}
          <Text> </Text>
        </Box>
      )}

      {/* Phase 4: Tagline */}
      {phase === 'tagline' && (
        <Box flexDirection="column" borderStyle="single" borderColor={PRIMARY} width={50}>
          <Text> </Text>
          <Text color={PRIMARY}>  ▓ establishing neural link...       ✓</Text>
          <Text color={PRIMARY}>  ▓ relic sync complete                ✓</Text>
          <Text> </Text>
          <Text color={PRIMARY}>  RELIC STATUS: {progressBar(100)} SYNCED</Text>
          <Text> </Text>
          <Text color={ACCENT}>  soul:       <Text color={PRIMARY}>{soulName}</Text></Text>
          <Text color={ACCENT}>  memories:   <Text color={DIM}>{chunkCount.toLocaleString()}</Text></Text>
          <Text color={ACCENT}>  languages:  <Text color={DIM}>{langStr}</Text></Text>
          <Text> </Text>
          <Text color={DIM}>  「 neural link established. soul loaded. 」</Text>
          <Text> </Text>
        </Box>
      )}
    </Box>
  )
}

function progressBar(percent: number): string {
  const filled = Math.floor(percent / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}
