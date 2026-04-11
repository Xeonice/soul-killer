import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { parsePath, expandTilde, listEntries, buildDisplayPath } from '../../../src/cli/path-resolver.js'

describe('expandTilde', () => {
  it('expands ~ to home directory', () => {
    expect(expandTilde('~')).toBe(os.homedir())
  })

  it('expands ~/ path', () => {
    expect(expandTilde('~/Documents')).toBe(path.join(os.homedir(), 'Documents'))
  })

  it('does not expand non-tilde paths', () => {
    expect(expandTilde('/usr/local')).toBe('/usr/local')
  })

  it('does not expand tilde in middle', () => {
    expect(expandTilde('/home/~user')).toBe('/home/~user')
  })
})

describe('parsePath', () => {
  it('splits path into parent and prefix', () => {
    const result = parsePath('/usr/loc')
    expect(result.parentDir).toBe('/usr/')
    expect(result.prefix).toBe('loc')
  })

  it('handles trailing slash as empty prefix', () => {
    const result = parsePath('/usr/local/')
    expect(result.parentDir).toBe('/usr/local/')
    expect(result.prefix).toBe('')
  })

  it('handles no slash as current dir', () => {
    const result = parsePath('foo')
    expect(result.parentDir).toBe('.')
    expect(result.prefix).toBe('foo')
  })

  it('expands tilde before parsing', () => {
    const result = parsePath('~/Doc')
    expect(result.parentDir).toBe(os.homedir() + '/')
    expect(result.prefix).toBe('Doc')
  })
})

describe('listEntries', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-path-${crypto.randomUUID()}`)
    fs.mkdirSync(tmpDir, { recursive: true })
    // Create test structure
    fs.mkdirSync(path.join(tmpDir, 'notes'))
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'hello')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}')
    fs.mkdirSync(path.join(tmpDir, '.hidden'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('lists directory contents', () => {
    const items = listEntries(tmpDir + '/')
    expect(items.length).toBeGreaterThan(0)
  })

  it('filters by prefix', () => {
    const items = listEntries(tmpDir + '/no')
    expect(items.length).toBe(2) // notes, node_modules
    expect(items.every((i) => i.name.startsWith('no'))).toBe(true)
  })

  it('excludes hidden files', () => {
    const items = listEntries(tmpDir + '/')
    expect(items.find((i) => i.name === '.hidden')).toBeUndefined()
  })

  it('sorts directories before files', () => {
    const items = listEntries(tmpDir + '/')
    const firstFile = items.findIndex((i) => !i.isDirectory)
    const lastDir = items.findLastIndex((i) => i.isDirectory)
    if (firstFile !== -1 && lastDir !== -1) {
      expect(lastDir).toBeLessThan(firstFile)
    }
  })

  it('returns empty for non-existent path', () => {
    expect(listEntries('/nonexistent/path/')).toEqual([])
  })

  it('returns empty for no matches', () => {
    expect(listEntries(tmpDir + '/xyz')).toEqual([])
  })
})

describe('buildDisplayPath', () => {
  it('adds trailing slash for directories', () => {
    const item = { name: 'notes', fullPath: '/tmp/notes', isDirectory: true }
    expect(buildDisplayPath(item, '/tmp/')).toBe('/tmp/notes/')
  })

  it('preserves ~ prefix', () => {
    const home = os.homedir()
    const item = { name: 'docs', fullPath: path.join(home, 'docs'), isDirectory: true }
    expect(buildDisplayPath(item, '~/')).toBe('~/docs/')
  })

  it('no trailing slash for files', () => {
    const item = { name: 'file.md', fullPath: '/tmp/file.md', isDirectory: false }
    expect(buildDisplayPath(item, '/tmp/')).toBe('/tmp/file.md')
  })
})
