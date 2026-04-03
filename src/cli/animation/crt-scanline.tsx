import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { PRIMARY } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

interface CrtScanlineProps {
  /** Total height (number of lines) the scanline sweeps over */
  height: number
  /** Width of the scanline */
  width: number
  /** Speed: ms per line */
  speed?: number
  /** Whether the scanline is active */
  active?: boolean
}

/**
 * CRT horizontal scanline effect.
 * Renders a bright horizontal line that sweeps top-to-bottom.
 */
export function CrtScanline({
  height,
  width,
  speed = 80,
  active = true,
}: CrtScanlineProps) {
  const [linePos, setLinePos] = useState(0)

  const animationEnabled = isAnimationEnabled()

  useEffect(() => {
    if (!active || !animationEnabled) return

    const timer = setInterval(() => {
      setLinePos((pos) => (pos + 1) % height)
    }, speed)

    return () => clearInterval(timer)
  }, [active, height, speed])

  if (!active || !animationEnabled) return null

  return (
    <Box flexDirection="column" position="absolute">
      {Array.from({ length: height }, (_, i) => {
        if (i === linePos) {
          return (
            <Text key={i} color={PRIMARY} dimColor>
              {'─'.repeat(width)}
            </Text>
          )
        }
        return null
      })}
    </Box>
  )
}
