import { createHash } from 'node:crypto'
import type { SoulChunk, SourceType } from './types.js'
import type { TagSet } from '../../tags/taxonomy.js'
import { t } from '../../i18n/index.js'

/**
 * Convert user description into a SoulChunk.
 */
export function descriptionToChunk(description: string, soulName: string): SoulChunk {
  return {
    id: createHash('sha256').update(`user-input:description:${soulName}`).digest('hex').slice(0, 16),
    source: 'user-input' as SourceType,
    content: t('synthetic.description', { name: soulName, description }),
    timestamp: new Date().toISOString(),
    context: 'personal',
    type: 'knowledge',
    metadata: { origin: 'user-description' },
  }
}

/**
 * Convert parsed TagSet into a SoulChunk.
 */
export function tagsToChunk(tags: TagSet, soulName: string): SoulChunk {
  const parts: string[] = []
  if (tags.personality.length > 0) parts.push(`${t('synthetic.tag.personality')}${tags.personality.join(t('synthetic.tag.separator'))}`)
  if (tags.communication.length > 0) parts.push(`${t('synthetic.tag.communication')}${tags.communication.join(t('synthetic.tag.separator'))}`)
  if (tags.values.length > 0) parts.push(`${t('synthetic.tag.values')}${tags.values.join(t('synthetic.tag.separator'))}`)
  if (tags.behavior.length > 0) parts.push(`${t('synthetic.tag.behavior')}${tags.behavior.join(t('synthetic.tag.separator'))}`)
  if (tags.domain.length > 0) parts.push(`${t('synthetic.tag.domain')}${tags.domain.join(t('synthetic.tag.separator'))}`)

  return {
    id: createHash('sha256').update(`user-input:tags:${soulName}`).digest('hex').slice(0, 16),
    source: 'user-input' as SourceType,
    content: t('synthetic.personality_portrait', { name: soulName, parts: parts.join('\n') }),
    timestamp: new Date().toISOString(),
    context: 'personal',
    type: 'reflection',
    metadata: { origin: 'user-tags', tags },
  }
}

/**
 * Generate synthetic chunks from intake data (description + tags).
 * Returns 0-2 chunks depending on what was provided.
 */
export function createSyntheticChunks(
  soulName: string,
  description?: string,
  tags?: TagSet,
): SoulChunk[] {
  const chunks: SoulChunk[] = []

  if (description?.trim()) {
    chunks.push(descriptionToChunk(description.trim(), soulName))
  }

  if (tags && Object.values(tags).some((arr) => arr.length > 0)) {
    chunks.push(tagsToChunk(tags, soulName))
  }

  return chunks
}
