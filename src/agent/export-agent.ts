import { ToolLoopAgent, stepCountIs, tool } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { SoulkillerConfig } from '../config/schema.js'
import { readManifest, readSoulFiles } from '../soul/package.js'
import { loadBindings } from '../world/binding.js'
import { listWorlds, loadWorld } from '../world/manifest.js'
import { loadAllEntries } from '../world/entry.js'
import { packageSkill, getSkillDirName } from '../export/packager.js'
import type { StorySpecConfig } from '../export/story-spec.js'
import { logger } from '../utils/logger.js'

// --- Progress event types ---

export type ExportProgressEvent =
  | { type: 'phase'; phase: ExportPhase }
  | { type: 'tool_start'; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; result_summary: string }
  | { type: 'ask_user_start'; question: string; options?: AskUserOption[]; allow_free_input?: boolean }
  | { type: 'ask_user_end'; answer: string }
  | { type: 'package_step'; step: string; status: 'pending' | 'running' | 'done' }
  | { type: 'complete'; output_dir: string; files: string[]; skill_name: string }
  | { type: 'error'; error: string }

export type ExportPhase = 'initiating' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'

export interface AskUserOption {
  label: string
  description?: string
}

export type OnExportProgress = (event: ExportProgressEvent) => void
export type AskUserHandler = (question: string, options?: AskUserOption[], allowFreeInput?: boolean) => Promise<string>

// --- Export Agent ---

const SYSTEM_PROMPT = `你是 Soulkiller 的导出代理。你的任务是引导用户将一个 Soul（分身）+ World（世界）组合导出为 Claude Code Cloud Skill。

## 流程

1. 调用 list_souls 获取所有可用分身
   - 如果只有一个分身，直接使用它，告知用户
   - 如果有多个，通过 ask_user 让用户选择
   - 如果没有分身，通过 ask_user 告知用户需要先创建

2. 调用 list_worlds 列出所有可用世界（不限于已绑定的）
   - 如果只有一个世界，直接使用，告知用户
   - 如果有多个，通过 ask_user 让用户选择。已绑定的世界可以标注但不限制选择范围
   - 如果没有任何世界，通过 ask_user 告知用户需要先创建

3. 调用 read_soul 和 read_world 读取完整数据

4. 基于 Soul 的人格特征和 World 的世界观，推导出 3-4 个适配的故事基调选项。每个选项要有一个简短标题和一句话描述。不要使用通用的"悬疑/温情/冒险"，而是要反映这个 Soul + World 组合的独特性。

5. 通过 ask_user 让用户选择基调，然后推荐幕数和结局数，让用户确认或调整

6. 通过 ask_user 询问用户希望将 Skill 放到哪个目录下。提供选项：
   - ".claude/skills（当前项目）" — 使用路径 .claude/skills
   - "~/.claude/skills（全局）" — 使用路径 ~/.claude/skills
   - "默认导出目录" — 使用 ~/.soulkiller/exports
   - "自定义路径" — 让用户输入自定义路径

7. 调用 package_skill 打包导出，传入用户选择的 output_dir

## 注意事项
- 每一步都要简洁明了
- 如果用户场景简单（只有一个 Soul/World），主动跳过选择步骤
- 推导基调时要基于实际读取到的 Soul 和 World 内容，不要凭空想象
`

interface SoulSummary {
  name: string
  display_name: string
  version: string
  soul_type: string
  evolve_count: number
  bound_worlds: string[]
}

interface WorldSummary {
  name: string
  display_name: string
  world_type: string
  entry_count: number
  is_bound: boolean
}

function listSoulsImpl(): SoulSummary[] {
  const soulsDir = path.join(os.homedir(), '.soulkiller', 'souls')
  if (!fs.existsSync(soulsDir)) return []

  const entries = fs.readdirSync(soulsDir, { withFileTypes: true })
  const results: SoulSummary[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const soulDir = path.join(soulsDir, e.name)
    const manifest = readManifest(soulDir)
    if (!manifest) continue
    const bindings = loadBindings(soulDir)
    results.push({
      name: manifest.name,
      display_name: manifest.display_name,
      version: manifest.version,
      soul_type: manifest.soulType,
      evolve_count: manifest.evolve_history?.length ?? 0,
      bound_worlds: bindings.map((b) => b.world),
    })
  }
  return results
}

