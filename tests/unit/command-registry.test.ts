import { describe, it, expect } from 'vitest'
import { COMMANDS, getCommandNames, getCommandGroups, filterCommands } from '../../src/cli/command-registry.js'

describe('CommandRegistry', () => {
  it('exports a non-empty command list', () => {
    expect(COMMANDS.length).toBeGreaterThan(0)
  })

  it('every command has name, description, and group', () => {
    for (const cmd of COMMANDS) {
      expect(cmd.name).toBeTruthy()
      expect(cmd.description).toBeTruthy()
      expect(cmd.group).toBeTruthy()
    }
  })

  it('command names are unique', () => {
    const names = COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('getCommandNames returns all names', () => {
    const names = getCommandNames()
    expect(names.length).toBe(COMMANDS.length)
    expect(names).toContain('create')
    expect(names).toContain('help')
    expect(names).toContain('exit')
  })

  it('getCommandGroups groups commands correctly', () => {
    const groups = getCommandGroups()
    expect(groups.length).toBeGreaterThan(0)
    const totalCommands = groups.reduce((sum, g) => sum + g.commands.length, 0)
    expect(totalCommands).toBe(COMMANDS.length)
  })

  it('filterCommands with empty prefix returns all', () => {
    expect(filterCommands('').length).toBe(COMMANDS.length)
  })

  it('filterCommands with "cr" returns create', () => {
    const filtered = filterCommands('cr')
    expect(filtered.length).toBe(1)
    expect(filtered[0]!.name).toBe('create')
  })

  it('filterCommands with "s" returns status', () => {
    const filtered = filterCommands('s')
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    for (const cmd of filtered) {
      expect(cmd.name.startsWith('s')).toBe(true)
    }
  })

  it('filterCommands with "xyz" returns empty', () => {
    expect(filterCommands('xyz').length).toBe(0)
  })
})
