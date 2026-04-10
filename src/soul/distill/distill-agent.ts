import fs from 'node:fs'
import path from 'node:path'
import { ToolLoopAgent, stepCountIs, hasToolCall, tool } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import type { SoulkillerConfig } from '../../config/schema.js'
import type { SoulChunk } from '../../infra/ingest/types.js'
import type { TagSet } from '../tags/taxonomy.js'
import type { AgentLogger } from '../../infra/utils/agent-logger.js'
import { withExacto, getProviderOptions } from '../../infra/llm/client.js'
import { logger } from '../../infra/utils/logger.js'

// ========== Article Index (for sessionDir path) ==========

interface ArticleEntry {
  index: number
  title: string
  url: string
  dimension: string
  charCount: number
  score: number
  content: string // full content kept in memory, served by readArticle
}

function buildArticleIndex(sessionDir: string): ArticleEntry[] {
  const articles: ArticleEntry[] = []
  const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const dimName = file.replace('.json', '')
    const data = JSON.parse(fs.readFileSync(path.join(sessionDir, file), 'utf-8'))
    const results: { title?: string; url?: string; content?: string; _score?: number }[] = data.results ?? []

    for (const r of results) {
      if (!r.content) continue
      articles.push({
        index: articles.length,
        title: r.title ?? '',
        url: r.url ?? '',
        dimension: dimName,
        charCount: r.content.length,
        score: r._score ?? 3,
        content: r.content,
      })
    }
  }

  // Sort: group by dimension, within group by score desc
  articles.sort((a, b) => {
    if (a.dimension !== b.dimension) return a.dimension.localeCompare(b.dimension)
    return b.score - a.score
  })

  // Re-index after sort
  articles.forEach((a, i) => { a.index = i })

  return articles
}

// ========== Types ==========

export interface DistillResult {
  identity: string
  style: string
  behaviors: { name: string; file: string }[]
  steps: number
  elapsedMs: number
  agentLog?: AgentLogger
}

export type DistillAgentProgress =
  | { type: 'phase'; phase: 'distilling' | 'complete' }
  | { type: 'tool_call'; tool: string; detail: string }
  | { type: 'tool_result'; tool: string; resultSummary: string }

export type OnDistillAgentProgress = (progress: DistillAgentProgress) => void

// ========== System Prompt ==========