function listWorldsImpl(boundToSoul?: string): WorldSummary[] {
  const allWorlds = listWorlds()
  let boundWorldNames: Set<string> = new Set()

  if (boundToSoul) {
    const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', boundToSoul)
    const bindings = loadBindings(soulDir)
    boundWorldNames = new Set(bindings.map((b) => b.world))
  }

  return allWorlds.map((w) => ({
    name: w.name,
    display_name: w.display_name,
    world_type: w.worldType,
    entry_count: w.entry_count,
    is_bound: boundWorldNames.has(w.name),
  }))
}

function readSoulImpl(name: string): Record<string, unknown> {
  const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', name)
  const manifest = readManifest(soulDir)
  if (!manifest) return { error: `Soul '${name}' not found` }

  const files = readSoulFiles(soulDir)
  return {
    manifest,
    identity: files.identity,
    style: files.style,
    behaviors: files.behaviors,
    tags: manifest.tags,
  }
}

function readWorldImpl(name: string): Record<string, unknown> {
  const manifest = loadWorld(name)
  if (!manifest) return { error: `World '${name}' not found` }

  const entries = loadAllEntries(name)
  return {
    manifest,
    entries: entries.map((e) => ({
      name: e.meta.name,
      meta: e.meta,
      content: e.content,
    })),
  }
}

