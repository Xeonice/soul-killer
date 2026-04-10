/**
 * ExportBuilder accumulator tests — the class isn't exported, so we
 * exercise it indirectly by spinning up the builder via the tool set used
 * in runExportAgent. To keep these tests focused on the accumulator logic
 * (not the LLM loop), we construct a minimal harness that mirrors how
 * runExportAgent calls the builder methods.
 *
 * Since ExportBuilder is a private-ish class, the tests import from a
 * re-export below. If the file structure ever changes, adjust the import.
 */
import { describe, it, expect } from 'vitest'
import type {
  StoryState,
  CharacterAxis,
  CharacterAxisOverrides,
  ProseStyle,
} from '../../src/export/story-spec.js'
import { ZH_TRANSLATESE_PATTERNS } from '../../src/export/prose-style/index.js'

// ExportBuilder is declared inside export-agent.ts without an export.
// For testing, we replicate its behaviour via a lightweight shim that
// calls the same methods through a helper. Simpler: we re-export it via
// a test-only hatch below. The simplest path is to inline a shim that
// mirrors the real class — but that risks drift. Instead, we add a
// named export in the source file.
import { __TEST_ONLY_ExportBuilder as ExportBuilder } from '../../src/export/agent/index.js'

const storyState: StoryState = {
  shared_axes_custom: ['trust', 'rivalry'],
  flags: [
    { name: 'met_illya', desc: '玩家首次遇到伊莉雅', initial: false },
    { name: 'truth_revealed', desc: '圣杯真相被揭露', initial: false },
  ],
}

const proseStyle: ProseStyle = {
  target_language: 'zh',
  voice_anchor:
    'type-moon 系日翻中视觉小说官方译本风格，克制冷峻，第二人称叙述',
  forbidden_patterns: ZH_TRANSLATESE_PATTERNS.slice(0, 5),
  ip_specific: [
    '宝具/Servant/Master 保留英文或片假名，不意译',
    '敬语层级按官方译法：樱小姐 / 凛学姐 / Saber',
    '魔术回路相关术语保留片假名转写',
  ],
}

function freshBuilder() {
  return new ExportBuilder(['illya', 'rin', 'saber'], 'Fate Stay Night')
}

describe('ExportBuilder.setStoryState', () => {
  it('accepts a well-formed StoryState after setMetadata', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'visual novel',
      tone: 'test',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() => b.setStoryState(storyState)).not.toThrow()
  })

  it('rejects setStoryState before setMetadata', () => {
    const b = freshBuilder()
    expect(() => b.setStoryState(storyState)).toThrow(/set_story_metadata/)
  })

  it('rejects bond in shared_axes_custom (platform-fixed)', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() =>
      b.setStoryState({
        shared_axes_custom: ['bond', 'rivalry'],
        flags: [],
      }),
    ).toThrow(/bond/)
  })

  it('rejects duplicate shared_axes_custom entries', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() =>
      b.setStoryState({
        shared_axes_custom: ['trust', 'trust'],
        flags: [],
      }),
    ).toThrow(/distinct/)
  })

  it('rejects non-snake-case shared axis name', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() =>
      b.setStoryState({
        shared_axes_custom: ['Trust', 'rivalry'],
        flags: [],
      }),
    ).toThrow(/snake_case/)
  })

  it('rejects flag with invalid name', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() =>
      b.setStoryState({
        shared_axes_custom: ['trust', 'rivalry'],
        flags: [{ name: 'Bad Name', desc: 'x', initial: false }],
      }),
    ).toThrow(/snake_case/)
  })

  it('rejects duplicate flag names', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() =>
      b.setStoryState({
        shared_axes_custom: ['trust', 'rivalry'],
        flags: [
          { name: 'met_illya', desc: 'x', initial: false },
          { name: 'met_illya', desc: 'y', initial: true },
        ],
      }),
    ).toThrow(/duplicate/)
  })

  it('rejects setStoryState after characters already added', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'protagonist' })
    expect(() => b.setStoryState(storyState)).toThrow(/before any add_character/)
  })
})

