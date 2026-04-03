import React, { useState, useEffect } from 'react'
import { Text } from 'ink'
import { getGlitchEngine } from './glitch-engine.js'
import { PRIMARY, ACCENT } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

interface GlitchTextProps {
  children: string
  /** Glitch intensity 0.0–1.0 */
  intensity?: number
  /** Duration of the glitch effect in ms. If set, intensity decays from initial to 0 over this duration. */
  duration?: number
  /** Color for glitched characters */
  glitchColor?: string
  /** Color for stable characters */
  color?: string
  /** Frame rate in ms */
  frameRate?: number
  /** Called when duration-based animation completes */
  onComplete?: () => void
}

export function GlitchText({
  children,
  intensity = 0.3,
  duration,
  glitchColor = ACCENT,
  color = PRIMARY,
  frameRate = 50,
  onComplete,
}: GlitchTextProps) {
  const animationEnabled = isAnimationEnabled()
  const [frame, setFrame] = useState(0)
  const [startTime] = useState(() => Date.now())
  const engine = getGlitchEngine()

  useEffect(() => {
    if (!animationEnabled) {
      onComplete?.()
      return
    }

    const timer = setInterval(() => {
      setFrame((f) => f + 1)

      if (duration) {
        const elapsed = Date.now() - startTime
        if (elapsed >= duration) {
          clearInterval(timer)
          onComplete?.()
        }
      }
    }, frameRate)

    return () => clearInterval(timer)
  }, [duration, frameRate, startTime, onComplete])

  let currentIntensity = intensity
  if (duration) {
    const elapsed = Date.now() - startTime
    const progress = Math.min(1, elapsed / duration)
    currentIntensity = intensity * (1 - progress)
  }

  // Force re-render dependency on frame
  void frame

  if (!animationEnabled) {
    return <Text color={color}>{children}</Text>
  }

  const text = children
  const chars = [...text]
  const elements: React.ReactElement[] = []

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!
    if (char === ' ' || char === '\n') {
      elements.push(<Text key={i}>{char}</Text>)
    } else if (engine.random() < currentIntensity) {
      elements.push(
        <Text key={i} color={glitchColor}>
          {engine.glitchChar()}
        </Text>
      )
    } else {
      elements.push(
        <Text key={i} color={color}>
          {char}
        </Text>
      )
    }
  }

  return <Text>{elements}</Text>
}
