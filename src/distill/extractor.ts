import type OpenAI from 'openai'
import type { SoulChunk } from '../ingest/types.js'
import type { TagSet } from '../tags/taxonomy.js'
import type { AgentLogger } from '../utils/agent-logger.js'
import { t } from '../i18n/index.js'

function formatTagHints(tags?: TagSet): string {
  if (!tags) return ''
  const sep = t('synthetic.tag.separator')
  const parts: string[] = []
  if (tags.personality.length > 0) parts.push(`${t('synthetic.tag.personality')}${tags.personality.join(sep)}`)
  if (tags.communication.length > 0) parts.push(`${t('synthetic.tag.communication')}${tags.communication.join(sep)}`)
  if (tags.values.length > 0) parts.push(`${t('synthetic.tag.values')}${tags.values.join(sep)}`)
  if (tags.behavior.length > 0) parts.push(`${t('synthetic.tag.behavior')}${tags.behavior.join(sep)}`)
  if (tags.domain.length > 0) parts.push(`${t('synthetic.tag.domain')}${tags.domain.join(sep)}`)
  if (parts.length === 0) return ''
  return `\n\n${t('extractor.tag_hints_header')}\n${parts.join('\n')}`
}

function makeIdentityPrompt(name: string, tags?: TagSet) {
  return t('extractor.identity_prompt', { name }) + formatTagHints(tags)
}

function makeStylePrompt(name: string, tags?: TagSet) {
  return t('extractor.style_prompt', { name }) + formatTagHints(tags)
}

function makeBehaviorPrompt(name: string) {
  return t('extractor.behavior_prompt', { name })
}

const BATCH_SIZE = 30

export type DistillDimension = 'identity' | 'style' | 'behaviors'
export type DistillPhase = 'identity' | 'style' | 'behavior' | 'merge' | 'generate'

export interface DistillProgress {
  phase: DistillPhase
  status: 'started' | 'in_progress' | 'done'
  batch?: number
  totalBatches?: number
}

export type OnDistillProgress = (progress: DistillProgress) => void

export interface ExtractedFeatures {
  identity: string
  style: string
  behaviors: { name: string; content: string }[]
}

export async function extractFeatures(
  client: OpenAI,
  model: string,
  chunks: SoulChunk[],
  targetName = '',
  tags?: TagSet,
  onProgress?: OnDistillProgress,
  dimensions?: DistillDimension[],
  agentLog?: AgentLogger,
): Promise<ExtractedFeatures> {
  const name = targetName || t('extractor.default_name')
  const dims = dimensions ?? ['identity', 'style', 'behaviors']

  // Split chunks into batches for context window management
  const batches: SoulChunk[][] = []
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE))
  }

  const totalBatches = batches.length
  let identity = ''
  let style = ''
  let behaviors: { name: string; content: string }[] = []

  // Extract identity
  if (dims.includes('identity')) {
    onProgress?.({ phase: 'identity', status: 'started' })
    agentLog?.distillPhase('identity', 'started', `${totalBatches} batches`)
    const identityResults: string[] = []
    for (let bi = 0; bi < batches.length; bi++) {
      if (totalBatches > 1) {
        onProgress?.({ phase: 'identity', status: 'in_progress', batch: bi + 1, totalBatches })
      }
      const batchStart = Date.now()
      const content = batches[bi]!.map((c) => `[${c.source}] ${c.content}`).join('\n\n---\n\n')
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: makeIdentityPrompt(name, tags) },
          { role: 'user', content },
        ],
      })
      const output = res.choices[0]?.message?.content ?? ''
      identityResults.push(output)
      agentLog?.distillBatch('identity', bi + 1, totalBatches, Date.now() - batchStart, output.length)
    }
    onProgress?.({ phase: 'identity', status: 'done' })
    const mergeStart = Date.now()
    identity = await mergeResults(client, model, identityResults, 'identity')
    if (identityResults.length > 1) {
      agentLog?.distillMerge('identity', identityResults.length, Date.now() - mergeStart, identity.length)
    }
    agentLog?.distillPhase('identity', 'done')
  }

  // Extract style
  if (dims.includes('style')) {
    onProgress?.({ phase: 'style', status: 'started' })
    agentLog?.distillPhase('style', 'started', `${totalBatches} batches`)
    const styleResults: string[] = []
    for (let bi = 0; bi < batches.length; bi++) {
      if (totalBatches > 1) {
        onProgress?.({ phase: 'style', status: 'in_progress', batch: bi + 1, totalBatches })
      }
      const batchStart = Date.now()
      const content = batches[bi]!.map((c) => `[${c.source}] ${c.content}`).join('\n\n---\n\n')
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: makeStylePrompt(name, tags) },
          { role: 'user', content },
        ],
      })
      const output = res.choices[0]?.message?.content ?? ''
      styleResults.push(output)
      agentLog?.distillBatch('style', bi + 1, totalBatches, Date.now() - batchStart, output.length)
    }
    onProgress?.({ phase: 'style', status: 'done' })
    const mergeStart = Date.now()
    style = await mergeResults(client, model, styleResults, 'style')
    if (styleResults.length > 1) {
      agentLog?.distillMerge('style', styleResults.length, Date.now() - mergeStart, style.length)
    }
    agentLog?.distillPhase('style', 'done')
  }

  // Extract behaviors
  if (dims.includes('behaviors')) {
    onProgress?.({ phase: 'behavior', status: 'started' })
    agentLog?.distillPhase('behavior', 'started', `${totalBatches} batches`)
    const behaviorResults: string[] = []
    for (let bi = 0; bi < batches.length; bi++) {
      if (totalBatches > 1) {
        onProgress?.({ phase: 'behavior', status: 'in_progress', batch: bi + 1, totalBatches })
      }
      const batchStart = Date.now()
      const content = batches[bi]!.map((c) => `[${c.source}] ${c.content}`).join('\n\n---\n\n')
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: makeBehaviorPrompt(name) },
          { role: 'user', content },
        ],
      })
      const output = res.choices[0]?.message?.content ?? ''
      behaviorResults.push(output)
      agentLog?.distillBatch('behavior', bi + 1, totalBatches, Date.now() - batchStart, output.length)
    }
    onProgress?.({ phase: 'behavior', status: 'done' })
    behaviors = parseBehaviors(behaviorResults.join('\n\n---\n\n'))
    agentLog?.distillPhase('behavior', 'done')
  }

  // Merge phase notification
  onProgress?.({ phase: 'merge', status: 'started' })
  onProgress?.({ phase: 'merge', status: 'done' })

  return { identity, style, behaviors }
}

async function mergeResults(
  client: OpenAI,
  model: string,
  results: string[],
  type: string,
): Promise<string> {
  if (results.length === 1) return results[0]!

  const mergePrompt = t(type === 'identity' ? 'extractor.merge_identity_prompt' : 'extractor.merge_style_prompt')

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: mergePrompt },
      { role: 'user', content: results.join('\n\n===BATCH SEPARATOR===\n\n') },
    ],
  })

  return res.choices[0]?.message?.content ?? results[0]!
}

function parseBehaviors(raw: string): { name: string; content: string }[] {
  const sections = raw.split('---').filter((s) => s.trim())
  const behaviors: { name: string; content: string }[] = []

  for (const section of sections) {
    const trimmed = section.trim()
    // Extract the first heading as the behavior name
    const headingMatch = trimmed.match(/^#+\s*(.+)/m)
    const name = headingMatch
      ? headingMatch[1]!.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      : `behavior-${behaviors.length + 1}`
    behaviors.push({ name, content: trimmed })
  }

  return behaviors
}
