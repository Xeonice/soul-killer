import { t } from '../i18n/index.js'

export interface CommandDef {
  name: string
  description: string
  group: string
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

  // 设置
  { name: 'config', descriptionKey: 'cmd.config', groupKey: 'cmd.group.settings' },

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