export async function runExportAgent(
  config: SoulkillerConfig,
  onProgress: OnExportProgress,
  askUser: AskUserHandler,
): Promise<void> {
  const tag = '[export-agent]'
  logger.info(`${tag} Starting export agent`)

  onProgress({ type: 'phase', phase: 'initiating' })

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1',
  })
  const model = provider(config.llm.default_model)

  // Create tools with progress hooks (using inputSchema for AI SDK v6)
  const tools = {
    list_souls: tool({
      description: '列出所有已创建的 Soul 分身',
      inputSchema: z.object({}),
      execute: async () => {
        onProgress({ type: 'tool_start', tool: 'list_souls' })
        const souls = listSoulsImpl()
        onProgress({ type: 'tool_end', tool: 'list_souls', result_summary: `${souls.length} 个分身` })
        onProgress({ type: 'phase', phase: 'selecting' })
        return { souls }
      },
    }),

    list_worlds: tool({
      description: '列出所有可用的世界。可选按绑定 Soul 过滤。',
      inputSchema: z.object({
        bound_to_soul: z.string().optional().describe('仅返回绑定到此 Soul 的世界'),
      }),
      execute: async ({ bound_to_soul }: { bound_to_soul?: string }) => {
        onProgress({ type: 'tool_start', tool: 'list_worlds', args: bound_to_soul ? { bound_to_soul } : {} })
        const worlds = listWorldsImpl(bound_to_soul)
        const boundCount = worlds.filter((w) => w.is_bound).length
        const summary = bound_to_soul ? `${boundCount} 个已绑定, ${worlds.length} 个总计` : `${worlds.length} 个世界`
        onProgress({ type: 'tool_end', tool: 'list_worlds', result_summary: summary })
        return { worlds }
      },
    }),

    read_soul: tool({
      description: '读取 Soul 的完整人格数据（identity, style, behaviors）',
      inputSchema: z.object({
        name: z.string().describe('Soul 名称'),
      }),
      execute: async ({ name }: { name: string }) => {
        onProgress({ type: 'tool_start', tool: 'read_soul', args: { name } })
        onProgress({ type: 'phase', phase: 'analyzing' })
        const result = readSoulImpl(name)
        if (result.error) {
          onProgress({ type: 'tool_end', tool: 'read_soul', result_summary: String(result.error) })
        } else {
          const behaviors = result.behaviors as string[]
          onProgress({ type: 'tool_end', tool: 'read_soul', result_summary: `identity + style + ${behaviors.length} behaviors` })
        }
        return result
      },
    }),

    read_world: tool({
      description: '读取 World 的完整世界观数据（manifest + entries）',
      inputSchema: z.object({
        name: z.string().describe('World 名称'),
      }),
      execute: async ({ name }: { name: string }) => {
        onProgress({ type: 'tool_start', tool: 'read_world', args: { name } })
        const result = readWorldImpl(name)
        if (result.error) {
          onProgress({ type: 'tool_end', tool: 'read_world', result_summary: String(result.error) })
        } else {
          const entries = result.entries as unknown[]
          onProgress({ type: 'tool_end', tool: 'read_world', result_summary: `${entries.length} entries` })
        }
        return result
      },
    }),

    ask_user: tool({
      description: '向用户提出问题。可附带选项供选择，或允许自由文本输入。',
      inputSchema: z.object({
        question: z.string().describe('要问用户的问题'),
        options: z.array(z.object({
          label: z.string(),
          description: z.string().optional(),
        })).optional().describe('选项列表'),
        allow_free_input: z.boolean().optional().describe('是否允许自由文本输入'),
      }),
      execute: async ({ question, options, allow_free_input }: { question: string; options?: AskUserOption[]; allow_free_input?: boolean }) => {
        onProgress({ type: 'ask_user_start', question, options, allow_free_input })
        const answer = await askUser(question, options, allow_free_input)
        onProgress({ type: 'ask_user_end', answer })
        return { answer }
      },
    }),

    package_skill: tool({
      description: '将 Soul + World + Story Spec 打包为 Cloud Skill 目录',
      inputSchema: z.object({
        soul_name: z.string(),
        world_name: z.string(),
        story_spec: z.object({
          genre: z.string(),
          tone: z.string(),
          acts: z.number(),
          endings_min: z.number(),
          rounds: z.string(),
          constraints: z.array(z.string()),
        }),
        output_dir: z.string().optional().describe('目标目录路径。不提供则使用默认的 ~/.soulkiller/exports/'),
      }),
      execute: async ({ soul_name, world_name, story_spec, output_dir }: { soul_name: string; world_name: string; story_spec: StorySpecConfig; output_dir?: string }) => {
        onProgress({ type: 'tool_start', tool: 'package_skill' })
        onProgress({ type: 'phase', phase: 'packaging' })

        // Emit sub-step progress
        const steps = ['copy_soul', 'copy_world', 'gen_story_spec', 'gen_skill']
        for (const s of steps) {
          onProgress({ type: 'package_step', step: s, status: 'pending' })
        }

        onProgress({ type: 'package_step', step: 'copy_soul', status: 'running' })
        // Resolve ~ in output_dir
        const resolvedDir = output_dir?.replace(/^~/, os.homedir())
        const result = packageSkill({ soul_name, world_name, story_spec, output_dir: resolvedDir })

        for (const s of steps) {
          onProgress({ type: 'package_step', step: s, status: 'done' })
        }

        onProgress({ type: 'tool_end', tool: 'package_skill', result_summary: `${result.files.length} files` })
        const skillDirName = getSkillDirName(soul_name, world_name)
        onProgress({ type: 'complete', output_dir: result.output_dir, files: result.files, skill_name: skillDirName })
        onProgress({ type: 'phase', phase: 'complete' })

        return { output_dir: result.output_dir, files: result.files, skill_dir_name: getSkillDirName(soul_name, world_name) }
      },
    }),
  }

  try {
    const agent = new ToolLoopAgent({
      model,
      instructions: SYSTEM_PROMPT,
      tools,
      toolChoice: 'auto',
      temperature: 0,
      stopWhen: [stepCountIs(20)],
    })

    const streamResult = await agent.stream({ prompt: '开始导出流程。' })

    // Consume the stream to drive the agent loop
    for await (const _event of streamResult.fullStream) {
      // Events are handled by tool execute callbacks
    }

    logger.info(`${tag} Export agent completed`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error(`${tag} Export agent error:`, errorMsg)
    onProgress({ type: 'error', error: errorMsg })
  }
}