describe('ExportBuilder.addCharacter ordering', () => {
  it('rejects addCharacter before setStoryState', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() => b.addCharacter({ name: 'illya', role: 'protagonist' })).toThrow(
      /set_story_state/,
    )
  })

  it('rejects addCharacter before setProseStyle', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    b.setStoryState(storyState)
    expect(() => b.addCharacter({ name: 'illya', role: 'protagonist' })).toThrow(
      /set_prose_style/,
    )
  })
})

describe('ExportBuilder.setAxes', () => {
  function primedBuilder() {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'protagonist' })
    return b
  }

  it('accepts 0 specific_axes', () => {
    const b = primedBuilder()
    expect(() => b.setAxes('illya', [])).not.toThrow()
  })

  it('accepts 2 specific_axes', () => {
    const b = primedBuilder()
    const axes: CharacterAxis[] = [
      { name: '自我价值', english: 'self_worth', initial: 3 },
      { name: '绝望', english: 'despair', initial: 2 },
    ]
    expect(() => b.setAxes('illya', axes)).not.toThrow()
  })

  it('rejects 3 specific_axes (over cap)', () => {
    const b = primedBuilder()
    const axes: CharacterAxis[] = [
      { name: 'a', english: 'a_axis', initial: 3 },
      { name: 'b', english: 'b_axis', initial: 3 },
      { name: 'c', english: 'c_axis', initial: 3 },
    ]
    expect(() => b.setAxes('illya', axes)).toThrow(/0-2/)
  })

  it('rejects specific axis that collides with shared axis name', () => {
    const b = primedBuilder()
    const axes: CharacterAxis[] = [{ name: '信任', english: 'trust', initial: 3 }]
    expect(() => b.setAxes('illya', axes)).toThrow(/collides/)
  })

  it('accepts valid shared_initial_overrides', () => {
    const b = primedBuilder()
    const overrides: CharacterAxisOverrides = { bond: 1, trust: 2, rivalry: 8 }
    expect(() => b.setAxes('illya', [], overrides)).not.toThrow()
  })

  it('rejects shared_initial_overrides with unknown axis', () => {
    const b = primedBuilder()
    // "loyalty" isn't in shared_axes_custom (trust/rivalry) and isn't bond
    expect(() => b.setAxes('illya', [], { loyalty: 5 })).toThrow(/unknown shared axis/)
  })

  it('rejects override value outside [0, 10]', () => {
    const b = primedBuilder()
    expect(() => b.setAxes('illya', [], { bond: 11 })).toThrow(/0, 10/)
  })
})

describe('ExportBuilder.build', () => {
  function primedMeta(b: ExportBuilder) {
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
  }

  it('fails when storyState is missing', () => {
    const b = freshBuilder()
    primedMeta(b)
    expect(() => b.build()).toThrow(/set_story_state/)
  })

  it('fails when proseStyle is missing', () => {
    const b = freshBuilder()
    primedMeta(b)
    b.setStoryState(storyState)
    // No setProseStyle. addCharacter would throw too, but build() must
    // also enforce the invariant in case caller skipped straight to build.
    expect(() => b.build()).toThrow(/prose_style is required/)
  })

  it('emits story_state in the final StorySpecConfig', () => {
    const b = freshBuilder()
    primedMeta(b)
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'protagonist' })
    b.setAxes('illya', [{ name: '自我价值', english: 'self_worth', initial: 3 }])
    const result = b.build()
    expect(result.story_spec.story_state).toEqual(storyState)
    expect(result.story_spec.characters).toHaveLength(1)
    expect(result.story_spec.characters![0]!.axes).toHaveLength(1)
    expect(result.story_spec.characters![0]!.axes[0]!.english).toBe('self_worth')
  })

  it('per-character shared_initial_overrides propagate into CharacterSpec', () => {
    const b = freshBuilder()
    primedMeta(b)
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'antagonist' })
    b.setAxes('illya', [], { bond: 1, trust: 2 })
    const result = b.build()
    const illya = result.story_spec.characters![0]!
    expect(illya.shared_initial_overrides).toEqual({ bond: 1, trust: 2 })
  })

  it('emits prose_style in the final StorySpecConfig', () => {
    const b = freshBuilder()
    primedMeta(b)
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'protagonist' })
    b.setAxes('illya', [])
    const result = b.build()
    expect(result.story_spec.prose_style).toBeDefined()
    expect(result.story_spec.prose_style!.voice_anchor).toBe(proseStyle.voice_anchor)
    expect(result.story_spec.prose_style!.forbidden_patterns).toHaveLength(5)
    expect(result.story_spec.prose_style!.ip_specific).toHaveLength(3)
  })

  it('merges per-character voice_summary into prose_style.character_voice_summary', () => {
    const b = freshBuilder()
    primedMeta(b)
    b.setStoryState(storyState)
    b.setProseStyle(proseStyle)
    b.addCharacter({
      name: 'illya',
      role: 'protagonist',
      voice_summary: '间桐桜式克制敬语中文：短句为主，避免硬译日文语气助词。',
    })
    b.setAxes('illya', [])
    const result = b.build()
    expect(result.story_spec.prose_style!.character_voice_summary).toEqual({
      illya: '间桐桜式克制敬语中文：短句为主，避免硬译日文语气助词。',
    })
  })
})

