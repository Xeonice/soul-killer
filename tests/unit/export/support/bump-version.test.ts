import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  bumpPatch,
  deriveDefaultVersion,
  readExistingAuthorVersion,
} from '../../../../src/export/support/bump-version.js'

describe('bumpPatch', () => {
  it('bumps semver patch segment', () => {
    expect(bumpPatch('1.0.3')).toBe('1.0.4')
    expect(bumpPatch('0.1.0')).toBe('0.1.1')
    expect(bumpPatch('10.20.99')).toBe('10.20.100')
  })

  it('appends .1 to two-part semver', () => {
    expect(bumpPatch('1.2')).toBe('1.2.1')
    expect(bumpPatch('0.1')).toBe('0.1.1')
  })

  it('treats date-like triples structurally as semver (ambiguous input)', () => {
    // 2026.04.15 matches the semver-3 regex; the author gets a bumped patch
    // segment. This is documented as acceptable — a YYYY.MM.DD date also
    // moves forward by +1 naturally.
    expect(bumpPatch('2026.04.15')).toBe('2026.04.16')
  })

  it('appends -1 for arbitrary strings', () => {
    expect(bumpPatch('beta')).toBe('beta-1')
    expect(bumpPatch('v1')).toBe('v1-1')
    expect(bumpPatch('release-candidate')).toBe('release-candidate-1')
  })
})

describe('readExistingAuthorVersion', () => {
  let tmp: string
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-')) })
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

  it('reads version from well-formed soulkiller.json', () => {
    const jsonPath = path.join(tmp, 'soulkiller.json')
    fs.writeFileSync(jsonPath, JSON.stringify({ version: '1.2.0', engine_version: 2 }))
    expect(readExistingAuthorVersion(jsonPath)).toBe('1.2.0')
  })

  it('returns null when file is missing', () => {
    expect(readExistingAuthorVersion(path.join(tmp, 'nope.json'))).toBeNull()
  })

  it('returns null when JSON is malformed', () => {
    const jsonPath = path.join(tmp, 'soulkiller.json')
    fs.writeFileSync(jsonPath, 'not-json')
    expect(readExistingAuthorVersion(jsonPath)).toBeNull()
  })

  it('returns null when version key is missing', () => {
    const jsonPath = path.join(tmp, 'soulkiller.json')
    fs.writeFileSync(jsonPath, JSON.stringify({ engine_version: 2 }))
    expect(readExistingAuthorVersion(jsonPath)).toBeNull()
  })

  it('returns null for empty version string', () => {
    const jsonPath = path.join(tmp, 'soulkiller.json')
    fs.writeFileSync(jsonPath, JSON.stringify({ version: '' }))
    expect(readExistingAuthorVersion(jsonPath)).toBeNull()
  })
})

describe('deriveDefaultVersion', () => {
  let tmp: string
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-')) })
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

  it('returns 0.1.0 when no existing dir', () => {
    expect(deriveDefaultVersion(null)).toBe('0.1.0')
  })

  it('returns 0.1.0 when existing dir has no soulkiller.json', () => {
    expect(deriveDefaultVersion(tmp)).toBe('0.1.0')
  })

  it('bumps existing semver patch', () => {
    fs.writeFileSync(path.join(tmp, 'soulkiller.json'), JSON.stringify({ version: '1.2.3' }))
    expect(deriveDefaultVersion(tmp)).toBe('1.2.4')
  })

  it('bumps non-semver by appending -1', () => {
    fs.writeFileSync(path.join(tmp, 'soulkiller.json'), JSON.stringify({ version: 'beta' }))
    expect(deriveDefaultVersion(tmp)).toBe('beta-1')
  })
})
