/**
 * Prose style anchor — entry point for the story-level narrative style system.
 *
 * This module exports:
 * 1. Chinese translatese anti-pattern library (ZH_TRANSLATESE_PATTERNS)
 * 2. Japanese translatese anti-pattern library (JA_TRANSLATESE_PATTERNS)
 * 3. ProseStyleForbiddenPattern type
 * 4. Language-aware helper functions for rendering pattern libraries
 *
 * Consumers:
 * - `src/export/agent/` — set_prose_style tool description uses
 *   `formatPatternsForToolDescription()` to dynamically inline the library
 * - `src/export/spec/story-spec.ts` — formatProseStyleSection uses the library
 *   as a fallback rendering source
 * - `src/export/spec/skill-template.ts` — SKILL.md fallback branch inlines
 *   top 5 most frequent anti-patterns
 */

import type { SupportedLanguage } from '../../config/schema.js'

export {
  ZH_TRANSLATESE_PATTERNS,
  type ProseStyleForbiddenPattern,
} from './zh-translatese-patterns.js'

export {
  JA_TRANSLATESE_PATTERNS,
  type JaProseStyleForbiddenPattern,
} from './ja-translatese-patterns.js'

import {
  ZH_TRANSLATESE_PATTERNS,
  type ProseStyleForbiddenPattern,
} from './zh-translatese-patterns.js'

import {
  JA_TRANSLATESE_PATTERNS,
  type JaProseStyleForbiddenPattern,
} from './ja-translatese-patterns.js'

/**
 * Render the anti-pattern library as LLM-readable text for tool descriptions.
 *
 * When language is 'zh', uses Chinese patterns with Chinese labels.
 * When language is 'ja', uses Japanese patterns with Japanese labels.
 * When language is 'en', returns English-only prose guidance (no anti-translatese needed).
 *
 * If no language is specified, defaults to Chinese patterns (backward compat).
 */
export function formatPatternsForToolDescription(
  patternsOrLang?: ProseStyleForbiddenPattern[] | SupportedLanguage,
): string {
  // Backward compat: if called with an array, use it directly (Chinese format)
  if (Array.isArray(patternsOrLang)) {
    return formatZhPatterns(patternsOrLang)
  }

  const lang = patternsOrLang
  if (lang === 'ja') {
    return formatJaPatterns(JA_TRANSLATESE_PATTERNS)
  }
  if (lang === 'en') {
    return formatEnGuidance()
  }
  // Default: zh
  return formatZhPatterns(ZH_TRANSLATESE_PATTERNS)
}

function formatZhPatterns(patterns: ProseStyleForbiddenPattern[]): string {
  return patterns
    .map(
      (p) =>
        `[id: ${p.id}]\n` +
        `  ✗ Bad: ${p.bad}\n` +
        `  ✓ Good: ${p.good}\n` +
        `  Reason: ${p.reason}`,
    )
    .join('\n\n')
}

function formatJaPatterns(patterns: JaProseStyleForbiddenPattern[]): string {
  return patterns
    .map(
      (p) =>
        `[id: ${p.id}]\n` +
        `  ✗ Bad: ${p.bad}\n` +
        `  ✓ Good: ${p.good}\n` +
        `  Reason: ${p.reason}`,
    )
    .join('\n\n')
}

function formatEnGuidance(): string {
  return `English is the LLM's native language — no anti-translatese patterns are needed.

Focus on natural, fluent English prose:
- Vary sentence length and structure
- Use active voice by default
- Avoid purple prose and overwrought descriptions
- Let dialogue carry character voice naturally
- Use concrete sensory details over abstract emotional statements`
}

/**
 * Return the top N most frequent anti-pattern entries for SKILL.md fallback.
 * Default 5 entries. The library is ordered by frequency (high to low).
 *
 * When language is specified, returns patterns for that language.
 * For English, returns an empty array (no anti-translatese needed).
 */
export function topForbiddenPatterns(
  n = 5,
  langOrPatterns?: ProseStyleForbiddenPattern[] | SupportedLanguage,
): ProseStyleForbiddenPattern[] | JaProseStyleForbiddenPattern[] {
  // Backward compat: if called with an array, use it
  if (Array.isArray(langOrPatterns)) {
    return langOrPatterns.slice(0, n)
  }

  const lang = langOrPatterns
  if (lang === 'ja') {
    return JA_TRANSLATESE_PATTERNS.slice(0, n)
  }
  if (lang === 'en') {
    return []
  }
  return ZH_TRANSLATESE_PATTERNS.slice(0, n)
}
