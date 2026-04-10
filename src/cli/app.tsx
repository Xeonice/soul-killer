import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Text, Box, useApp } from 'ink'
import { BootAnimation } from './animation/boot-animation.js'
import { ExitAnimation } from './animation/exit-animation.js'
import { MalfunctionError, type Severity } from './animation/malfunction-error.js'
import { type PromptMode, type PromptStatus } from './components/prompt.js'
import { ConversationView, type ConversationMessage } from './components/conversation-view.js'
import { TextInput } from './components/text-input.js'
import { parseInput } from './command-parser.js'
import { COMMANDS, type AppState as RegistryAppState, type CommandContext } from './command-registry.js'
import { listLocalSouls } from './soul-resolver.js'
import type { ArgCompletionMap } from './components/text-input.js'
import { isConfigured, loadConfig } from '../config/loader.js'
import { SetupWizard } from '../config/setup-wizard.js'
import type { SoulkillerConfig } from '../config/schema.js'
import { createLLMClient, getLLMClient } from '../llm/client.js'
import { streamChat, type ChatMessage } from '../llm/stream.js'
import { loadSoulFiles } from '../soul/distill/generator.js'
import { detectEngine } from '../engine/detect.js'
import type { EngineAdapter, RecallResult } from '../engine/adapter.js'
import type { SoulChunk } from '../infra/ingest/types.js'
import { PRIMARY, ACCENT, DIM } from './animation/colors.js'
import { setLocale, t } from '../i18n/index.js'
import { assembleContext } from '../world/context-assembler.js'
import { loadBindings } from '../world/binding.js'
import { emptyTagSet } from '../tags/taxonomy.js'
import { listWorlds } from '../world/manifest.js'
import { dispatch } from './command-router.js'
import { registerAllCommands } from './commands/index.js'

// Register all command handlers once at module load
registerAllCommands()

type AppPhase = 'boot' | 'setup' | 'idle' | 'command' | 'exit'

interface AppState {
  phase: AppPhase
  promptMode: PromptMode
  promptStatus: PromptStatus
  soulName?: string
  soulDir?: string
  commandOutput: React.ReactNode | null
  error: { severity: Severity; title: string; message: string; suggestions?: string[] } | null
  lastRecallResults: RecallResult[]
  chunks: SoulChunk[]
  interactiveMode: boolean
  conversationMessages: ConversationMessage[]
  isThinking: boolean
  isStreaming: boolean
  streamContent: string
}

const soulCompletionProvider = () => listLocalSouls().map((s) => ({
  name: s.name,
  description: s.description || `${s.chunkCount} chunks`,
  group: 'souls',
}))

const worldCompletionProvider = () => listWorlds().map((w) => ({
  name: w.name,
  description: w.display_name || w.description,
  group: 'worlds',
}))

const packSubcommandProvider = () => [
  { name: 'soul', description: 'Pack a soul with bound worlds', group: 'subcommands' },
  { name: 'world', description: 'Pack a world', group: 'subcommands' },
]

const ARG_COMPLETION_MAP: ArgCompletionMap = {
  use: {
    provider: soulCompletionProvider,
    title: 'SOULS',
  },
  pack: {
    provider: packSubcommandProvider,
    title: 'TYPE',
  },
  evolve: {
    provider: soulCompletionProvider,
    title: 'SOULS',
  },
  world: {
    provider: worldCompletionProvider,
    title: 'WORLDS',
  },
}