function buildDistillPrompt(name: string, dataCount: number, tags?: TagSet, useArticleMode?: boolean, hasRelations?: boolean): string {
  let tagHints = ''
  if (tags) {
    const parts: string[] = []
    if (tags.personality.length > 0) parts.push(`Personality: ${tags.personality.join(', ')}`)
    if (tags.communication.length > 0) parts.push(`Communication: ${tags.communication.join(', ')}`)
    if (tags.values.length > 0) parts.push(`Values: ${tags.values.join(', ')}`)
    if (tags.behavior.length > 0) parts.push(`Behavior: ${tags.behavior.join(', ')}`)
    if (tags.domain.length > 0) parts.push(`Domain: ${tags.domain.join(', ')}`)
    if (parts.length > 0) tagHints = `\n\nTag hints from the user:\n${parts.join('\n')}`
  }

  const dataDescription = useArticleMode
    ? `You have ${dataCount} research articles about "${name}", organized by dimension.`
    : `You have ${dataCount} data fragments about "${name}".`

  const workflowGuide = useArticleMode
    ? `## Recommended Workflow

1. Call listArticles() to see all available articles across dimensions
2. Call listArticles with specific dimensions (identity, quotes, expression, thoughts, behavior, relations, capabilities, milestones) to focus on each area
3. Call readArticle for the most relevant articles in each dimension — read at least 2-3 per dimension before writing
4. writeIdentity based on identity/background articles
5. writeStyle referencing the identity you just wrote — MUST include a "Characteristic Expressions" section with preserved original quotes
6. writeCapabilities based on abilities/skills/equipment/expertise articles
7. writeMilestones based on timeline/events articles — use structured format with [time marker] entries
8. writeBehavior for each distinct behavior pattern (typically 3-6 files). Always create a "relationships" behavior if relation data exists.
9. writeExample to create conversation examples (at least 3: greeting, deep topic, conflict/sensitive topic)
10. reviewSoul to read back all files and check cross-file consistency
11. Rewrite any files if you find inconsistencies or gaps
12. finalize when satisfied with quality

**Important notes on articles:**
- Articles may be truncated (readArticle shows \`truncated: true\`). Focus on extracting key facts from available content.
- Prioritize high-quality articles (those listed first in each dimension are highest scored).
- You don't need to read every article — focus on the most informative ones per dimension.`
    : `## Recommended Workflow

1. Call sampleChunks() to get an overview of all available data
2. Call sampleChunks with specific dimensions (identity, quotes, expression, thoughts, behavior, relations, capabilities, milestones) to deep-dive
3. writeIdentity based on identity/background data
4. writeStyle referencing the identity you just wrote — MUST include a "Characteristic Expressions" section with preserved original quotes
5. writeCapabilities based on abilities/skills/equipment/expertise data
6. writeMilestones based on timeline/events data — use structured format with [time marker] entries
7. writeBehavior for each distinct behavior pattern (typically 3-6 files). Always create a "relationships" behavior if relation data exists.
8. writeExample to create conversation examples (at least 3: greeting, deep topic, conflict/sensitive topic)
9. reviewSoul to read back all files and check cross-file consistency
10. Rewrite any files if you find inconsistencies or gaps
11. finalize when satisfied with quality`

  const readRule = useArticleMode
    ? '- Always read relevant articles (listArticles → readArticle) before writing a dimension. Every claim in the output must trace back to an article you actually read in this session — do not fabricate content, do not use your model knowledge of the character'
    : '- Always call sampleChunks before writing a dimension. Every claim in the output must trace back to a chunk you actually sampled in this session — do not fabricate content, do not use your model knowledge of the character'

  return `You are a soul distiller. ${dataDescription}
Your job is to create soul profile files from this raw data.${tagHints}

## CRITICAL: Source-only rule (highest priority)

You may ONLY use information that you obtain through tool calls (sampleChunks / readArticle / listArticles) on the provided data.

**Absolutely forbidden**:
- Using your training-data knowledge about this character, the IP, the original work, fan canon, or any related media
- Adding facts (relationships, abilities, backstory, quotes) that don't appear in the source data
- Even if you "know" the canonical version of this character is different from what the source says, the source wins

If the source data is sparse, write a SHORTER profile rather than padding with invented or remembered content. A short, accurate profile is far better than a long profile poisoned with hallucinated details — downstream features (multi-soul export, Phase 2 runtime演绎) depend on the source-only invariant being intact.

## Output Files

- **identity.md** — Who they are: background, origin, role, history, key facts, timeline
- **style.md** — How they communicate: tone, vocabulary, rhetoric patterns, speech habits, formality level, humor style, characteristic expressions
- **capabilities.md** — What they can do: abilities, skills, stats, equipment, expertise.
  For fictional characters: power systems, attribute values, weapons, combat techniques, special abilities.
  For real people: professional skills, methodologies, key competencies, decision frameworks.
- **milestones.md** — What happened to them: structured timeline of key events.
  Each entry: [time marker] event description → impact on character state/growth.
  Events should be in chronological order with causal relationships noted.
- **behaviors/*.md** — How they think and act: each distinct behavior pattern gets its own file (e.g., honor-code.md, combat-style.md, leadership.md)

${workflowGuide}

You may adjust this order based on data availability. The key constraint:
**style must be consistent with identity, behaviors must be consistent with both.**

## Style Requirements

style.md MUST contain two sections:
1. **Analytical description** — tone, vocabulary, formality level, rhetoric patterns, humor style
2. **Characteristic Expressions** — a list of actual quotes, catchphrases, and typical dialogue lines preserved verbatim from the source data. These are critical for making the soul sound authentic.

Example structure:
\`\`\`
# Style
## Communication Patterns
(analytical description here)

## Characteristic Expressions
- 「問おう、あなたが私のマスターか」
- 「我以骑士之名起誓」
- (more direct quotes...)
\`\`\`

## Behavior Guidelines

${hasRelations
  ? `- **MANDATORY**: You MUST create a \`relationships\` behavior file. The research data contains relations dimension content — this file is REQUIRED for downstream multi-character export to work.
- The relationships file MUST be structured by character pairs:
  - Each related character gets its own \`## 与{角色名}的关系\` (or equivalent in source language) section
  - Each section MUST contain: relationship type (宿敌/君臣/同盟/师徒/夫妻/...), interaction patterns, emotional dynamics
  - Use the character's common name (便于跨 soul 交叉匹配)`
  : '- Create a **relationships** behavior file when relation data is available, describing key relationships and how the character\'s attitude changes with different people'}
