import { t } from '../i18n/index.js'
import { suggestCommand } from './command-parser.js'
import type { ParsedCommand } from './command-parser.js'
import { getHandler, type CommandContext, type SubcommandHandler } from './command-registry.js'

export async function dispatch(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
  const handler = getHandler(parsed.name)

  if (!handler) {
    const suggestion = suggestCommand(parsed.name)
    const msg = suggestion
      ? t('error.unknown_command_suggest', { name: parsed.name, suggestion })
      : t('error.unknown_command', { name: parsed.name })
    ctx.setState((s) => ({
      ...s,
      error: {
        severity: 'warning',
        title: 'UNKNOWN COMMAND',
        message: msg,
      },
    }))
    return
  }

  // Resolve effective handler (subcommand or default)
  let effective: SubcommandHandler = handler
  let effectiveArgs = parsed.args

  if (handler.subcommands) {
    const firstToken = parsed.args.split(/\s+/)[0] ?? ''
    const sub = handler.subcommands[firstToken]
    if (sub) {
      effective = sub
      effectiveArgs = parsed.args.slice(firstToken.length).trim()
    }
  }

  // Check requires
  if (effective.requires) {
    for (const req of effective.requires) {
      switch (req) {
        case 'args':
          if (!effectiveArgs) {
            ctx.setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'MISSING ARGUMENT',
                message: t('error.missing_argument', {
                  command: parsed.name,
                  arg: effective.argDef?.name ?? 'argument',
                }),
              },
            }))
            return
          }
          break
        case 'soul':
          if (!ctx.state.soulDir) {
            ctx.setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO SOUL',
                message: t('evolve.no_soul_loaded'),
                suggestions: ['/use <name>', '/create'],
              },
            }))
            return
          }
          break
        case 'engine':
          if (!ctx.engineRef.current) {
            ctx.setState((s) => ({
              ...s,
              error: {
                severity: 'warning',
                title: 'NO ENGINE',
                message: t('error.no_engine'),
              },
            }))
            return
          }
          break
        case 'conversation': {
          const conv = ctx.conversationRef.current
          if (!ctx.state.soulDir || conv.length < 2) {
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
          break
        }
      }
    }
  }

  // Execute handler
  const result = await effective.handle({ ...ctx, args: effectiveArgs })

  // If handler returned a ReactNode, set commandOutput + interactiveMode
  if (result !== undefined && result !== null) {
    ctx.setState((s) => ({
      ...s,
      commandOutput: result,
      interactiveMode: effective.interactive ?? false,
    }))
  }
}
