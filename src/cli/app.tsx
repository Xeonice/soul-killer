import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Text, Box, useApp } from 'ink'
import { BootAnimation } from './animation/boot-animation.js'
import { ExitAnimation } from './animation/exit-animation.js'
import { MalfunctionError, type Severity } from './animation/malfunction-error.js'
import { SoulPrompt, type PromptMode, type PromptStatus } from './components/prompt.js'
import { ConversationView, type ConversationMessage } from './components/conversation-view.js'
import { TextInput } from './components/text-input.js'
import { HelpCommand } from './commands/help.js'
import { ModelCommand } from './commands/model.js'
import { StatusCommand } from './commands/status.js'
import { EvolveCommand } from './commands/evolve.js'
import { EvolveStatusCommand } from './commands/evolve-status.js'
import { EvolveRollbackCommand } from './commands/evolve-rollback.js'
import { RecallCommand } from './commands/recall.js'
import { SourceCommand } from './commands/source.js'
import { CreateCommand } from './commands/create.js'
import { UseCommand } from './commands/use.js'
import { ListCommand } from './commands/list.js'
import { ConfigCommand } from './commands/config.js'
import { FeedbackCommand } from './commands/feedback.js'
import { parseInput, suggestCommand } from './command-parser.js'
import { COMMANDS } from './command-registry.js'
import { listLocalSouls, getSoulsDir } from './soul-resolver.js'
import type { ArgCompletionMap } from './components/text-input.js'
import { isConfigured, loadConfig } from '../config/loader.js'
import { SetupWizard } from '../config/setup-wizard.js'
import type { SoulkillerConfig } from '../config/schema.js'
import { createLLMClient, getLLMClient } from '../llm/client.js'
import { streamChat, type ChatMessage } from '../llm/stream.js'
import { loadSoulFiles } from '../distill/generator.js'
import { detectEngine } from '../engine/detect.js'
import type { EngineAdapter, RecallResult } from '../engine/adapter.js'
import type { SoulChunk } from '../ingest/types.js'
import { PRIMARY, ACCENT, DIM } from './animation/colors.js'
import { setLocale, t } from '../i18n/index.js'
import { assembleContext } from '../world/context-assembler.js'
import { loadBindings } from '../world/binding.js'
import { emptyTagSet } from '../tags/taxonomy.js'
import { WorldCommand } from './commands/world.js'
import { ExportCommand } from './commands/export.js'
import { PackCommand } from './commands/pack.js'
import { UnpackCommand } from './commands/unpack.js'
import { listWorlds } from '../world/manifest.js'

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
      switch (parsed.name) {
        case 'exit':
          setState((s) => ({ ...s, phase: 'exit' }))
          return
        case 'help':
          setState((s) => ({ ...s, commandOutput: <HelpCommand /> }))
          return
        case 'model':
          setState((s) => ({ ...s, commandOutput: <ModelCommand args={parsed.args} /> }))
          return
        case 'config':
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <ConfigCommand
                onClose={() => {
                  // Reload config to pick up any changes (e.g. language)
                  const updated = loadConfig()
                  if (updated) setLocale(updated.language)
                  setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))
                }}
              />
            ),
          }))
          return
        case 'status': {
          const engine = engineRef.current
          if (engine) {
            engine.status().then((engineStatus) => {
              setState((s) => ({
                ...s,
                commandOutput: <StatusCommand soulName={s.soulName} engineStatus={engineStatus} />,
              }))
            }).catch(() => {
              setState((s) => ({
                ...s,
                commandOutput: <StatusCommand soulName={s.soulName} />,
              }))
            })
          } else {
            setState((s) => ({
              ...s,
              commandOutput: <StatusCommand soulName={s.soulName} />,
            }))
          }
          return
        }
        case 'create':
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <CreateCommand
                onComplete={handleCreateComplete}
                onCancel={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        case 'use': {
          if (!parsed.args) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'MISSING ARGUMENT',
                message: t('error.missing_argument', { command: 'use', arg: 'name' }),
              },
            }))
            return
          }
          if (parsed.args === state.soulName) {
            // Already loaded this soul, do nothing
            return
          }
          const useSouls = listLocalSouls()
          if (!useSouls.some((s) => s.name === parsed.args)) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'SOUL NOT FOUND',
                message: t('error.soul_not_found', { name: parsed.args }),
                suggestions: ['/list'],
              },
            }))
            return
          }
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: <UseCommand name={parsed.args} onComplete={handleUseComplete} />,
          }))
          return
        }
        case 'list':
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <ListCommand
                onUse={(name, dir) => {
                  conversationRef.current = []
                  setState((s) => ({
                    ...s,
                    soulName: name,
                    soulDir: dir,
                    promptMode: 'loaded',
                    interactiveMode: false,
                    commandOutput: null,
                    conversationMessages: [],
                  }))
                }}
                onClose={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        case 'evolve': {
          // Parse subcommand: /evolve status, /evolve rollback, /evolve [name]
          const evolveArgs = parsed.args?.trim() ?? ''
          const evolveSubcommand = evolveArgs.split(/\s+/)[0] ?? ''

          // Handle /evolve status
          if (evolveSubcommand === 'status') {
            if (!state.soulDir || !state.soulName) {
              setState((s) => ({
                ...s,
                error: {
                  severity: 'warning',
                  title: 'NO SOUL',
                  message: t('evolve.no_soul_loaded'),
                },
              }))
              return
            }
            setState((s) => ({
              ...s,
              commandOutput: <EvolveStatusCommand soulDir={state.soulDir!} soulName={state.soulName!} />,
            }))
            return
          }

          // Handle /evolve rollback
          if (evolveSubcommand === 'rollback') {
            if (!state.soulDir || !state.soulName) {
              setState((s) => ({
                ...s,
                error: {
                  severity: 'warning',
                  title: 'NO SOUL',
                  message: t('evolve.no_soul_loaded'),
                },
              }))
              return
            }
            setState((s) => ({
              ...s,
              interactiveMode: true,
              commandOutput: (
                <EvolveRollbackCommand
                  soulDir={state.soulDir!}
                  soulName={state.soulName!}
                  chunkCount={s.chunks.length}
                  onComplete={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
                  onExit={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
                />
              ),
            }))
            return
          }

          // Determine target soul: argument name or currently loaded
          let targetSoulName = evolveArgs || state.soulName
          if (!targetSoulName) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO SOUL',
                message: t('evolve.no_soul_loaded'),
                suggestions: ['/use <name>', '/evolve <name>'],
              },
            }))
            return
          }

          const souls = listLocalSouls()
          const targetSoul = souls.find((s) => s.name === targetSoulName)
          if (!targetSoul) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'SOUL NOT FOUND',
                message: t('error.soul_not_found', { name: targetSoulName! }),
                suggestions: ['/list'],
              },
            }))
            return
          }
          const evolveSoulDir = `${getSoulsDir()}/${targetSoul.name}`

          // If this soul isn't currently loaded, load it (set soulDir triggers engine init)
          if (state.soulDir !== evolveSoulDir) {
            conversationRef.current = []
            setState((s) => ({
              ...s,
              soulName: targetSoul.name,
              soulDir: evolveSoulDir,
              promptMode: 'loaded',
              conversationMessages: [],
            }))
          }

          const handleEvolveComplete = (name: string, dir: string) => {
            setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))
          }
          const handleEvolveCancel = () => {
            setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))
          }
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <CreateCommand
                supplementSoul={{ name: targetSoul.name, dir: evolveSoulDir }}
                onComplete={handleEvolveComplete}
                onCancel={handleEvolveCancel}
              />
            ),
          }))
          return
        }
        case 'recall': {
          if (!parsed.args) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'MISSING ARGUMENT',
                message: t('error.missing_argument', { command: 'recall', arg: 'query' }),
              },
            }))
            return
          }
          if (!engineRef.current) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO ENGINE',
                message: t('error.no_engine'),
              },
            }))
            return
          }
          setState((s) => ({
            ...s,
            commandOutput: (
              <RecallCommand
                query={parsed.args}
                engine={engineRef.current!}
                onResults={handleRecallResults}
              />
            ),
          }))
          return
        }
        case 'source':
          setState((s) => ({
            ...s,
            commandOutput: <SourceCommand lastRecallResults={s.lastRecallResults} />,
          }))
          return
        case 'feedback': {
          // Use conversationRef (real-time) instead of state snapshot
          const convMessages = conversationRef.current
          if (!state.soulDir || convMessages.length < 2) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO CONVERSATION',
                message: t('feedback.no_conversation'),
              },
            }))
            return
          }
          const lastAssistant = [...convMessages].reverse().find((m) => m.role === 'assistant')
          const lastUser = [...convMessages].reverse().find((m) => m.role === 'user')
          if (!lastAssistant || !lastUser) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO CONVERSATION',
                message: t('feedback.no_conversation'),
              },
            }))
            return
          }
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <FeedbackCommand
                soulDir={state.soulDir!}
                userQuery={lastUser.content}
                assistantResponse={lastAssistant.content}
                onComplete={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
                onExit={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        }
        case 'world':
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <WorldCommand
                soulDir={state.soulDir}
                onClose={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        case 'export':
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <ExportCommand
                onComplete={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
                onCancel={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        case 'pack':
          if (!parsed.args) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'MISSING ARGUMENT',
                message: t('error.missing_argument', { command: 'pack', arg: 'soul|world <name>' }),
              },
            }))
            return
          }
          setState((s) => ({
            ...s,
            commandOutput: (
              <PackCommand
                args={parsed.args}
                onComplete={() => setState((s) => ({ ...s, commandOutput: null }))}
              />
            ),
          }))
          return
        case 'unpack':
          if (!parsed.args) {
            setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'MISSING ARGUMENT',
                message: t('error.missing_argument', { command: 'unpack', arg: '<path>' }),
              },
            }))
            return
          }
          setState((s) => ({
            ...s,
            interactiveMode: true,
            commandOutput: (
              <UnpackCommand
                args={parsed.args}
                onComplete={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
                onCancel={() => setState((s) => ({ ...s, interactiveMode: false, commandOutput: null }))}
              />
            ),
          }))
          return
        default: {
          const suggestion = suggestCommand(parsed.name)
          const msg = suggestion
            ? t('error.unknown_command_suggest', { name: parsed.name, suggestion })
            : t('error.unknown_command', { name: parsed.name })
          setState((s) => ({
            ...s,
            error: {
              severity: 'warning',
              title: 'UNKNOWN COMMAND',
              message: msg,
            },
          }))
          return
        }
      }
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

function buildSystemPrompt(soulFiles: {
  identity: string
  style: string
  behaviors: Record<string, string>
}): string {
  const parts = [
    t('system_prompt.intro') + '\n',
    `## ${t('system_prompt.identity')}\n`,
    soulFiles.identity,
    `\n## ${t('system_prompt.style')}\n`,
    soulFiles.style,
  ]

  const behaviorEntries = Object.entries(soulFiles.behaviors)
  if (behaviorEntries.length > 0) {
    parts.push(`\n## ${t('system_prompt.behaviors')}\n`)
    for (const [name, content] of behaviorEntries) {
      parts.push(`### ${name}\n${content}\n`)
    }
  }

  return parts.join('\n')
}
