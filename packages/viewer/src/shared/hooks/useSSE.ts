import { useEffect, useRef, useCallback } from 'react'

/**
 * Generic SSE hook. Connects to an EventSource URL and dispatches
 * events to the provided handler map.
 */
export function useSSE(
  url: string,
  handlers: Record<string, (data: unknown) => void>,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback(() => {
    const sse = new EventSource(url)
    for (const event of Object.keys(handlersRef.current)) {
      sse.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          handlersRef.current[event]?.(data)
        } catch { /* ignore parse errors */ }
      })
    }
    return sse
  }, [url])

  useEffect(() => {
    const sse = connect()
    return () => sse.close()
  }, [connect])
}
