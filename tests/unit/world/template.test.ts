import { describe, it, expect } from 'vitest'
import { renderTemplate, type TemplateContext } from '../../../src/world/template.js'

function makeContext(overrides?: Partial<TemplateContext>): TemplateContext {
  return {
    soul: {
      name: 'johnny',
      display_name: 'Johnny Silverhand',
      identity: 'A legendary rockerboy',
      tags: {
        personality: ['rebellious'],
        communication: [],
        values: ['freedom'],
        behavior: [],
        domain: ['tech', 'music'],
      },
    },
    world: {
      name: 'night-city',
      display_name: '夜之城',
    },
    entries: {},
    ...overrides,
  }
}

describe('renderTemplate', () => {
  describe('variable interpolation', () => {
    it('replaces simple variables', () => {
      const result = renderTemplate('{{soul.display_name}} 是一名黑客', makeContext())
      expect(result).toBe('Johnny Silverhand 是一名黑客')
    })

    it('resolves nested properties', () => {
      const result = renderTemplate('世界：{{world.display_name}}', makeContext())
      expect(result).toBe('世界：夜之城')
    })

    it('returns empty string for missing variables', () => {
      const result = renderTemplate('{{soul.missing_field}}', makeContext())
      expect(result).toBe('')
    })

    it('handles arrays by joining', () => {
      const result = renderTemplate('{{soul.tags.domain}}', makeContext())
      expect(result).toBe('tech, music')
    })
  })

  describe('conditional blocks', () => {
    it('renders block when condition is truthy', () => {
      const result = renderTemplate('{{#if soul.name}}你好{{/if}}', makeContext())
      expect(result).toBe('你好')
    })

    it('hides block when condition is falsy', () => {
      const result = renderTemplate('{{#if soul.missing}}隐藏{{/if}}', makeContext())
      expect(result).toBe('')
    })

    it('hides block for empty string', () => {
      const ctx = makeContext()
      ctx.soul.identity = ''
      const result = renderTemplate('{{#if soul.identity}}有{{/if}}', ctx)
      expect(result).toBe('')
    })

    it('renders block with embedded variables', () => {
      const result = renderTemplate(
        '{{#if soul.name}}你好 {{soul.display_name}}{{/if}}',
        makeContext(),
      )
      expect(result).toBe('你好 Johnny Silverhand')
    })
  })

  describe('entry references', () => {
    it('injects another entry content', () => {
      const ctx = makeContext({ entries: { 'core-rules': '不能杀人' } })
      const result = renderTemplate('规则：{{entries.core-rules}}', ctx)
      expect(result).toBe('规则：不能杀人')
    })

    it('returns empty for non-existent entry', () => {
      const result = renderTemplate('{{entries.nonexistent}}', makeContext())
      expect(result).toBe('')
    })

    it('recursively renders entry templates', () => {
      const ctx = makeContext({
        entries: {
          'rule-a': '来自 {{world.display_name}} 的规则',
        },
      })
      const result = renderTemplate('{{entries.rule-a}}', ctx)
      expect(result).toBe('来自 夜之城 的规则')
    })
  })

  describe('recursion depth limit', () => {
    it('stops at depth 3', () => {
      const ctx = makeContext({
        entries: {
          'a': '{{entries.b}}',
          'b': '{{entries.c}}',
          'c': '{{entries.d}}',
          'd': 'deep value',
        },
      })
      // depth 0: render {{entries.a}} → depth 1: render {{entries.b}} → depth 2: render {{entries.c}} → depth 3: MAX_DEPTH, return raw
      const result = renderTemplate('{{entries.a}}', ctx)
      expect(result).toBe('{{entries.d}}')
    })
  })
})
