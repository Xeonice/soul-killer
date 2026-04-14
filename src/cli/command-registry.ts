import React from 'react'
import { t } from '../infra/i18n/index.js'
import type { EngineAdapter, RecallResult } from '../infra/engine/adapter.js'
import type { ChatMessage } from '../infra/llm/stream.js'

export interface CommandDef {
  name: string
  description: string
  group: string
}

// ─── Command Router Types ───

export type Requirement = 'soul' | 'engine' | 'args' | 'conversation'

export interface AppState {
  phase: 'boot' | 'setup' | 'idle' | 'command' | 'exit'
  promptMode: string
  promptStatus: string
  soulName?: string
  soulDir?: string
  commandOutput: React.ReactNode | null
  error: { severity: string; title: string; message: string; suggestions?: string[] } | null
  lastRecallResults: RecallResult[]
  chunks: unknown[]
  interactiveMode: boolean
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  isThinking: boolean
  isStreaming: boolean
  streamContent: string
}

export interface CommandContext {
  args: string
  state: Readonly<AppState>
  setState: (updater: (s: AppState) => AppState) => void
  engineRef: React.RefObject<EngineAdapter | null>
  conversationRef: React.RefObject<ChatMessage[]>
  closeInteractive: () => void
  handleRecallResults: (results: RecallResult[]) => void
  handleCreateComplete: (name: string, dir: string) => void
  handleUseComplete: (dir: string) => void
}

export interface SubcommandHandler {
  requires?: Requirement[]
  argDef?: { name: string }
  interactive?: boolean
  handle(ctx: CommandContext): React.ReactNode | void | Promise<React.ReactNode | void>
}

export interface CommandHandler extends SubcommandHandler {
  name: string
  descriptionKey: string
  groupKey: string
  subcommands?: Record<string, SubcommandHandler>
}

// ─── Handler Registry ───

const handlerRegistry = new Map<string, CommandHandler>()

export function registerCommand(handler: CommandHandler): void {
  handlerRegistry.set(handler.name, handler)
}

export function getHandler(name: string): CommandHandler | undefined {
  return handlerRegistry.get(name)
}

interface CommandTemplate {
  name: string
  descriptionKey: string
  groupKey: string
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  // 创建 & 数据
  { name: 'create', descriptionKey: 'cmd.create', groupKey: 'cmd.group.create' },
  { name: 'evolve', descriptionKey: 'cmd.evolve.desc', groupKey: 'cmd.group.create' },

  // 分身管理
  { name: 'status', descriptionKey: 'cmd.status', groupKey: 'cmd.group.manage' },
  { name: 'list', descriptionKey: 'cmd.list', groupKey: 'cmd.group.manage' },

  // 消费
  { name: 'use', descriptionKey: 'cmd.use', groupKey: 'cmd.group.consume' },
  { name: 'feedback', descriptionKey: 'cmd.feedback', groupKey: 'cmd.group.consume' },

  // 世界
  { name: 'world', descriptionKey: 'cmd.world', groupKey: 'cmd.group.world' },

  // 导出
  { name: 'export', descriptionKey: 'cmd.export', groupKey: 'cmd.group.export' },
  { name: 'pack', descriptionKey: 'cmd.pack', groupKey: 'cmd.group.export' },
  { name: 'unpack', descriptionKey: 'cmd.unpack', groupKey: 'cmd.group.export' },

  // 设置
  { name: 'config', descriptionKey: 'cmd.config', groupKey: 'cmd.group.settings' },
  { name: 'setup', descriptionKey: 'cmd.setup', groupKey: 'cmd.group.settings' },

  // 其他
  { name: 'help', descriptionKey: 'cmd.help', groupKey: 'cmd.group.other' },
  { name: 'exit', descriptionKey: 'cmd.exit', groupKey: 'cmd.group.other' },
]

export function getCommands(): CommandDef[] {
  return COMMAND_TEMPLATES.map((tpl) => ({
    name: tpl.name,
    description: t(tpl.descriptionKey),
    group: t(tpl.groupKey),
  }))
}

// Keep COMMANDS as a proxy for backward compat — resolves i18n keys on access
export const COMMANDS: CommandDef[] = new Proxy([] as CommandDef[], {
  get(_target, prop, _receiver) {
    const resolved = getCommands()
    const value = Reflect.get(resolved, prop)
    if (typeof value === 'function') {
      return value.bind(resolved)
    }
    return value
  },
})

export function getCommandNames(): string[] {
  return COMMAND_TEMPLATES.map((c) => c.name)
}

export function getCommandGroups(): { title: string; commands: CommandDef[] }[] {
  const commands = getCommands()
  const groupMap = new Map<string, CommandDef[]>()
  for (const cmd of commands) {
    if (!groupMap.has(cmd.group)) groupMap.set(cmd.group, [])
    groupMap.get(cmd.group)!.push(cmd)
  }
  return [...groupMap.entries()].map(([title, commands]) => ({ title, commands }))
}

export function filterCommands(prefix: string): CommandDef[] {
  const lower = prefix.toLowerCase()
  return getCommands().filter((c) => c.name.startsWith(lower))
}
