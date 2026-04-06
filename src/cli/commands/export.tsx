import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box } from 'ink'
import {
  ExportProtocolPanel,
  createInitialPanelState,
  reducePanelEvent,
  type ExportPanelState,
} from '../animation/export-protocol-panel.js'
import { runExportAgent, type ExportProgressEvent, type AskUserOption } from '../../agent/export-agent.js'
import { loadConfig } from '../../config/loader.js'
import { TextInput } from '../components/text-input.js'

interface ExportCommandProps {
  onComplete: () => void
  onCancel: () => void
}

export function ExportCommand({ onComplete, onCancel }: ExportCommandProps) {
  const [panelState, setPanelState] = useState<ExportPanelState>(createInitialPanelState)
  const [textInputActive, setTextInputActive] = useState(false)
  const [textInputPrompt, setTextInputPrompt] = useState('')

  // Promise resolvers for ask_user bridging
  const askResolverRef = useRef<((answer: string) => void) | null>(null)
  const cancelledRef = useRef(false)

  const handleProgress = useCallback((event: ExportProgressEvent) => {
    if (cancelledRef.current) return
    setPanelState((prev) => reducePanelEvent(prev, event))
  }, [])

  const handleAskUser = useCallback(
    (question: string, options?: AskUserOption[], allowFreeInput?: boolean): Promise<string> => {
      return new Promise((resolve) => {
        askResolverRef.current = resolve

        if (allowFreeInput && (!options || options.length === 0)) {
          // Free text input mode
          setTextInputActive(true)
          setTextInputPrompt(question)
        }
        // Options mode is handled by the panel's select component
      })
    },
    [],
  )

  const handleSelectConfirm = useCallback((signal: number) => {
    setPanelState((prev) => {
      if (prev.activeZone.type !== 'select') return prev

      if (signal === -1) {
        // Move cursor up
        const newCursor = (prev.activeZone.cursor - 1 + prev.activeZone.options.length) % prev.activeZone.options.length
        return { ...prev, activeZone: { ...prev.activeZone, cursor: newCursor } }
      }
      if (signal === -2) {
        // Move cursor down
        const newCursor = (prev.activeZone.cursor + 1) % prev.activeZone.options.length
        return { ...prev, activeZone: { ...prev.activeZone, cursor: newCursor } }
      }

      // Confirm selection
      const selected = prev.activeZone.options[signal]
      if (selected && askResolverRef.current) {
        askResolverRef.current(selected.label)
        askResolverRef.current = null
      }
      return prev
    })
  }, [])

  const handleTextSubmit = useCallback((value: string) => {
    if (askResolverRef.current) {
      askResolverRef.current(value)
      askResolverRef.current = null
    }
    setTextInputActive(false)
    setTextInputPrompt('')
  }, [])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    if (askResolverRef.current) {
      askResolverRef.current('')
      askResolverRef.current = null
    }
    onCancel()
  }, [onCancel])

  // Start agent on mount
  useEffect(() => {
    const run = async () => {
      const config = loadConfig()
      if (!config) {
        handleProgress({ type: 'error', error: '配置未初始化' })
        return
      }

      await runExportAgent(config, handleProgress, handleAskUser)

      if (!cancelledRef.current) {
        // Wait a moment for user to see the result, then complete on any key
        // The complete state is handled by panel rendering
      }
    }

    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box flexDirection="column">
      <ExportProtocolPanel
        phase={panelState.phase}
        trail={panelState.trail}
        activeZone={panelState.activeZone}
        onSelectConfirm={handleSelectConfirm}
        onTextSubmit={handleTextSubmit}
        onCancel={handleCancel}
      />
      {textInputActive && (
        <TextInput
          prompt={textInputPrompt}
          onSubmit={handleTextSubmit}
          onEscape={handleCancel}
        />
      )}
      {panelState.phase === 'complete' && (
        <Box marginTop={1}>
          <TextInput
            prompt=""
            placeholder="按 Enter 返回"
            onSubmit={onComplete}
            onEscape={onComplete}
          />
        </Box>
      )}
    </Box>
  )
}
