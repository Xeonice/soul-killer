import { describe, it, expect } from 'vitest'
import { parseInput, suggestCommand } from '../../../src/cli/command-parser.js'

describe('parseInput', () => {
  describe('slash commands', () => {
    it('recognizes a bare slash command with no args', () => {
      const result = parseInput('/help')
      expect(result.type).toBe('slash')
      if (result.type === 'slash') {
        expect(result.name).toBe('help')
        expect(result.args).toBe('')
      }
    })

    it('recognizes a slash command with args', () => {
      const result = parseInput('/create my-project')
      expect(result.type).toBe('slash')
      if (result.type === 'slash') {
        expect(result.name).toBe('create')
        expect(result.args).toBe('my-project')
      }
    })

    it('recognizes a slash command with multiple words as args', () => {
      const result = parseInput('/evolve my-soul')
      expect(result.type).toBe('slash')
      if (result.type === 'slash') {
        expect(result.name).toBe('evolve')
        expect(result.args).toBe('my-soul')
      }
    })

    it('strips leading and trailing whitespace before parsing', () => {
      const result = parseInput('  /status  ')
      expect(result.type).toBe('slash')
      if (result.type === 'slash') {
        expect(result.name).toBe('status')
        expect(result.args).toBe('')
      }
    })

    it('trims trailing whitespace from args', () => {
      const result = parseInput('/model   gpt-4   ')
      expect(result.type).toBe('slash')
      if (result.type === 'slash') {
        expect(result.name).toBe('model')
        expect(result.args).toBe('gpt-4')
      }
    })
  })

  describe('natural language input', () => {
    it('returns type natural for plain text', () => {
      const result = parseInput('what is my soul?')
      expect(result.type).toBe('natural')
      if (result.type === 'natural') {
        expect(result.text).toBe('what is my soul?')
      }
    })

    it('returns type natural for text that starts with a word', () => {
      const result = parseInput('help me understand something')
      expect(result.type).toBe('natural')
      if (result.type === 'natural') {
        expect(result.text).toBe('help me understand something')
      }
    })

    it('trims whitespace from natural language input', () => {
      const result = parseInput('  tell me about myself  ')
      expect(result.type).toBe('natural')
      if (result.type === 'natural') {
        expect(result.text).toBe('tell me about myself')
      }
    })

    it('returns type natural for an empty string after trimming', () => {
      const result = parseInput('   ')
      expect(result.type).toBe('natural')
      if (result.type === 'natural') {
        expect(result.text).toBe('')
      }
    })
  })
})

describe('suggestCommand', () => {
  it('suggests "help" for "hel"', () => {
    expect(suggestCommand('hel')).toBe('help')
  })

  it('suggests "create" for "crate"', () => {
    expect(suggestCommand('crate')).toBe('create')
  })

  it('suggests "status" for "stats"', () => {
    expect(suggestCommand('stats')).toBe('status')
  })

  it('suggests "exit" for "exi"', () => {
    expect(suggestCommand('exi')).toBe('exit')
  })

  it('suggests "list" for "lst"', () => {
    expect(suggestCommand('lst')).toBe('list')
  })

  it('is case-insensitive', () => {
    expect(suggestCommand('HELP')).toBe('help')
  })

  it('returns null for completely unrelated input', () => {
    expect(suggestCommand('xyzzy')).toBeNull()
  })

  it('returns null for very long unrelated input', () => {
    expect(suggestCommand('supercalifragilistic')).toBeNull()
  })

  it('returns the exact command when input matches perfectly', () => {
    expect(suggestCommand('config')).toBe('config')
  })
})