- Each behavior file should focus on ONE distinct pattern (e.g., "honor-code", "combat-style", "leadership", "relationships")

## Example Guidelines

Generate at least 3 conversation examples using writeExample:
- **greeting** — How they introduce themselves or respond to a greeting
- **deep-topic** — Discussing their core beliefs, philosophy, or expertise
- **conflict** — Responding to a challenge, disagreement, or sensitive topic

Each example should have 2-4 dialogue turns showing natural back-and-forth.

## Rules

- IMPORTANT: Always use tools — do not generate plain text responses
${readRule}
- Each writeBehavior call creates a separate file — call it once per behavior
- Each writeExample call creates a separate example file
- Use reviewSoul at least once before finalizing
- Write in the same language as the majority of source data
- Preserve direct quotes and specific examples from the source data — they make the profile vivid
- Behavior file names should be descriptive kebab-case (e.g., "honor-code", "combat-style", "relationships")`
}

const MAX_STEPS = 25
const DOOM_LOOP_THRESHOLD = 3

// ========== Main Function ==========

export interface DistillSoulOptions {
  /** Web-search path: read data from dimension cache directory */
  sessionDir?: string
  /** Local source path: use SoulChunk[] directly */
  chunks?: SoulChunk[]
  tags?: TagSet
  onProgress?: OnDistillAgentProgress
  agentLog?: AgentLogger
}

export async function distillSoul(
  name: string,
  soulDir: string,
  config: SoulkillerConfig,
  options: DistillSoulOptions = {},
): Promise<DistillResult> {
  const { sessionDir, chunks, tags, onProgress, agentLog } = options

  if (!sessionDir && !chunks) {
    throw new Error('distillSoul requires either sessionDir or chunks')
  }

  const startTime = Date.now()
  const distillModel = config.llm.distill_model ?? config.llm.default_model

  // Build article index for sessionDir path
  const articleIndex = sessionDir ? buildArticleIndex(sessionDir) : undefined
  const dataCount = articleIndex ? articleIndex.length : chunks!.length
  // Detect whether relations dimension data is available — required for multi-soul export
  const hasRelations = articleIndex
    ? articleIndex.some((a) => a.dimension === 'relations' || a.dimension === 'relationships')
    : (chunks?.some((c) => {
        const dim = String(c.metadata?.extraction_step ?? '')
        return dim === 'relations' || dim === 'relationships'
      }) ?? false)
  const dataLabel = sessionDir ? `sessionDir(${dataCount} articles)` : `chunks(${dataCount})`
  logger.info('[distillSoul] Start:', { name, dataSource: dataLabel, model: distillModel, hasRelations })

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1',
  })
  const model = provider(withExacto(distillModel))
  const providerOpts = getProviderOptions(distillModel)

  // Ensure soul directory structure
  const soulPath = path.join(soulDir, 'soul')
  const behaviorsPath = path.join(soulPath, 'behaviors')
  const examplesPath = path.join(soulDir, 'examples')
  fs.mkdirSync(behaviorsPath, { recursive: true })
  fs.mkdirSync(examplesPath, { recursive: true })

  agentLog?.distillStart({ model: distillModel, totalChunks: dataCount, sampledChunks: dataCount })
  onProgress?.({ type: 'phase', phase: 'distilling' })

  // ========== Tool Definitions ==========

  const sampleChunksTool = tool({
    description: 'Read a sample of data fragments. Optionally filter by dimension (identity, quotes, expression, thoughts, behavior, relations, capabilities, milestones). Returns content, source, and dimension for each chunk.',
    inputSchema: z.object({
      dimension: z.string().optional().describe('Filter by dimension (extraction_step). Leave empty for all.'),
      limit: z.number().optional().describe('Max chunks to return (default 50, max 100)'),
    }),
    execute: async ({ dimension, limit }) => {
      const maxLimit = Math.min(limit ?? 50, 100)
      let filtered = chunks ?? []

      if (dimension) {
        const dimChunks = (chunks ?? []).filter((c) => c.metadata?.extraction_step === dimension)
        if (dimChunks.length > 0) {
          filtered = dimChunks
        }
        // fallback: if dimension not found, use all chunks
      }

      // Sample proportionally if too many
      let sampled = filtered
      if (filtered.length > maxLimit) {
        const shuffled = [...filtered].sort(() => Math.random() - 0.5)
        sampled = shuffled.slice(0, maxLimit)
      }

      return {
        total: filtered.length,
        returned: sampled.length,
        chunks: sampled.map((c) => ({
          content: c.content,
          source: c.source,
          dimension: String(c.metadata?.extraction_step ?? 'unknown'),
        })),
      }
    },
  })

  const writeIdentityTool = tool({
    description: 'Write the identity.md file. Contains who they are: background, origin, role, history.',
    inputSchema: z.object({
      content: z.string().describe('The identity profile content in markdown'),
    }),
    execute: async ({ content }) => {
      fs.writeFileSync(path.join(soulPath, 'identity.md'), `# Identity\n\n${content}\n`)
      return { chars: content.length }
    },
  })

  const writeStyleTool = tool({
    description: 'Write the style.md file. Contains how they communicate: tone, vocabulary, rhetoric, speech patterns.',
    inputSchema: z.object({
      content: z.string().describe('The communication style profile in markdown'),
    }),
    execute: async ({ content }) => {
      fs.writeFileSync(path.join(soulPath, 'style.md'), `# Style\n\n${content}\n`)
      return { chars: content.length }
    },
  })

  const writeBehaviorTool = tool({
    description: 'Write a single behavior file. Call once per distinct behavior pattern. Name should be descriptive kebab-case.',
    inputSchema: z.object({
      name: z.string().describe('Behavior name in kebab-case (e.g., "honor-code", "combat-style")'),
      content: z.string().describe('The behavior description in markdown'),
    }),
    execute: async ({ name: behaviorName, content }) => {
      const slug = behaviorName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      const filePath = path.join(behaviorsPath, `${slug}.md`)
      fs.writeFileSync(filePath, `${content}\n`)
      return { file: `behaviors/${slug}.md`, chars: content.length }
    },
  })

  const writeCapabilitiesTool = tool({
    description: 'Write the capabilities.md file. Contains what they can do: abilities, skills, stats, equipment, expertise.',
    inputSchema: z.object({
      content: z.string().describe('The capabilities profile content in markdown'),
    }),
    execute: async ({ content }) => {
      fs.writeFileSync(path.join(soulPath, 'capabilities.md'), `# Capabilities\n\n${content}\n`)
      return { chars: content.length }
    },
  })

  const writeMilestonesTool = tool({
    description: 'Write the milestones.md file. Contains structured timeline of key events. Use format: ## [time marker] event title, then description and → impact.',
    inputSchema: z.object({
      content: z.string().describe('The milestones timeline content in markdown'),
    }),
    execute: async ({ content }) => {
      fs.writeFileSync(path.join(soulPath, 'milestones.md'), `# Milestones\n\n${content}\n`)
      return { chars: content.length }
    },
  })

  const writeExampleTool = tool({
    description: 'Write a conversation example file. Creates a sample dialogue showing how the character would respond. Generate at least 3 examples covering: greeting, deep topic, and conflict/sensitive topic.',
    inputSchema: z.object({
      scenario: z.string().describe('Scenario name in kebab-case (e.g., "greeting", "philosophy", "conflict")'),
      messages: z.array(z.object({
        role: z.enum(['user', 'character']).describe('Who is speaking'),
        content: z.string().describe('What they say'),
      })).describe('The conversation exchange'),
    }),
    execute: async ({ scenario, messages }) => {
      const slug = scenario.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      const lines = messages.map((m) =>
        m.role === 'user' ? `> User: ${m.content}` : `${name}: ${m.content}`
      )
      const content = `# ${scenario}\n\n${lines.join('\n\n')}\n`
      fs.writeFileSync(path.join(examplesPath, `${slug}.md`), content)
      return { file: `examples/${slug}.md`, turns: messages.length }
    },
  })

  const reviewSoulTool = tool({
    description: 'Read back all written soul files AND example files for self-inspection. Use to check consistency before finalizing.',
    inputSchema: z.object({}),
    execute: async () => {
      const identity = fs.existsSync(path.join(soulPath, 'identity.md'))
        ? fs.readFileSync(path.join(soulPath, 'identity.md'), 'utf-8')
        : ''
      const style = fs.existsSync(path.join(soulPath, 'style.md'))
        ? fs.readFileSync(path.join(soulPath, 'style.md'), 'utf-8')
        : ''

      const behaviors: { name: string; content: string }[] = []
      if (fs.existsSync(behaviorsPath)) {
        for (const file of fs.readdirSync(behaviorsPath)) {
          if (file.endsWith('.md')) {
            behaviors.push({
              name: file.replace('.md', ''),
              content: fs.readFileSync(path.join(behaviorsPath, file), 'utf-8'),
            })
          }
        }
      }

      const examples: { scenario: string; content: string }[] = []
      if (fs.existsSync(examplesPath)) {
        for (const file of fs.readdirSync(examplesPath)) {
          if (file.endsWith('.md')) {
            examples.push({
              scenario: file.replace('.md', ''),
              content: fs.readFileSync(path.join(examplesPath, file), 'utf-8').slice(0, 500),
            })
          }
        }
      }

      const capabilities = fs.existsSync(path.join(soulPath, 'capabilities.md'))
        ? fs.readFileSync(path.join(soulPath, 'capabilities.md'), 'utf-8')
        : ''
      const milestones = fs.existsSync(path.join(soulPath, 'milestones.md'))
        ? fs.readFileSync(path.join(soulPath, 'milestones.md'), 'utf-8')
        : ''

      const fileCount = (identity ? 1 : 0) + (style ? 1 : 0) + (capabilities ? 1 : 0) + (milestones ? 1 : 0) + behaviors.length + examples.length

      return {
        identity: identity.slice(0, 2000),
        style: style.slice(0, 2000),
        capabilities: capabilities.slice(0, 2000),
        milestones: milestones.slice(0, 2000),
        behaviors: behaviors.map((b) => ({ name: b.name, content: b.content.slice(0, 1000) })),
        examples,
        fileCount,
      }
    },
  })

  const finalizeTool = tool({
    description: 'End the distillation and report completion. Call after reviewSoul confirms quality.',
    inputSchema: z.object({
      summary: z.string().describe('Brief summary of what was created'),
    }),
    // No execute — stopWhen triggers
  })

  // ========== sessionDir Tools: listArticles + readArticle ==========

  const READ_ARTICLE_MAX_CHARS = 8000

  const listArticlesTool = tool({
    description: 'List available articles from the research data. Optionally filter by dimension. Returns a lightweight index with title, URL, dimension, character count, and a short preview. Use this to browse what data is available before reading specific articles.',
    inputSchema: z.object({
      dimension: z.string().optional().describe('Filter by dimension name (e.g., "identity", "quotes"). Leave empty for all dimensions.'),
    }),
    execute: async ({ dimension }) => {
      if (!articleIndex) return { error: 'No article index available', articles: [] }

      const filtered = dimension
        ? articleIndex.filter((a) => a.dimension === dimension)
        : articleIndex

      return {
        total: filtered.length,
        articles: filtered.map((a) => ({
          index: a.index,
          title: a.title,
          url: a.url,
          dimension: a.dimension,
          charCount: a.charCount,
          preview: a.content.slice(0, 200).replace(/\n/g, ' '),
        })),
      }
    },
  })

  const readArticleTool = tool({
    description: 'Read the full content of a specific article by its index. Content may be truncated for very long articles. Use listArticles first to find relevant article indices.',
    inputSchema: z.object({
      index: z.number().describe('Article index from listArticles'),
    }),
    execute: async ({ index: idx }) => {
      if (!articleIndex || idx < 0 || idx >= articleIndex.length) {
        return { error: `Article index out of range (valid: 0-${(articleIndex?.length ?? 1) - 1})` }
      }

      const article = articleIndex[idx]!
      const truncated = article.charCount > READ_ARTICLE_MAX_CHARS
      const content = truncated
        ? article.content.slice(0, READ_ARTICLE_MAX_CHARS) + '\n\n[... article truncated ...]'
        : article.content

      return {
        title: article.title,
        url: article.url,
        dimension: article.dimension,
        charCount: article.charCount,
        truncated,
        content,
      }
    },
  })

  // ========== Tool routing based on data source ==========

  const writeTools = {
    writeIdentity: writeIdentityTool,
    writeStyle: writeStyleTool,
    writeCapabilities: writeCapabilitiesTool,
    writeMilestones: writeMilestonesTool,
    writeBehavior: writeBehaviorTool,
    writeExample: writeExampleTool,
    reviewSoul: reviewSoulTool,
    finalize: finalizeTool,
  }

  const tools = articleIndex
    ? { listArticles: listArticlesTool, readArticle: readArticleTool, ...writeTools }
    : { sampleChunks: sampleChunksTool, ...writeTools }

  // ========== Agent ==========

  const agent = new ToolLoopAgent({
    model,
    instructions: buildDistillPrompt(name, dataCount, tags, !!articleIndex, hasRelations),
    tools,
    toolChoice: 'auto',
    temperature: 0.3,
    providerOptions: providerOpts,
    stopWhen: [
      stepCountIs(MAX_STEPS),
      hasToolCall('finalize'),
    ],
    prepareStep: async ({ stepNumber, steps }) => {
      // Enforce relationships.md when relations data is available
      if (hasRelations) {
        const relationshipsPath = path.join(behaviorsPath, 'relationships.md')
        const relationshipsExists = fs.existsSync(relationshipsPath)
        const lastTool = steps[steps.length - 1]?.toolCalls?.[0]?.toolName
        const aboutToFinalize = lastTool === 'finalize' || stepNumber >= MAX_STEPS - 2

        if (!relationshipsExists && aboutToFinalize) {
          logger.warn('[distillSoul] hasRelations=true but relationships.md missing, forcing writeBehavior')
          return { toolChoice: { type: 'tool' as const, toolName: 'writeBehavior' as const } }
        }
      }

      if (stepNumber >= MAX_STEPS - 1) {
        logger.info('[distillSoul] Last step, forcing finalize')
        return { toolChoice: { type: 'tool' as const, toolName: 'finalize' as const } }
      }

      if (steps.length >= DOOM_LOOP_THRESHOLD) {
        const recent = steps.slice(-DOOM_LOOP_THRESHOLD)
        const calls = recent
          .map((s) => s.toolCalls?.[0])
          .filter((c): c is NonNullable<typeof c> => c != null)

        if (calls.length === DOOM_LOOP_THRESHOLD) {
          const first = calls[0]!
          const allSame = calls.every(
            (c) => c.toolName === first.toolName && JSON.stringify(c.input) === JSON.stringify(first.input),
          )
          if (allSame) {
            logger.warn('[distillSoul] Doom loop detected, forcing finalize')
            return { toolChoice: { type: 'tool' as const, toolName: 'finalize' as const } }
          }
        }
      }

      return {}
    },
  })

  // ========== Stream Processing ==========

  const userMessage = articleIndex
    ? `Distill the soul of "${name}" from the research articles. Begin by listing articles to see what data is available.`
    : `Distill the soul of "${name}" from the provided data fragments. Begin by sampling the data.`

  logger.info('[distillSoul] Running ToolLoopAgent (streaming)...')
  const streamResult = await agent.stream({ prompt: userMessage })

  let stepCount = 0
  const toolCallTimers = new Map<string, number>()

  for await (const event of streamResult.fullStream) {
    if (event.type === 'start-step') {
      stepCount++
      agentLog?.startStep(stepCount, 'distilling')
    } else if (event.type === 'text-delta') {
      agentLog?.modelOutput(event.text)
    } else if (event.type === 'tool-call') {
      toolCallTimers.set(event.toolName, Date.now())
      agentLog?.toolCall(event.toolName, event.input)

      const detail = summarizeToolCallInput(event.toolName, event.input)
      onProgress?.({ type: 'tool_call', tool: event.toolName, detail })
    } else if (event.type === 'tool-result') {
      const start = toolCallTimers.get(event.toolName) ?? Date.now()
      const durationMs = Date.now() - start
      agentLog?.toolResult(event.toolName, event.output, durationMs)

      const summary = summarizeToolResult(event.toolName, event.output)
      onProgress?.({ type: 'tool_result', tool: event.toolName, resultSummary: summary })
    }
  }

  logger.info('[distillSoul] Stream finished. Steps:', stepCount)

  // ========== Read Final State ==========

  const identity = fs.existsSync(path.join(soulPath, 'identity.md'))
    ? fs.readFileSync(path.join(soulPath, 'identity.md'), 'utf-8')
    : ''
  const style = fs.existsSync(path.join(soulPath, 'style.md'))
    ? fs.readFileSync(path.join(soulPath, 'style.md'), 'utf-8')
    : ''

  const behaviors: { name: string; file: string }[] = []
  if (fs.existsSync(behaviorsPath)) {
    for (const file of fs.readdirSync(behaviorsPath)) {
      if (file.endsWith('.md')) {
        behaviors.push({ name: file.replace('.md', ''), file: `behaviors/${file}` })
      }
    }
  }

  const elapsedMs = Date.now() - startTime

  agentLog?.distillEnd({
    identity: identity.length,
    style: style.length,
    behaviors: behaviors.length,
    totalDurationMs: elapsedMs,
  })

  onProgress?.({ type: 'phase', phase: 'complete' })

  logger.info('[distillSoul] Complete:', {
    identityChars: identity.length,
    styleChars: style.length,
    behaviorFiles: behaviors.length,
    steps: stepCount,
    elapsedMs,
  })

  return { identity, style, behaviors, steps: stepCount, elapsedMs, agentLog }
}

