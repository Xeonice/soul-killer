import type OpenAI from 'openai'
import { type TagSet, type TagCategory, getTagAnchors, emptyTagSet } from './taxonomy.js'
import { t } from '../i18n/index.js'

function buildParsePrompt(): string {
  const anchors = getTagAnchors()
  return t('tags.parse_prompt', {
    personality_anchors: anchors.personality.join(', '),
    communication_anchors: anchors.communication.join(', '),
    values_anchors: anchors.values.join(', '),
    behavior_anchors: anchors.behavior.join(', '),
    domain_anchors: anchors.domain.join(', '),
  })
}

export async function parseTags(
  input: string,
  client: OpenAI,
  model: string,
): Promise<TagSet> {
  if (!input.trim()) return emptyTagSet()

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildParsePrompt() },
        { role: 'user', content: input },
      ],
      temperature: 0,
    })

    const content = res.choices[0]?.message?.content ?? ''
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return emptyTagSet()

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const tags = emptyTagSet()

    for (const category of Object.keys(tags) as TagCategory[]) {
      const val = parsed[category]
      if (Array.isArray(val)) {
        tags[category] = val.filter((v): v is string => typeof v === 'string')
      }
    }

    return tags
  } catch {
    return emptyTagSet()
  }
}
