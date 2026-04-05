import { describe, it, expect } from 'vitest'
import { resolveEntries } from '../../src/world/resolver.js'
import type { WorldEntry } from '../../src/world/entry.js'
import type { WorldBinding } from '../../src/world/binding.js'
import type { ChatMessage } from '../../src/llm/stream.js'

function makeBinding(overrides?: Partial<WorldBinding>): WorldBinding {
  return {
    world: 'test-world',
    enabled: true,
    order: 0,
    ...overrides,
  }
}

function makeEntry(overrides?: Partial<WorldEntry['meta']>, content = 'test content'): WorldEntry {
  return {
    meta: {
      name: 'test-entry',
      keywords: [],
      priority: 100,
      mode: 'keyword',
      scope: 'lore',
      ...overrides,
    },
    content,
  }
}

describe('resolveEntries', () => {
  describe('always mode', () => {
    it('always includes always-mode entries', () => {
      const entries = [makeEntry({ name: 'core', mode: 'always' })]
      const result = resolveEntries(entries, makeBinding(), '', [])
      expect(result).toHaveLength(1)
      expect(result[0].entry.meta.name).toBe('core')
    })
  })

  describe('keyword mode', () => {
    it('triggers on keyword match in user input', () => {
      const entries = [makeEntry({ name: 'corps', keywords: ['荒坂', 'Arasaka'] })]
      const result = resolveEntries(entries, makeBinding(), '荒坂的CEO是谁', [])
      expect(result).toHaveLength(1)
    })

    it('is case-insensitive', () => {
      const entries = [makeEntry({ name: 'corps', keywords: ['arasaka'] })]
      const result = resolveEntries(entries, makeBinding(), 'ARASAKA is powerful', [])
      expect(result).toHaveLength(1)
    })

    it('does not trigger when no keyword matches', () => {
      const entries = [makeEntry({ name: 'corps', keywords: ['荒坂'] })]
      const result = resolveEntries(entries, makeBinding(), '今天天气怎么样', [])
      expect(result).toHaveLength(0)
    })

    it('triggers on keyword match in recent messages', () => {
      const entries = [makeEntry({ name: 'corps', keywords: ['荒坂'] })]
      const recentMessages: ChatMessage[] = [
        { role: 'user', content: '说说荒坂吧' },
        { role: 'assistant', content: '荒坂是一家超企...' },
      ]
      const result = resolveEntries(entries, makeBinding(), '继续', recentMessages)
      expect(result).toHaveLength(1)
    })
  })

  describe('entry filter', () => {
    it('filters by include_scopes', () => {
      const entries = [
        makeEntry({ name: 'a', mode: 'always', scope: 'background' }),
        makeEntry({ name: 'b', mode: 'always', scope: 'lore' }),
      ]
      const binding = makeBinding({ entry_filter: { include_scopes: ['background'] } })
      const result = resolveEntries(entries, binding, '', [])
      expect(result).toHaveLength(1)
      expect(result[0].entry.meta.name).toBe('a')
    })

    it('excludes specific entries', () => {
      const entries = [
        makeEntry({ name: 'a', mode: 'always' }),
        makeEntry({ name: 'b', mode: 'always' }),
      ]
      const binding = makeBinding({ entry_filter: { exclude_entries: ['b'] } })
      const result = resolveEntries(entries, binding, '', [])
      expect(result).toHaveLength(1)
      expect(result[0].entry.meta.name).toBe('a')
    })

    it('applies priority_boost', () => {
      const entries = [
        makeEntry({ name: 'a', mode: 'always', priority: 100 }),
        makeEntry({ name: 'b', mode: 'always', priority: 50 }),
      ]
      const binding = makeBinding({ entry_filter: { priority_boost: { b: 500 } } })
      const result = resolveEntries(entries, binding, '', [])
      const bEntry = result.find((r) => r.entry.meta.name === 'b')!
      const aEntry = result.find((r) => r.entry.meta.name === 'a')!
      expect(bEntry.effectivePriority).toBeGreaterThan(aEntry.effectivePriority)
    })
  })

  describe('effective priority', () => {
    it('computes (MAX_ORDER - order) * 1000 + priority + boost', () => {
      const entries = [makeEntry({ name: 'a', mode: 'always', priority: 200 })]
      const binding = makeBinding({ order: 2 })
      const result = resolveEntries(entries, binding, '', [])
      // (1000 - 2) * 1000 + 200 = 998200
      expect(result[0].effectivePriority).toBe(998200)
    })
  })
})
