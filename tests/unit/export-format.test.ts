import { describe, it, expect } from 'vitest'
import {
  formatSkillName,
  formatPathSegment,
  formatSkillBaseName,
  isValidSkillName,
} from '../../src/export/format/index.js'

describe('formatSkillName — pure ASCII inputs', () => {
  it('passes through canonical kebab-case names', () => {
    expect(formatSkillName('johnny-relic-story')).toBe('johnny-relic-story')
  })

  it('lowercases mixed-case input', () => {
    expect(formatSkillName('Johnny-Relic-Story')).toBe('johnny-relic-story')
  })

  it('replaces spaces with hyphens', () => {
    expect(formatSkillName('johnny relic story')).toBe('johnny-relic-story')
  })

  it('drops underscores and other non-spec characters', () => {
    expect(formatSkillName('johnny_relic_story')).toBe('johnnyrelicstory')
  })

  it('collapses runs of hyphens', () => {
    expect(formatSkillName('johnny---relic---story')).toBe('johnny-relic-story')
  })

  it('trims leading and trailing hyphens', () => {
    expect(formatSkillName('-johnny-')).toBe('johnny')
    expect(formatSkillName('---johnny---relic---')).toBe('johnny-relic')
  })

  it('strips punctuation entirely', () => {
    expect(formatSkillName('johnny!relic@story#')).toBe('johnnyrelicstory')
  })
})

describe('formatSkillName — CJK and mixed inputs', () => {
  it('falls back to deterministic skill-<hash> when input is pure CJK', () => {
    const out = formatSkillName('伊莉雅线')
    expect(out).toMatch(/^skill-[a-z0-9]+$/)
  })

  it('strips CJK from mixed input but keeps ASCII parts', () => {
    expect(formatSkillName('FSN伊莉雅线')).toBe('fsn')
  })

  it('mixed CJK + ASCII with spaces preserves the ASCII words', () => {
    expect(formatSkillName('FSN 伊莉雅线 route')).toBe('fsn-route')
  })

  it('pure CJK fallback is deterministic — same input ⇒ same output', () => {
    const a = formatSkillName('远坂凛的故事')
    const b = formatSkillName('远坂凛的故事')
    expect(a).toBe(b)
  })

  it('different CJK inputs produce different fallback slugs', () => {
    const a = formatSkillName('远坂凛')
    const b = formatSkillName('伊莉雅')
    expect(a).not.toBe(b)
  })
})

describe('formatSkillName — length cap', () => {
  it('truncates to 64 characters', () => {
    const longInput = 'a'.repeat(100)
    const out = formatSkillName(longInput)
    expect(out.length).toBeLessThanOrEqual(64)
  })

  it('truncation does not leave a trailing hyphen', () => {
    // Construct input where the 64th char would be a hyphen
    const input = 'a'.repeat(63) + '-bbbbb'
    const out = formatSkillName(input)
    expect(out.length).toBeLessThanOrEqual(64)
    expect(out).not.toMatch(/-$/)
  })
})

describe('formatSkillName — output always passes spec regex', () => {
  const inputs = [
    'normal-input',
    'WITH UPPER CASE',
    'with_underscores',
    'with!punc#chars$',
    '伊莉雅丝菲尔·冯·爱因兹贝伦',
    '远坂凛',
    'FSN伊莉雅线',
    'a'.repeat(200),
    '   ',
    '...',
    '-',
    '--',
  ]
  for (const input of inputs) {
    it(`output for "${input.slice(0, 30)}" matches the spec regex`, () => {
      const out = formatSkillName(input)
      expect(out.length).toBeGreaterThan(0)
      expect(out.length).toBeLessThanOrEqual(64)
      expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(isValidSkillName(out)).toBe(true)
    })
  }
})

describe('formatPathSegment', () => {
  it('shares the same rules as formatSkillName for ASCII input', () => {
    expect(formatPathSegment('Combat-Strategy')).toBe('combat-strategy')
  })

  it('uses configurable fallback prefix when input is pure CJK', () => {
    const out = formatPathSegment('伊莉雅丝菲尔·冯·爱因兹贝伦', 'soul')
    expect(out).toMatch(/^soul-[a-z0-9]+$/)
  })

  it('different CJK characters with the same fallback prefix produce different slugs', () => {
    const a = formatPathSegment('远坂凛', 'soul')
    const b = formatPathSegment('伊莉雅', 'soul')
    expect(a).not.toBe(b)
  })

  it('default fallback prefix is "seg"', () => {
    const out = formatPathSegment('伊莉雅丝菲尔·冯·爱因兹贝伦')
    expect(out).toMatch(/^seg-[a-z0-9]+$/)
  })

  it('sanitizes a malformed fallback prefix', () => {
    const out = formatPathSegment('伊莉雅', '!!!')
    // Garbage prefix → fallback to "seg"
    expect(out).toMatch(/^seg-[a-z0-9]+$/)
  })
})

describe('formatSkillBaseName', () => {
  it('joins story + world with -in-', () => {
    expect(formatSkillBaseName('johnny-story', 'cyberpunk-2077')).toBe('johnny-story-in-cyberpunk-2077')
  })

  it('handles CJK story name + ASCII world', () => {
    const out = formatSkillBaseName('FSN伊莉雅线', 'Fate Stay Night')
    expect(out.length).toBeLessThanOrEqual(64)
    expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('handles fully CJK story + world (both fall back to hash)', () => {
    const out = formatSkillBaseName('伊莉雅线', '命运长夜')
    expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(out).toContain('-in-')
  })

  it('result is deterministic across calls', () => {
    const a = formatSkillBaseName('FSN伊莉雅线', 'Fate Stay Night')
    const b = formatSkillBaseName('FSN伊莉雅线', 'Fate Stay Night')
    expect(a).toBe(b)
  })
})

describe('isValidSkillName', () => {
  it('accepts valid spec names', () => {
    expect(isValidSkillName('foo')).toBe(true)
    expect(isValidSkillName('foo-bar')).toBe(true)
    expect(isValidSkillName('a1-b2-c3')).toBe(true)
    expect(isValidSkillName('a')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidSkillName('')).toBe(false)
  })

  it('rejects strings longer than 64 chars', () => {
    expect(isValidSkillName('a'.repeat(65))).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidSkillName('Foo')).toBe(false)
  })

  it('rejects leading or trailing hyphen', () => {
    expect(isValidSkillName('-foo')).toBe(false)
    expect(isValidSkillName('foo-')).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(isValidSkillName('foo--bar')).toBe(false)
  })

  it('rejects underscores or other characters', () => {
    expect(isValidSkillName('foo_bar')).toBe(false)
    expect(isValidSkillName('foo.bar')).toBe(false)
    expect(isValidSkillName('foo bar')).toBe(false)
  })

  it('rejects CJK characters', () => {
    expect(isValidSkillName('伊莉雅')).toBe(false)
  })
})