describe('ExportBuilder.setProseStyle', () => {
  function primedForProseStyle() {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    b.setStoryState(storyState)
    return b
  }

  it('accepts a well-formed ProseStyle', () => {
    const b = primedForProseStyle()
    expect(() => b.setProseStyle(proseStyle)).not.toThrow()
  })

  it('rejects setProseStyle before setStoryState', () => {
    const b = freshBuilder()
    b.setMetadata({
      genre: 'g',
      tone: 't',
      constraints: [],
      acts_options: [{ acts: 3, label_zh: 's', rounds_total: '24-36', endings_count: 4 }],
      default_acts: 3,
    })
    expect(() => b.setProseStyle(proseStyle)).toThrow(/set_story_state/)
  })

  it('rejects voice_anchor shorter than 20 chars', () => {
    const b = primedForProseStyle()
    expect(() =>
      b.setProseStyle({ ...proseStyle, voice_anchor: '太短' }),
    ).toThrow(/voice_anchor/)
  })

  it('rejects forbidden_patterns with fewer than 3 entries', () => {
    const b = primedForProseStyle()
    expect(() =>
      b.setProseStyle({
        ...proseStyle,
        forbidden_patterns: ZH_TRANSLATESE_PATTERNS.slice(0, 2),
      }),
    ).toThrow(/forbidden_patterns/)
  })

  it('rejects ip_specific with fewer than 3 entries', () => {
    const b = primedForProseStyle()
    expect(() =>
      b.setProseStyle({
        ...proseStyle,
        ip_specific: ['只有一条'],
      }),
    ).toThrow(/ip_specific/)
  })

  it('rejects character_voice_summary longer than 200 chars', () => {
    const b = primedForProseStyle()
    expect(() =>
      b.setProseStyle({
        ...proseStyle,
        character_voice_summary: { illya: 'x'.repeat(201) },
      }),
    ).toThrow(/200/)
  })

  it('rejects setProseStyle after characters already added — impossible by ordering', () => {
    // The builder enforces: setStoryState → setProseStyle → addCharacter.
    // addCharacter cannot happen before setProseStyle, so there is no way
    // to reach setProseStyle with characters already present. This test
    // documents that invariant.
    const b = primedForProseStyle()
    b.setProseStyle(proseStyle)
    b.addCharacter({ name: 'illya', role: 'protagonist' })
    expect(() => b.setProseStyle(proseStyle)).toThrow(/before any add_character/)
  })

  it('rejects character_voice_summary super long via add_character voice_summary too', () => {
    const b = primedForProseStyle()
    b.setProseStyle(proseStyle)
    expect(() =>
      b.addCharacter({
        name: 'illya',
        role: 'protagonist',
        voice_summary: 'x'.repeat(201),
      }),
    ).toThrow(/200/)
  })
})
