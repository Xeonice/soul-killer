import React from 'react'
import { registerCommand, type CommandHandler, type CommandContext } from '../command-registry.js'
import { listLocalSouls, getSoulsDir } from '../soul-resolver.js'
import { loadConfig } from '../../config/loader.js'
import { setLocale } from '../../infra/i18n/index.js'
import { t } from '../../infra/i18n/index.js'

// ─── Lazy component imports (only resolved when handle is called) ───
// We use inline imports via React.createElement to avoid top-level circular deps.
// All components are imported at the top for simplicity since they're already
// imported by app.tsx anyway.

import { HelpCommand } from './system/help.js'
import { ModelCommand } from './system/model.js'
import { StatusCommand } from './system/status.js'
import { EvolveStatusCommand } from './soul/evolve-status.js'
import { EvolveRollbackCommand } from './soul/evolve-rollback.js'
import { RecallCommand } from './system/recall.js'
import { SourceCommand } from './system/source.js'
import { CreateCommand } from './soul/create.js'
import { UseCommand } from './soul/use.js'
import { ListCommand } from './soul/list.js'
import { ConfigCommand } from './system/config.js'
import { FeedbackCommand } from './soul/feedback.js'
import { WorldCommand } from './world/world.js'
import { ExportCommand } from './export/export.js'
import { PackCommand } from './export/pack.js'
import { UnpackCommand } from './export/unpack.js'

// ─── 3.4 Special: exit ───

const exitCommand: CommandHandler = {
  name: 'exit',
  descriptionKey: 'cmd.exit',
  groupKey: 'cmd.group.other',
  handle(ctx) {
    ctx.setState((s) => ({ ...s, phase: 'exit' }))
  },
}

// ─── 3.1 Simple: help, model, source ───

const helpCommand: CommandHandler = {
  name: 'help',
  descriptionKey: 'cmd.help',
  groupKey: 'cmd.group.other',
  handle() {
    return React.createElement(HelpCommand)
  },
}

const modelCommand: CommandHandler = {
  name: 'model',
  descriptionKey: 'cmd.model',
  groupKey: 'cmd.group.settings',
  handle(ctx) {
    return React.createElement(ModelCommand, { args: ctx.args })
  },
}

const sourceCommand: CommandHandler = {
  name: 'source',
  descriptionKey: 'cmd.source',
  groupKey: 'cmd.group.consume',
  handle(ctx) {
    return React.createElement(SourceCommand, { lastRecallResults: ctx.state.lastRecallResults })
  },
}

// ─── 3.5 Async: status ───

const statusCommand: CommandHandler = {
  name: 'status',
  descriptionKey: 'cmd.status',
  groupKey: 'cmd.group.manage',
  async handle(ctx) {
    const engine = ctx.engineRef.current
    if (engine) {
      try {
        const engineStatus = await engine.status()
        return React.createElement(StatusCommand, { soulName: ctx.state.soulName, engineStatus })
      } catch {
        return React.createElement(StatusCommand, { soulName: ctx.state.soulName })
      }
    }
    return React.createElement(StatusCommand, { soulName: ctx.state.soulName })
  },
}

// ─── 3.3 Interactive: config, create, list, world, export ───

const configCommand: CommandHandler = {
  name: 'config',
  descriptionKey: 'cmd.config',
  groupKey: 'cmd.group.settings',
  interactive: true,
  handle(ctx) {
    return React.createElement(ConfigCommand, {
      onClose: () => {
        const updated = loadConfig()
        if (updated) setLocale(updated.language)
        ctx.closeInteractive()
      },
    })
  },
}

const setupCommand: CommandHandler = {
  name: 'setup',
  descriptionKey: 'cmd.setup',
  groupKey: 'cmd.group.settings',
  interactive: true,
  handle(ctx) {
    ctx.setState((s) => ({
      ...s,
      phase: 'setup',
      interactiveMode: true,
      commandOutput: null,
    }))
  },
}

const createCommand: CommandHandler = {
  name: 'create',
  descriptionKey: 'cmd.create',
  groupKey: 'cmd.group.create',
  interactive: true,
  handle(ctx) {
    return React.createElement(CreateCommand, {
      onComplete: ctx.handleCreateComplete,
      onCancel: ctx.closeInteractive,
    })
  },
}

const listCommand: CommandHandler = {
  name: 'list',
  descriptionKey: 'cmd.list',
  groupKey: 'cmd.group.manage',
  interactive: true,
  handle(ctx) {
    return React.createElement(ListCommand, {
      onUse: (name: string, dir: string) => {
        ctx.conversationRef.current = []
        ctx.setState((s) => ({
          ...s,
          soulName: name,
          soulDir: dir,
          promptMode: 'loaded',
          interactiveMode: false,
          commandOutput: null,
          conversationMessages: [],
        }))
      },
      onClose: ctx.closeInteractive,
    })
  },
}

const worldCommand: CommandHandler = {
  name: 'world',
  descriptionKey: 'cmd.world',
  groupKey: 'cmd.group.world',
  interactive: true,
  handle(ctx) {
    return React.createElement(WorldCommand, {
      soulDir: ctx.state.soulDir,
      onClose: ctx.closeInteractive,
    })
  },
}

const exportCommand: CommandHandler = {
  name: 'export',
  descriptionKey: 'cmd.export',
  groupKey: 'cmd.group.export',
  interactive: true,
  handle(ctx) {
    return React.createElement(ExportCommand, {
      onComplete: ctx.closeInteractive,
      onCancel: ctx.closeInteractive,
    })
  },
}

// ─── 3.3 Interactive: feedback (requires conversation) ───

