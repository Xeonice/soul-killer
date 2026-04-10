import { generateText, type LanguageModel } from 'ai'
import { t } from '../../infra/i18n/index.js'

export type WorldTagCategory = 'genre' | 'tone' | 'scale' | 'era' | 'theme'

export interface WorldTagSet {
  genre: string[]
  tone: string[]
  scale: string[]
  era: string[]
  theme: string[]
}

export function emptyWorldTagSet(): WorldTagSet {
  return {
    genre: [],
    tone: [],
    scale: [],
    era: [],
    theme: [],
  }
}

/**
 * Predefined anchor tags per world category.
 * Used as reference points for LLM parsing — not an exhaustive list.
 * Returns localized anchors based on current language.
 */
export function getWorldTagAnchors(): Record<WorldTagCategory, string[]> {
  return {
    genre: t('world.tags.anchors.genre').split(',').map(s => s.trim()),
    tone: t('world.tags.anchors.tone').split(',').map(s => s.trim()),
    scale: t('world.tags.anchors.scale').split(',').map(s => s.trim()),
    era: t('world.tags.anchors.era').split(',').map(s => s.trim()),
    theme: t('world.tags.anchors.theme').split(',').map(s => s.trim()),
  }
}

const ALL_WORLD_TAG_CATEGORIES: WorldTagCategory[] = ['genre', 'tone', 'scale', 'era', 'theme']

function buildWorldParsePrompt(): string {
  const anchors = getWorldTagAnchors()
  return t('world.tags.parse_prompt', {
    genre_anchors: anchors.genre.join(', '),
    tone_anchors: anchors.tone.join(', '),
    scale_anchors: anchors.scale.join(', '),
    era_anchors: anchors.era.join(', '),
    theme_anchors: anchors.theme.join(', '),
  })
}

export async function parseWorldTags(
  input: string,
  model: LanguageModel,
): Promise<WorldTagSet> {
  if (!input.trim()) return emptyWorldTagSet()

  try {
    const { text: content } = await generateText({
      model,
      messages: [
        { role: 'system', content: buildWorldParsePrompt() },
        { role: 'user', content: input },
      ],
      temperature: 0,
    })
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return emptyWorldTagSet()

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const tags = emptyWorldTagSet()

    for (const category of ALL_WORLD_TAG_CATEGORIES) {
      const val = parsed[category]
      if (Array.isArray(val)) {
        tags[category] = val.filter((v): v is string => typeof v === 'string')
      }
    }

    return tags
  } catch {
    return emptyWorldTagSet()
  }
}
