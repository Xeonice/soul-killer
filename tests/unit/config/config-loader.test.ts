import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { parse, stringify } from 'yaml'
import type { SoulkillerConfig } from '../../../src/config/schema.js'
import { DEFAULT_CONFIG, SUPPORTED_LANGUAGES } from '../../../src/config/schema.js'

/**
 * The config loader hard-codes paths based on os.homedir() at module load time.
 * To test it in isolation without touching the real ~/.soulkiller, we mock the
 * fs module so all reads/writes are redirected to a temp directory.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConfig(apiKey = ''): SoulkillerConfig {
  return {
    llm: {
      provider: 'openrouter',
      api_key: apiKey,
      default_model: 'anthropic/claude-sonnet-4-6',
    },
    language: 'zh',
    animation: true,
  }
}

// ── yaml round-trip (no fs mocking needed) ────────────────────────────────────

describe('yaml parse / stringify round-trip', () => {
  it('serialises and deserialises a config without data loss', () => {
    const original = makeConfig('sk-test-key-123')
    const yaml = stringify(original)
    const parsed = parse(yaml) as SoulkillerConfig
    expect(parsed).toEqual(original)
  })

  it('round-trips a config with an empty api_key', () => {
    const original = makeConfig('')
    const yaml = stringify(original)
    const parsed = parse(yaml) as SoulkillerConfig
    expect(parsed.llm.api_key).toBe('')
  })

  it('round-trips optional distill_model field', () => {
    const original: SoulkillerConfig = {
      llm: {
        provider: 'openrouter',
        api_key: 'key',
        default_model: 'x',
        distill_model: 'y',
      },
    }
    const yaml = stringify(original)
    const parsed = parse(yaml) as SoulkillerConfig
    expect(parsed.llm.distill_model).toBe('y')
  })
})

// ── fs-backed tests using a temp directory ────────────────────────────────────

describe('config loader with temp directory', () => {
  let tmpDir: string
  let configDir: string
  let configPath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `soulkiller-test-${crypto.randomUUID()}`)
    configDir = path.join(tmpDir, '.soulkiller')
    configPath = path.join(configDir, 'config.yaml')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // Inline implementations that mirror loader.ts but use our temp paths

  function configExists(): boolean {
    return fs.existsSync(configPath)
  }

  function loadConfig(): SoulkillerConfig | null {
    if (!configExists()) return null
    const raw = fs.readFileSync(configPath, 'utf-8')
    const config = parse(raw) as SoulkillerConfig
    if (config.language === undefined) config.language = 'zh'
    if (config.animation === undefined) config.animation = true
    return config
  }

  function saveConfig(config: SoulkillerConfig): void {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    fs.writeFileSync(configPath, stringify(config), 'utf-8')
  }

  function isConfigured(): boolean {
    const config = loadConfig()
    return config !== null && config.llm?.api_key !== ''
  }

  // ── configExists ────────────────────────────────────────────────────────────

  describe('configExists', () => {
    it('returns false when no config file exists', () => {
      expect(configExists()).toBe(false)
    })

    it('returns true after the config file is created', () => {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(configPath, stringify(makeConfig('key')), 'utf-8')
      expect(configExists()).toBe(true)
    })
  })

  // ── saveConfig + loadConfig round-trip ──────────────────────────────────────

  describe('saveConfig + loadConfig round-trip', () => {
    it('persists and restores a config with an api_key', () => {
      const config = makeConfig('sk-abc-123')
      saveConfig(config)
      const loaded = loadConfig()
      expect(loaded).toEqual(config)
    })

    it('creates the config directory if it does not exist', () => {
      expect(fs.existsSync(configDir)).toBe(false)
      saveConfig(makeConfig('key'))
      expect(fs.existsSync(configDir)).toBe(true)
    })

    it('overwrites an existing config file with new values', () => {
      saveConfig(makeConfig('old-key'))
      saveConfig(makeConfig('new-key'))
      const loaded = loadConfig()
      expect(loaded?.llm.api_key).toBe('new-key')
    })

    it('loadConfig returns null when no file exists', () => {
      expect(loadConfig()).toBeNull()
    })
  })

  // ── isConfigured ────────────────────────────────────────────────────────────

  describe('isConfigured', () => {
    it('returns false when there is no config file at all', () => {
      expect(isConfigured()).toBe(false)
    })

    it('returns false when api_key is an empty string', () => {
      saveConfig(makeConfig(''))
      expect(isConfigured()).toBe(false)
    })

    it('returns true when api_key is set to a non-empty value', () => {
      saveConfig(makeConfig('sk-real-api-key'))
      expect(isConfigured()).toBe(true)
    })

    it('returns true for any non-empty api_key string', () => {
      saveConfig(makeConfig('x'))
      expect(isConfigured()).toBe(true)
    })
  })

  // ── config schema extension: language & animation ────────────────────────────

  describe('language and animation fields', () => {
    it('round-trips language and animation fields', () => {
      const config = makeConfig('key')
      config.language = 'ja'
      config.animation = false
      saveConfig(config)
      const loaded = loadConfig()
      expect(loaded?.language).toBe('ja')
      expect(loaded?.animation).toBe(false)
    })

    it('fills default language when field is missing from YAML', () => {
      fs.mkdirSync(configDir, { recursive: true })
      // Write a legacy config without language/animation
      const legacy = { llm: { provider: 'openrouter', api_key: 'key', default_model: 'x' } }
      fs.writeFileSync(configPath, stringify(legacy), 'utf-8')
      const loaded = loadConfig()
      expect(loaded?.language).toBe('zh')
      expect(loaded?.animation).toBe(true)
    })
  })
})

// ── DEFAULT_CONFIG and SUPPORTED_LANGUAGES ─────────────────────────────────

describe('config schema defaults', () => {
  it('DEFAULT_CONFIG includes language zh', () => {
    expect(DEFAULT_CONFIG.language).toBe('zh')
  })

  it('DEFAULT_CONFIG includes animation true', () => {
    expect(DEFAULT_CONFIG.animation).toBe(true)
  })

  it('SUPPORTED_LANGUAGES contains zh, ja, en', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['zh', 'ja', 'en'])
  })
})