const feedbackCommand: CommandHandler = {
  name: 'feedback',
  descriptionKey: 'cmd.feedback',
  groupKey: 'cmd.group.consume',
  requires: ['conversation'],
  interactive: true,
  handle(ctx) {
    const convMessages = ctx.conversationRef.current
    const lastAssistant = [...convMessages].reverse().find((m) => m.role === 'assistant')
    const lastUser = [...convMessages].reverse().find((m) => m.role === 'user')
    if (!lastAssistant || !lastUser) {
      ctx.setState((s) => ({
        ...s,
        error: {
          severity: 'warning',
          title: 'NO CONVERSATION',
          message: t('feedback.no_conversation'),
        },
      }))
      return
    }
    return React.createElement(FeedbackCommand, {
      soulDir: ctx.state.soulDir!,
      userQuery: lastUser.content,
      assistantResponse: lastAssistant.content,
      onComplete: ctx.closeInteractive,
      onExit: ctx.closeInteractive,
    })
  },
}

// ─── 3.2 Args required: use, recall, pack, unpack ───

const useCommand: CommandHandler = {
  name: 'use',
  descriptionKey: 'cmd.use',
  groupKey: 'cmd.group.consume',
  requires: ['args'],
  argDef: { name: 'name' },
  interactive: true,
  handle(ctx) {
    if (ctx.args === ctx.state.soulName) {
      // Already loaded this soul, do nothing
      return
    }
    const useSouls = listLocalSouls()
    if (!useSouls.some((s) => s.name === ctx.args)) {
      ctx.setState((s) => ({
        ...s,
        error: {
          severity: 'warning',
          title: 'SOUL NOT FOUND',
          message: t('error.soul_not_found', { name: ctx.args }),
          suggestions: ['/list'],
        },
      }))
      return
    }
    return React.createElement(UseCommand, {
      name: ctx.args,
      onComplete: ctx.handleUseComplete,
    })
  },
}

const recallCommand: CommandHandler = {
  name: 'recall',
  descriptionKey: 'cmd.recall',
  groupKey: 'cmd.group.consume',
  requires: ['args', 'engine'],
  argDef: { name: 'query' },
  handle(ctx) {
    return React.createElement(RecallCommand, {
      query: ctx.args,
      engine: ctx.engineRef.current!,
      onResults: ctx.handleRecallResults,
    })
  },
}

const packCommand: CommandHandler = {
  name: 'pack',
  descriptionKey: 'cmd.pack',
  groupKey: 'cmd.group.export',
  argDef: { name: '[soul|world <name>] [--output <dir>]' },
  handle(ctx) {
    return React.createElement(PackCommand, {
      args: ctx.args,
      onComplete: () => ctx.setState((s) => ({ ...s, commandOutput: null })),
    })
  },
}

const unpackCommand: CommandHandler = {
  name: 'unpack',
  descriptionKey: 'cmd.unpack',
  groupKey: 'cmd.group.export',
  argDef: { name: '[path]' },
  interactive: true,
  handle(ctx) {
    return React.createElement(UnpackCommand, {
      args: ctx.args,
      onComplete: ctx.closeInteractive,
      onCancel: ctx.closeInteractive,
    })
  },
}

// ─── 3.6 Subcommands: evolve ───

const evolveCommand: CommandHandler = {
  name: 'evolve',
  descriptionKey: 'cmd.evolve.desc',
  groupKey: 'cmd.group.create',
  subcommands: {
    status: {
      requires: ['soul'],
      handle(ctx) {
        return React.createElement(EvolveStatusCommand, {
          soulDir: ctx.state.soulDir!,
          soulName: ctx.state.soulName!,
        })
      },
    },
    rollback: {
      requires: ['soul'],
      interactive: true,
      handle(ctx) {
        return React.createElement(EvolveRollbackCommand, {
          soulDir: ctx.state.soulDir!,
          soulName: ctx.state.soulName!,
          chunkCount: (ctx.state.chunks as unknown[]).length,
          onComplete: ctx.closeInteractive,
          onExit: ctx.closeInteractive,
        })
      },
    },
  },
  // Default: /evolve [name]
  interactive: true,
  handle(ctx) {
    const targetSoulName = ctx.args || ctx.state.soulName
    if (!targetSoulName) {
      ctx.setState((s) => ({
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
      ctx.setState((s) => ({
        ...s,
        error: {
          severity: 'warning',
          title: 'SOUL NOT FOUND',
          message: t('error.soul_not_found', { name: targetSoulName }),
          suggestions: ['/list'],
        },
      }))
      return
    }
    const evolveSoulDir = `${getSoulsDir()}/${targetSoul.name}`

    // If this soul isn't currently loaded, load it
    if (ctx.state.soulDir !== evolveSoulDir) {
      ctx.conversationRef.current = []
      ctx.setState((s) => ({
        ...s,
        soulName: targetSoul.name,
        soulDir: evolveSoulDir,
        promptMode: 'loaded',
        conversationMessages: [],
      }))
    }

    return React.createElement(CreateCommand, {
      supplementSoul: { name: targetSoul.name, dir: evolveSoulDir },
      onComplete: (_name: string, _dir: string) => ctx.closeInteractive(),
      onCancel: ctx.closeInteractive,
    })
  },
}

// ─── Register all commands ───

export function registerAllCommands(): void {
  const all: CommandHandler[] = [
    exitCommand,
    helpCommand,
    modelCommand,
    sourceCommand,
    statusCommand,
    configCommand,
    setupCommand,
    createCommand,
    listCommand,
    worldCommand,
    exportCommand,
    feedbackCommand,
    useCommand,
    recallCommand,
    packCommand,
    unpackCommand,
    evolveCommand,
  ]
  for (const cmd of all) {
    registerCommand(cmd)
  }
}
