import { describe, it, expect } from 'vitest'
import {
  emptyWorldTagSet,
  type WorldTagSet,
  type WorldTagCategory,
} from '../../../../src/world/tags/world-taxonomy.js'

describe('emptyWorldTagSet', () => {
  it('returns all categories as empty arrays', () => {
    const tags = emptyWorldTagSet()
    expect(tags).toEqual({
      genre: [],
      tone: [],
      scale: [],
      era: [],
      theme: [],
    })
  })

  it('returns a new object each time', () => {
    const a = emptyWorldTagSet()
    const b = emptyWorldTagSet()
    expect(a).not.toBe(b)
    a.genre.push('test')
    expect(b.genre).toHaveLength(0)
  })
})

describe('WorldTagSet structure', () => {
  it('has all 5 categories', () => {
    const categories: WorldTagCategory[] = ['genre', 'tone', 'scale', 'era', 'theme']
    const tags = emptyWorldTagSet()
    for (const cat of categories) {
      expect(tags).toHaveProperty(cat)
      expect(Array.isArray(tags[cat])).toBe(true)
    }
  })

  it('accepts string values', () => {
    const tags: WorldTagSet = {
      genre: ['cyberpunk', 'sci-fi'],
      tone: ['dark'],
      scale: ['city'],
      era: ['near-future'],
      theme: ['technology', 'class'],
    }
    expect(tags.genre).toHaveLength(2)
    expect(tags.theme).toContain('class')
  })
})
