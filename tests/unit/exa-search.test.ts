import { describe, it, expect } from 'vitest'
import { hasCJK } from '../../src/agent/search/exa-search.js'

describe('hasCJK', () => {
  it('detects Chinese characters', () => {
    expect(hasCJK('三国 历史')).toBe(true)
  })

  it('detects Japanese hiragana', () => {
    expect(hasCJK('間桐桜 せりふ')).toBe(true)
  })

  it('detects Japanese katakana', () => {
    expect(hasCJK('セイバー')).toBe(true)
  })

  it('detects Korean characters', () => {
    expect(hasCJK('한국어')).toBe(true)
  })

  it('returns false for pure English', () => {
    expect(hasCJK('Artoria Pendragon wiki')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasCJK('')).toBe(false)
  })

  it('detects CJK in mixed query', () => {
    expect(hasCJK('阿尔托莉雅 Fate')).toBe(true)
  })

  it('returns false for numbers and punctuation only', () => {
    expect(hasCJK('123 test!')).toBe(false)
  })
})
