import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveCatalogUrl, resolveSkillUrl, DEFAULT_CATALOG_URL } from '../../../../src/cli/catalog/url.js'

const ENV_KEY = 'SOULKILLER_CATALOG_URL'
let original: string | undefined

beforeEach(() => {
  original = process.env[ENV_KEY]
  delete process.env[ENV_KEY]
})

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = original
})

describe('resolveCatalogUrl', () => {
  it('returns default when no flag/env', () => {
    expect(resolveCatalogUrl()).toBe(DEFAULT_CATALOG_URL)
  })

  it('returns env when set', () => {
    process.env[ENV_KEY] = 'https://env.example/catalog.json'
    expect(resolveCatalogUrl()).toBe('https://env.example/catalog.json')
  })

  it('flag overrides env', () => {
    process.env[ENV_KEY] = 'https://env.example/catalog.json'
    expect(resolveCatalogUrl('https://flag.example/catalog.json')).toBe('https://flag.example/catalog.json')
  })

  it('ignores empty flag', () => {
    process.env[ENV_KEY] = 'https://env.example/catalog.json'
    expect(resolveCatalogUrl('')).toBe('https://env.example/catalog.json')
  })
})

describe('resolveSkillUrl', () => {
  it('returns absolute URLs as-is', () => {
    expect(resolveSkillUrl('https://base.example/catalog.json', 'https://cdn.example/foo.skill'))
      .toBe('https://cdn.example/foo.skill')
  })

  it('resolves relative paths against catalog URL', () => {
    expect(resolveSkillUrl('https://base.example/examples/catalog.json', '/examples/skills/foo.skill'))
      .toBe('https://base.example/examples/skills/foo.skill')
  })

  it('resolves relative path without leading slash', () => {
    expect(resolveSkillUrl('https://base.example/examples/catalog.json', 'skills/foo.skill'))
      .toBe('https://base.example/examples/skills/foo.skill')
  })
})