export function App() {
  const { exit } = useApp()
  const [state, setState] = useState<AppState>({
    phase: 'boot',
    promptMode: 'void',
    promptStatus: 'idle',
    commandOutput: null,
    error: null,
    lastRecallResults: [],
    chunks: [],
    interactiveMode: false,
    conversationMessages: [],
    isThinking: false,
    isStreaming: false,
    streamContent: '',
  })

  const engineRef = useRef<EngineAdapter | null>(null)
  const conversationRef = useRef<ChatMessage[]>([])

  // Initialize engine when soulDir is set
  useEffect(() => {
    if (!state.soulDir) return
    let cancelled = false

    async function init() {
      try {
        const engine = await detectEngine(state.soulDir!)
        if (!cancelled) {
          engineRef.current = engine
        }
      } catch {
        // Engine detection failed, continue without engine
      }
    }

    init()
    return () => { cancelled = true }
  }, [state.soulDir])

  const handleBootComplete = useCallback(() => {
    const configured = isConfigured()
    if (configured) {
      const config = loadConfig()
      if (config) {
        createLLMClient(config)
        setLocale(config.language)
      }
    }
    setState((s) => ({
      ...s,
      phase: configured ? 'idle' : 'setup',
    }))
  }, [])

  const handleExitComplete = useCallback(() => {
    exit()
  }, [exit])

  const handleCreateComplete = useCallback((soulName: string, soulDir: string) => {
    conversationRef.current = []
    setState((s) => ({
      ...s,
      soulName,
      soulDir,
      promptMode: 'loaded',
      interactiveMode: false,
      commandOutput: null,
      conversationMessages: [],
    }))
  }, [])

  const handleUseComplete = useCallback((soulDir: string) => {
    const name = soulDir.split('/').pop() ?? 'unknown'
    conversationRef.current = []
    setState((s) => ({
      ...s,
      soulName: name,
      soulDir,
      promptMode: 'relic',
      interactiveMode: false,
      commandOutput: null,
      conversationMessages: [],
    }))
  }, [])

  const handleRecallResults = useCallback((results: RecallResult[]) => {
    setState((s) => ({
      ...s,
      lastRecallResults: results,
    }))
  }, [])

  const handleInput = useCallback(async (input: string) => {
    if (!input.trim()) return

    setState((s) => ({ ...s, commandOutput: null, error: null, interactiveMode: false }))

    const parsed = parseInput(input)

    if (parsed.type === 'slash') {
      const ctx: CommandContext = {
        args: parsed.args,
        state: state as unknown as RegistryAppState,
        setState: setState as unknown as CommandContext['setState'],
        engineRef,
        conversationRef,
        closeInteractive: () => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null })),
        handleRecallResults,
        handleCreateComplete,
        handleUseComplete,
      }
      await dispatch(parsed, ctx)
      return
    }

    // Natural language input — needs a loaded soul
    if (state.promptMode === 'void') {
      setState((s) => ({
        ...s,
        error: {
          severity: 'warning',
          title: 'NO SOUL LOADED',
          message: t('error.no_soul'),
        },
      }))
      return
    }

    // Conversation flow
    if (!state.soulDir) return

    const soulFiles = loadSoulFiles(state.soulDir)
    if (!soulFiles) {
      setState((s) => ({
        ...s,
        error: {
          severity: 'warning',
          title: 'SOUL FILES MISSING',
          message: t('error.soul_files_missing'),
        },
      }))
      return
    }

    const config = loadConfig()
    if (!config) return

    const userText = parsed.type === 'natural' ? parsed.text : input

    // 1. Push user message to conversation display + LLM context
    setState((s) => ({
      ...s,
      conversationMessages: [...s.conversationMessages, { role: 'user' as const, content: userText }],
      isThinking: true,
      commandOutput: null,
    }))
    conversationRef.current.push({ role: 'user', content: userText })

    const bindings = state.soulDir ? loadBindings(state.soulDir) : []
    const systemPrompt = await assembleContext({
      soulFiles,
      soulName: state.soulName ?? 'unknown',
      soulDisplayName: state.soulName ?? 'unknown',
      soulTags: emptyTagSet(),
      bindings,
      userInput: userText,
      recentMessages: conversationRef.current,
      recallResults: state.lastRecallResults,
      engine: engineRef.current ?? undefined,
    })
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationRef.current,
    ]

    try {
      const client = getLLMClient()

      // 2. Streaming phase
      setState((s) => ({ ...s, isThinking: false, isStreaming: true, streamContent: '', promptStatus: 'streaming' }))

      const stream = streamChat(client, messages)
      let fullText = ''

      for await (const chunk of stream) {
        fullText += chunk
        setState((s) => ({ ...s, streamContent: fullText }))
      }

      // 3. Complete — push assistant message to history
      conversationRef.current.push({ role: 'assistant', content: fullText })
      setState((s) => ({
        ...s,
        conversationMessages: [...s.conversationMessages, { role: 'assistant' as const, content: fullText }],
        isStreaming: false,
        streamContent: '',
        promptStatus: 'idle',
      }))
    } catch {
      setState((s) => ({
        ...s,
        isThinking: false,
        isStreaming: false,
        streamContent: '',
        promptStatus: 'idle',
        error: {
          severity: 'malfunction' as Severity,
          title: 'STREAM ERROR',
          message: t('error.stream_error'),
        },
      }))
    }
  }, [state.promptMode, state.soulDir, state.soulName, handleCreateComplete, handleUseComplete, handleRecallResults])

  // Boot animation
  if (state.phase === 'boot') {
    return <BootAnimation onComplete={handleBootComplete} />
  }

  // Exit animation
  if (state.phase === 'exit') {
    return <ExitAnimation onComplete={handleExitComplete} />
  }

  // Setup wizard
  if (state.phase === 'setup') {
    return (
      <SetupWizard
        onComplete={(config: SoulkillerConfig) => {
          createLLMClient(config)
          setState((s) => ({ ...s, phase: 'idle' }))
        }}
      />
    )
  }

  // Main REPL
  return (
    <Box flexDirection="column">
      {/* Conversation history */}
      {state.conversationMessages.length > 0 && state.soulName && (
        <ConversationView
          messages={state.conversationMessages}
          soulName={state.soulName}
          isThinking={state.isThinking}
          isStreaming={state.isStreaming}
          streamContent={state.streamContent}
        />
      )}
      {state.commandOutput}
      {state.error && (
        <MalfunctionError
          severity={state.error.severity}
          title={state.error.title}
          message={state.error.message}
          suggestions={state.error.suggestions}
        />
      )}
      {!state.interactiveMode && (
        <TextInput
          prompt={buildPromptString(state.promptMode, state.soulName, state.promptStatus)}
          completionItems={COMMANDS}
          argCompletionMap={ARG_COMPLETION_MAP}
          onSubmit={handleInput}
        />
      )}
    </Box>
  )
}

function buildPromptString(mode: PromptMode, soulName?: string, status?: PromptStatus): string {
  const name = mode === 'void' ? 'void' : soulName ?? 'unknown'
  let suffix = ''
  if (mode === 'relic' && status === 'idle') suffix = ' [RELIC]'
  if (status === 'recall') suffix = ' [RECALL]'
  if (status === 'streaming') suffix = ' [STREAMING]'
  if (status === 'malfunction') suffix = ' [!MALFUNCTION]'
  return `◈ soul://${name}${suffix} >`
}
