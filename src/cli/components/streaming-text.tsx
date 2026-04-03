import React, { useState, useEffect, useRef } from 'react'
import { Text } from 'ink'
import { ACCENT } from '../animation/colors.js'

interface StreamingTextProps {
  /** Async iterable of text chunks (tokens) */
  stream: AsyncIterable<string>
  color?: string
  /** Called when stream is exhausted */
  onComplete?: (fullText: string) => void
}

export function StreamingText({
  stream,
  color = ACCENT,
  onComplete,
}: StreamingTextProps) {
  const [text, setText] = useState('')
  const bufferRef = useRef('')
  const lastFlushRef = useRef(Date.now())

  useEffect(() => {
    let cancelled = false

    async function consume() {
      for await (const chunk of stream) {
        if (cancelled) break
        bufferRef.current += chunk

        // Throttle re-renders to max once per 50ms
        const now = Date.now()
        if (now - lastFlushRef.current >= 50) {
          setText(bufferRef.current)
          lastFlushRef.current = now
        }
      }

      if (!cancelled) {
        // Final flush
        setText(bufferRef.current)
        onComplete?.(bufferRef.current)
      }
    }

    consume()

    return () => {
      cancelled = true
    }
  }, [stream, onComplete])

  // Ensure we flush any remaining buffer
  useEffect(() => {
    const timer = setInterval(() => {
      if (bufferRef.current !== text) {
        setText(bufferRef.current)
      }
    }, 50)
    return () => clearInterval(timer)
  }, [text])

  return <Text color={color}>{text}</Text>
}
