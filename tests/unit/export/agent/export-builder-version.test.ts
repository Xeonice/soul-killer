import { describe, it, expect } from 'vitest'
import { __TEST_ONLY_ExportBuilder as ExportBuilder } from '../../../../src/export/agent/types.js'
import type { StoryMetadata, StoryState, ProseStyle } from '../../../../src/export/agent/types.js'

function makeMinimalBuilder(): ExportBuilder {
  const b = new ExportBuilder(['主角'], 'world-x')
  const md: StoryMetadata = {
    genre: 'slice-of-life',
    tone: 'warm',
    constraints: [],
    acts_options: [{ acts: 3, label: 'short' }],
    default_acts: 3,
  }
  b.setMetadata(md)
  const state: StoryState = {
    shared_axes_custom: ['trust', 'openness'],
    flags: [],
  }
  b.setStoryState(state)
  const prose: ProseStyle = {
    target_language: 'zh',
    voice_anchor: 'warm-detached-observational-prose-with-grounded-beats',
    forbidden_patterns: [
      { id: 'p1', bad: 'bad1', good: 'good1', reason: 'r1' },
      { id: 'p2', bad: 'bad2', good: 'good2', reason: 'r2' },
      { id: 'p3', bad: 'bad3', good: 'good3', reason: 'r3' },
    ],
    ip_specific: [
      '宝具 / Noble Phantasm 保留英文',
      '主角视角用第一人称',
      '日常对话避免书面语',
    ],
  }
  b.setProseStyle(prose)
  b.addCharacter({
    name: '主角',
    display_name: '主角',
    role: 'main',
  })
  b.setAxes('主角', [])
  return b
}

describe('ExportBuilder.setAuthorVersion', () => {
  it('sets author_version and surfaces it in build output', () => {
    const b = makeMinimalBuilder()
    b.setAuthorVersion('1.2.0')
    const out = b.build()
    expect(out.story_spec.author_version).toBe('1.2.0')
  })

  it('falls back to "0.0.0" when setter is not called', () => {
    const b = makeMinimalBuilder()
    const out = b.build()
    expect(out.story_spec.author_version).toBe('0.0.0')
  })

  it('rejects empty string', () => {
    const b = makeMinimalBuilder()
    expect(() => b.setAuthorVersion('')).toThrow(/non-empty/)
  })

  it('accepts freeform strings (not semver-enforced)', () => {
    const b = makeMinimalBuilder()
    b.setAuthorVersion('2026.04.15')
    const out = b.build()
    expect(out.story_spec.author_version).toBe('2026.04.15')
  })

  it('last setAuthorVersion call wins', () => {
    const b = makeMinimalBuilder()
    b.setAuthorVersion('1.0.0')
    b.setAuthorVersion('1.0.1')
    expect(b.build().story_spec.author_version).toBe('1.0.1')
  })
})
