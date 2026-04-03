import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { WARNING, PRIMARY, ACCENT, DIM } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

export type Severity = 'warning' | 'malfunction' | 'critical'

interface MalfunctionErrorProps {
  severity: Severity
  title: string
  message: string
  suggestions?: string[]
}

const CRITICAL_ART = [
  '██████╗██████╗ ██╗████████╗██╗ ██████╗ ',
  '██╔═══╝██╔══██╗██║╚══██╔══╝██║██╔════╝ ',
  '██║    ██████╔╝██║   ██║   ██║██║      ',
  '██║    ██╔══██╗██║   ██║   ██║██║      ',
  '██████╗██║  ██║██║   ██║   ██║╚██████╗ ',
  '╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝ ╚═════╝',
]

export function MalfunctionError({
  severity,
  title,
  message,
  suggestions,
}: MalfunctionErrorProps) {
  const [frame, setFrame] = useState(0)
  const [glitchActive, setGlitchActive] = useState(severity !== 'warning' && isAnimationEnabled())
  const engine = getGlitchEngine()

  useEffect(() => {
    if (!glitchActive) return
    const duration = severity === 'critical' ? 1000 : 500
    const timer = setInterval(() => setFrame((f) => f + 1), 50)
    const stop = setTimeout(() => {
      setGlitchActive(false)
      clearInterval(timer)
    }, duration)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
    }
  }, [severity, glitchActive])

  const borderColor = severity === 'warning' ? WARNING : severity === 'malfunction' ? PRIMARY : ACCENT
  const label = severity.toUpperCase()
  const glitchIntensity = glitchActive ? (severity === 'critical' ? 0.4 : 0.2) : 0

  void frame

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      width={52}
    >
      <Text color={borderColor} bold> {label} </Text>

      {severity === 'critical' && (
        <Box flexDirection="column" marginTop={1}>
          {CRITICAL_ART.map((line, i) => (
            <Text key={i} color={PRIMARY}>
              {'  '}{glitchIntensity > 0 ? engine.glitchText(line, glitchIntensity) : line}
            </Text>
          ))}
        </Box>
      )}

      <Text> </Text>
      <Text color={borderColor}>
        {'  '}██ {glitchIntensity > 0 ? engine.glitchText(title, glitchIntensity) : title} ██
      </Text>
      <Text> </Text>
      <Text color={DIM}>  {glitchIntensity > 0 ? engine.glitchText(message, glitchIntensity * 0.5) : message}</Text>

      {suggestions && suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {suggestions.map((s, i) => (
            <Text key={i} color={DIM}>  ▸ {s}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
