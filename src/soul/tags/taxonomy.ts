import { t } from '../../infra/i18n/index.js'

export type TagCategory = 'personality' | 'communication' | 'values' | 'behavior' | 'domain'

export interface TagSet {
  personality: string[]
  communication: string[]
  values: string[]
  behavior: string[]
  domain: string[]
}

export function emptyTagSet(): TagSet {
  return {
    personality: [],
    communication: [],
    values: [],
    behavior: [],
    domain: [],
  }
}

/**
 * Predefined anchor tags per category.
 * Used as reference points for LLM parsing — not an exhaustive list.
 * Returns localized anchors based on current language.
 */
export function getTagAnchors(): Record<TagCategory, string[]> {
  return {
    personality: t('tags.anchors.personality').split(',').map(s => s.trim()),
    communication: t('tags.anchors.communication').split(',').map(s => s.trim()),
    values: t('tags.anchors.values').split(',').map(s => s.trim()),
    behavior: t('tags.anchors.behavior').split(',').map(s => s.trim()),
    domain: t('tags.anchors.domain').split(',').map(s => s.trim()),
  }
}

