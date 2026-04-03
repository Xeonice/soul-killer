import React, { useState, useEffect } from 'react'
import { Text } from 'ink'
import { PRIMARY, DIM, DARK } from './colors.js'
import { isAnimationEnabled } from './use-animation.js'

// ECG waveform patterns at different health levels
const WAVEFORMS = {
  healthy: ['╭─╮', '│ │', '╯ ╰──'],
  weak: ['╭╮', '╰╯─'],
  dying: ['╭╮', '╰─'],
  flat: ['───'],
}

interface HeartbeatLineProps {
  /** 1.0 = healthy, 0.0 = flatline */
  health: number
  width: number
  color?: string
}

export function HeartbeatLine({ health, width, color }: HeartbeatLineProps) {
  const animationEnabled = isAnimationEnabled()
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!animationEnabled) return

    const speed = health > 0.5 ? 100 : health > 0.2 ? 200 : 400
    const timer = setInterval(() => {
      setOffset((o) => (o + 1) % width)
    }, speed)
    return () => clearInterval(timer)
  }, [health, width])

  const resolvedColor = color ?? (health > 0.6 ? PRIMARY : health > 0.3 ? DIM : health > 0 ? DARK : DIM)

  let line: string
  if (health <= 0) {
    line = '─'.repeat(width)
  } else {
    const pattern = health > 0.6 ? '╭─╮  ╭─╮  ' : health > 0.3 ? '╭╮ ╭╮ ' : '╭╮   '
    const repeated = pattern.repeat(Math.ceil(width / pattern.length))
    line = repeated.slice(offset, offset + width).padEnd(width, '─')
  }

  return <Text color={resolvedColor}>{line}</Text>
}
