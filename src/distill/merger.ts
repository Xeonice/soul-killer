import { generateText, type LanguageModel } from 'ai'
import type { ExtractedFeatures } from './extractor.js'
import type { TagSet } from '../tags/taxonomy.js'
import { t } from '../i18n/index.js'

function formatTagContext(tags?: TagSet): string {
  if (!tags) return ''
  const sep = t('synthetic.tag.separator')
  const parts: string[] = []
  if (tags.personality.length > 0) parts.push(`${t('merger.tag.personality')}${tags.personality.join(sep)}`)
  if (tags.communication.length > 0) parts.push(`${t('merger.tag.communication')}${tags.communication.join(sep)}`)
  if (parts.length === 0) return ''
  return `\n${t('merger.tag_reference')}${parts.join(t('merger.tag.join'))}`
}

function makeMergePrompt(dimension: 'identity' | 'style', soulName: string, tags?: TagSet): string {
  const key = dimension === 'identity' ? 'merger.identity_prompt' : 'merger.style_prompt'
  return t(key, { name: soulName }) + formatTagContext(tags)
}

function makeBehaviorMergePrompt(soulName: string, behaviorName: string): string {
  return t('merger.behavior_prompt', { name: soulName, behavior: behaviorName })
}

export interface MergeInput {
  existingIdentity?: string
  existingStyle?: string
  existingBehaviors?: Record<string, string> // name → content
}

/**
 * Merge delta features with existing soul files using LLM.
 */
export async function mergeSoulFiles(
  model: LanguageModel,
  existing: MergeInput,
  delta: ExtractedFeatures,
  soulName: string,
  tags?: TagSet,
): Promise<ExtractedFeatures> {
  const result: ExtractedFeatures = {
    identity: '',
    style: '',
    behaviors: [],
  }

  // Merge identity
  if (delta.identity) {
    if (existing.existingIdentity) {
      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: makeMergePrompt('identity', soulName, tags) },
          { role: 'user', content: `## ${t('merger.existing_file')}\n\n${existing.existingIdentity}\n\n## ${t('merger.new_delta')}\n\n${delta.identity}` },
        ],
      })
      result.identity = text || delta.identity
    } else {
      result.identity = delta.identity
    }
  }

  // Merge style
  if (delta.style) {
    if (existing.existingStyle) {
      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: makeMergePrompt('style', soulName, tags) },
          { role: 'user', content: `## ${t('merger.existing_file')}\n\n${existing.existingStyle}\n\n## ${t('merger.new_delta')}\n\n${delta.style}` },
        ],
      })
      result.style = text || delta.style
    } else {
      result.style = delta.style
    }
  }

  // Merge behaviors
  const existingBehaviors = existing.existingBehaviors ?? {}
  for (const deltaBehavior of delta.behaviors) {
    const existingContent = existingBehaviors[deltaBehavior.name]
    if (existingContent) {
      // Merge with existing behavior
      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: makeBehaviorMergePrompt(soulName, deltaBehavior.name) },
          { role: 'user', content: `## ${t('merger.existing_behavior')}\n\n${existingContent}\n\n## ${t('merger.new_behavior')}\n\n${deltaBehavior.content}` },
        ],
      })
      result.behaviors.push({
        name: deltaBehavior.name,
        content: text || deltaBehavior.content,
      })
    } else {
      // New behavior category — use as-is
      result.behaviors.push(deltaBehavior)
    }
  }

  // Preserve existing behaviors not in delta
  for (const [name, content] of Object.entries(existingBehaviors)) {
    if (!delta.behaviors.some((b) => b.name === name)) {
      result.behaviors.push({ name, content })
    }
  }

  return result
}