// ========== Helpers ==========

function summarizeToolCallInput(toolName: string, input: unknown): string {
  if (toolName === 'sampleChunks') {
    const { dimension, limit } = input as { dimension?: string; limit?: number }
    return dimension ? `${dimension}, limit ${limit ?? 50}` : `all, limit ${limit ?? 50}`
  }
  if (toolName === 'writeBehavior') {
    return (input as { name?: string })?.name ?? ''
  }
  if (toolName === 'writeExample') {
    return (input as { scenario?: string })?.scenario ?? ''
  }
  if (toolName === 'finalize') {
    return 'completing...'
  }
  return ''
}

function summarizeToolResult(toolName: string, output: unknown): string {
  if (toolName === 'sampleChunks') {
    const { returned, total } = output as { returned?: number; total?: number }
    return `${returned ?? 0}/${total ?? 0} chunks`
  }
  if (toolName === 'writeIdentity' || toolName === 'writeStyle' || toolName === 'writeCapabilities' || toolName === 'writeMilestones') {
    const { chars } = output as { chars?: number }
    return `${chars ?? 0} chars`
  }
  if (toolName === 'writeBehavior') {
    const { file, chars } = output as { file?: string; chars?: number }
    return `${file} (${chars ?? 0} chars)`
  }
  if (toolName === 'writeExample') {
    const { file, turns } = output as { file?: string; turns?: number }
    return `${file} (${turns ?? 0} turns)`
  }
  if (toolName === 'reviewSoul') {
    const { fileCount } = output as { fileCount?: number }
    return `${fileCount ?? 0} files`
  }
  return ''
}
