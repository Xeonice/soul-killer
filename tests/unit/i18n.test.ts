import { describe, it, expect, beforeEach } from 'vitest'
import { t, setLocale, getLocale } from '../../src/i18n/index.js'

describe('i18n', () => {
  beforeEach(() => {
    setLocale('zh')
  })

  it('getLocale returns current locale', () => {
    expect(getLocale()).toBe('zh')
    setLocale('en')
    expect(getLocale()).toBe('en')
  })

  it('t() returns Chinese text by default', () => {
    const text = t('cmd.help')
    expect(text).toBe('帮助')
  })

  it('t() returns English text when locale is en', () => {
    setLocale('en')
    expect(t('cmd.help')).toBe('Help')
  })

  it('t() returns Japanese text when locale is ja', () => {
    setLocale('ja')
    expect(t('cmd.help')).toBe('ヘルプ')
  })

  it('t() returns the key itself for missing keys', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('t() interpolates params', () => {
    const text = t('config.set.success', { key: 'model', value: 'gpt-4' })
    expect(text).toContain('model')
    expect(text).toContain('gpt-4')
  })

  it('t() interpolates multiple params', () => {
    setLocale('en')
    const text = t('config.set.success', { key: 'model', value: 'gpt-4' })
    expect(text).toBe('Set model to gpt-4')
  })
})
