import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig, saveConfig } from '../../../config/loader.js'
import { RECOMMENDED_MODELS, SUPPORTED_LANGUAGES } from '../../../config/schema.js'
import type { SoulkillerConfig, SupportedLanguage, SearchProvider } from '../../../config/schema.js'
import { t, setLocale } from '../../../infra/i18n/index.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../../animation/colors.js'
import { AGENT_LOG_DIR } from '../../../infra/utils/agent-logger.js'

type ConfigKey = 'model' | 'api_key' | 'search_provider' | 'language' | 'animation' | 'clean_logs'
type EditMode = 'menu' | 'editing' | 'select' | 'search_key' | 'clean_logs'

interface ConfigItem {
  key: ConfigKey
  labelKey: string
  getValue: (config: SoulkillerConfig) => string
  displayValue: (config: SoulkillerConfig) => string
}

const CONFIG_ITEMS: ConfigItem[] = [
  {
    key: 'model',
    labelKey: 'config.label.model',
    getValue: (c) => c.llm.default_model,
    displayValue: (c) => c.llm.default_model,
  },
  {
    key: 'api_key',
    labelKey: 'config.label.api_key',
    getValue: (c) => c.llm.api_key,
    displayValue: (c) => maskApiKey(c.llm.api_key),
  },
  {
    key: 'search_provider',
    labelKey: 'config.label.search_provider',
    getValue: (c) => c.search?.provider ?? 'searxng',
    displayValue: (c) => {
      const provider = c.search?.provider ?? 'searxng'
      const labels: Record<string, string> = { searxng: 'SearXNG', exa: 'Exa', tavily: 'Tavily' }
      const label = labels[provider] ?? provider
      // Show key status for API providers
      if (provider === 'exa') {
        return `${label}  ${c.search?.exa_api_key ? maskApiKey(c.search.exa_api_key) : t('config.not_set')}`
      }
      if (provider === 'tavily') {
        return `${label}  ${c.search?.tavily_api_key ? maskApiKey(c.search.tavily_api_key) : t('config.not_set')}`
      }
      return label
    },
  },
  {
    key: 'language',
    labelKey: 'config.label.language',
    getValue: (c) => c.language,
    displayValue: (c) => {
      const labels: Record<string, string> = { zh: '中文', ja: '日本語', en: 'English' }
      return `${c.language} (${labels[c.language] ?? c.language})`
    },
  },
  {
    key: 'animation',
    labelKey: 'config.label.animation',
    getValue: (c) => String(c.animation),
    displayValue: (c) => c.animation ? 'ON' : 'OFF',
  },
  {
    key: 'clean_logs',
    labelKey: 'config.label.clean_logs',
    getValue: () => '',
    displayValue: () => getLogStats().summary,
  },
]

function getLogStats(): { fileCount: number; totalBytes: number; summary: string } {
  try {
    if (!fs.existsSync(AGENT_LOG_DIR)) {
      return { fileCount: 0, totalBytes: 0, summary: 'No logs' }
    }
    const files = fs.readdirSync(AGENT_LOG_DIR).filter((f) => f.endsWith('.log'))
    let totalBytes = 0
    for (const f of files) {
      totalBytes += fs.statSync(path.join(AGENT_LOG_DIR, f)).size
    }
    const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1)
    return {
      fileCount: files.length,
      totalBytes,
      summary: files.length > 0 ? `${files.length} files, ${sizeMB} MB` : 'No logs',
    }
  } catch {
    return { fileCount: 0, totalBytes: 0, summary: 'No logs' }
  }
}

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
]

const SEARCH_PROVIDER_OPTIONS: { value: SearchProvider; label: string }[] = [
  { value: 'searxng', label: 'SearXNG (本地 Docker)' },
  { value: 'exa', label: 'Exa (API)' },
  { value: 'tavily', label: 'Tavily (API)' },
]

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '····' + key.slice(-4)
}

interface ConfigCommandProps {
  onClose: () => void
}

export function ConfigCommand({ onClose }: ConfigCommandProps) {
  const [config, setConfig] = useState<SoulkillerConfig | null>(() => loadConfig())
  const [cursor, setCursor] = useState(0)
  const [mode, setMode] = useState<EditMode>('menu')
  const [editValue, setEditValue] = useState('')
  const [selectCursor, setSelectCursor] = useState(0)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<SearchProvider | null>(null)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  const doSave = useCallback((key: string, value: string) => {
    if (!config) return
    const updated = { ...config, llm: { ...config.llm }, search: { ...config.search } }
    switch (key) {
      case 'model':
        updated.llm.default_model = value
        break
      case 'api_key':
        updated.llm.api_key = value
        break
      case 'search_provider':
        updated.search = { ...updated.search, provider: value as SearchProvider }
        break
      case 'tavily_key':
        updated.search = { ...updated.search, tavily_api_key: value.trim() }
        break
      case 'exa_key':
        updated.search = { ...updated.search, exa_api_key: value.trim() }
        break
      case 'language':
        updated.language = value as SupportedLanguage
        setLocale(value as SupportedLanguage)
        break
      case 'animation':
        updated.animation = value === 'true'
        break
    }
    saveConfig(updated)
    setConfig(updated)
    setSavedKey(key)
    setTimeout(() => setSavedKey(null), 1500)
  }, [config])

  useInput((input, key) => {
    if (!config) return

    if (mode === 'menu') {
      if (key.upArrow) {
        setCursor((c) => (c - 1 + CONFIG_ITEMS.length) % CONFIG_ITEMS.length)
        return
      }
      if (key.downArrow) {
        setCursor((c) => (c + 1) % CONFIG_ITEMS.length)
        return
      }
      if (key.escape) {
        onClose()
        return
      }
      if (key.return) {
        const item = CONFIG_ITEMS[cursor]!
        if (item.key === 'language') {
          const currentIdx = LANGUAGE_OPTIONS.findIndex((l) => l.value === config.language)
          setSelectCursor(currentIdx >= 0 ? currentIdx : 0)
          setMode('select')
        } else if (item.key === 'search_provider') {
          const currentIdx = SEARCH_PROVIDER_OPTIONS.findIndex((p) => p.value === (config.search?.provider ?? 'searxng'))
          setSelectCursor(currentIdx >= 0 ? currentIdx : 0)
          setMode('select')
        } else if (item.key === 'animation') {
          setSelectCursor(config.animation ? 0 : 1)
          setMode('select')
        } else if (item.key === 'model') {
          const currentIdx = RECOMMENDED_MODELS.findIndex((m) => m.id === config.llm.default_model)
          setSelectCursor(currentIdx >= 0 ? currentIdx : 0)
          setMode('select')
        } else if (item.key === 'clean_logs') {
          const stats = getLogStats()
          if (stats.fileCount === 0) {
            setCleanupResult(t('config.no_logs'))
            setTimeout(() => setCleanupResult(null), 2000)
          } else {
            setMode('clean_logs')
          }
        } else {
          setEditValue(item.getValue(config))
          setMode('editing')
        }
        return
      }
    }

    if (mode === 'editing') {
      if (key.escape) {
        setMode('menu')
        return
      }
      if (key.return) {
        const item = CONFIG_ITEMS[cursor]!
        doSave(item.key, editValue)
        setMode('menu')
        return
      }
      if (key.backspace || key.delete) {
        setEditValue((v) => v.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setEditValue((v) => v + input)
        return
      }
    }

    // API key input after selecting search provider
    if (mode === 'search_key') {
      if (key.escape) {
        setMode('menu')
        setPendingProvider(null)
        return
      }
      if (key.return) {
        if (editValue.trim() && config) {
          // Save provider + key together in one update
          const updated = { ...config, llm: { ...config.llm }, search: { ...config.search } }
          updated.search = { ...updated.search, provider: pendingProvider! as SearchProvider }
          if (pendingProvider === 'exa') {
            updated.search.exa_api_key = editValue.trim()
          } else {
            updated.search.tavily_api_key = editValue.trim()
          }
          saveConfig(updated)
          setConfig(updated)
          setSavedKey('search_provider')
          setTimeout(() => setSavedKey(null), 1500)
        }
        setMode('menu')
        setPendingProvider(null)
        return
      }
      if (key.backspace || key.delete) {
        setEditValue((v) => v.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setEditValue((v) => v + input)
        return
      }
    }

    if (mode === 'clean_logs') {
      if (input === 'y' || input === 'Y') {
        const stats = getLogStats()
        try {
          fs.rmSync(AGENT_LOG_DIR, { recursive: true, force: true })
          fs.mkdirSync(AGENT_LOG_DIR, { recursive: true })
          const sizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(1)
          setCleanupResult(t('config.logs_deleted', { count: String(stats.fileCount), size: sizeMB }))
        } catch {
          setCleanupResult(t('config.logs_delete_failed'))
        }
        setTimeout(() => setCleanupResult(null), 3000)
        setMode('menu')
        return
      }
      // Any other key = cancel
      setMode('menu')
      return
    }

    if (mode === 'select') {
      const item = CONFIG_ITEMS[cursor]!
      const optionCount = item.key === 'language'
        ? LANGUAGE_OPTIONS.length
        : item.key === 'model'
          ? RECOMMENDED_MODELS.length
          : item.key === 'search_provider'
            ? SEARCH_PROVIDER_OPTIONS.length
            : 2

      if (key.upArrow) {
        setSelectCursor((c) => (c - 1 + optionCount) % optionCount)
        return
      }
      if (key.downArrow) {
        setSelectCursor((c) => (c + 1) % optionCount)
        return
      }
      if (key.escape) {
        setMode('menu')
        return
      }
      if (key.return) {
        if (item.key === 'search_provider') {
          const selected = SEARCH_PROVIDER_OPTIONS[selectCursor]!.value
          if (selected === 'searxng') {
            // SearXNG doesn't need a key
            doSave('search_provider', selected)
            setMode('menu')
          } else {
            // Exa or Tavily — transition to key input
            setPendingProvider(selected)
            const existingKey = selected === 'exa'
              ? (config.search?.exa_api_key ?? '')
              : (config.search?.tavily_api_key ?? '')
            setEditValue(existingKey)
            setMode('search_key')
          }
          return
        }

        let value: string
        if (item.key === 'language') {
          value = LANGUAGE_OPTIONS[selectCursor]!.value
        } else if (item.key === 'model') {
          value = RECOMMENDED_MODELS[selectCursor]!.id
        } else {
          value = selectCursor === 0 ? 'true' : 'false'
        }
        doSave(item.key, value)
        setMode('menu')
        return
      }
    }
  })

  if (!config) {
    return <Text color={WARNING}>{t('config.not_initialized')}</Text>
  }

  const currentItem = CONFIG_ITEMS[cursor]!

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>{t('config.title')}</Text>
      <Text color={DIM}>  {t('config.nav_hint')}</Text>
      <Text> </Text>

      {CONFIG_ITEMS.map((item, i) => {
        const isSelected = i === cursor
        const isSaved = savedKey === item.key
        const label = t(item.labelKey)
        const display = item.displayValue(config)

        return (
          <Text key={item.key}>
            <Text color={isSelected ? ACCENT : DIM}>
              {isSelected ? '  ❯ ' : '    '}
            </Text>
            <Text color={isSelected ? PRIMARY : DIM} bold={isSelected}>
              {label.padEnd(12)}
            </Text>
            <Text color={isSelected ? PRIMARY : DIM}>{display}</Text>
            {isSaved && <Text color={PRIMARY}> ✓</Text>}
          </Text>
        )
      })}

      {/* Editing area */}
      {mode === 'editing' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={DIM}>  {t('config.editing', { field: t(currentItem.labelKey) })}</Text>
          <Text>
            <Text color={PRIMARY}>  {'>'} {currentItem.key === 'api_key' ? '•'.repeat(editValue.length) : editValue}</Text>
            <Text color={PRIMARY}>█</Text>
          </Text>
          <Text color={DIM}>  {t('config.edit_hint')}</Text>
        </Box>
      )}

      {/* Search key input after provider selection */}
      {mode === 'search_key' && pendingProvider && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={PRIMARY}>  {pendingProvider === 'exa' ? 'Exa' : 'Tavily'} API Key:</Text>
          <Text>
            <Text color={PRIMARY}>  {'>'} {'•'.repeat(editValue.length)}</Text>
            <Text color={PRIMARY}>█</Text>
          </Text>
          <Text color={DIM}>  {t('config.edit_hint')}</Text>
        </Box>
      )}

      {/* Select: language */}
      {mode === 'select' && currentItem.key === 'language' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={DIM}>  {t('config.selecting', { field: t(currentItem.labelKey) })}</Text>
          {LANGUAGE_OPTIONS.map((opt, i) => (
            <Text key={opt.value}>
              <Text color={i === selectCursor ? ACCENT : DIM}>
                {i === selectCursor ? '  ❯ ' : '    '}
              </Text>
              <Text color={i === selectCursor ? PRIMARY : DIM}>
                {opt.value === config.language ? '◉' : '◯'} {opt.label} ({opt.value})
              </Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Select: animation */}
      {mode === 'select' && currentItem.key === 'animation' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={DIM}>  {t('config.selecting', { field: t(currentItem.labelKey) })}</Text>
          {['ON', 'OFF'].map((opt, i) => (
            <Text key={opt}>
              <Text color={i === selectCursor ? ACCENT : DIM}>
                {i === selectCursor ? '  ❯ ' : '    '}
              </Text>
              <Text color={i === selectCursor ? PRIMARY : DIM}>
                {(i === 0) === config.animation ? '◉' : '◯'} {opt}
              </Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Select: search provider */}
      {mode === 'select' && currentItem.key === 'search_provider' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={DIM}>  {t('config.selecting', { field: t(currentItem.labelKey) })}</Text>
          {SEARCH_PROVIDER_OPTIONS.map((opt, i) => (
            <Text key={opt.value}>
              <Text color={i === selectCursor ? ACCENT : DIM}>
                {i === selectCursor ? '  ❯ ' : '    '}
              </Text>
              <Text color={i === selectCursor ? PRIMARY : DIM}>
                {opt.value === (config.search?.provider ?? 'searxng') ? '◉' : '◯'} {opt.label}
              </Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Clean logs confirmation */}
      {mode === 'clean_logs' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          {(() => {
            const stats = getLogStats()
            const sizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(1)
            return (
              <>
                <Text color={PRIMARY}>  {AGENT_LOG_DIR}</Text>
                <Text color={DIM}>  Files : {stats.fileCount}</Text>
                <Text color={DIM}>  Size  : {sizeMB} MB</Text>
                <Text> </Text>
                <Text color={WARNING}>  {t('config.confirm_delete_logs')}</Text>
                <Text color={DIM}>  [Y] {t('config.confirm_yes')}    [N] {t('config.confirm_no')}</Text>
              </>
            )
          })()}
        </Box>
      )}

      {/* Cleanup result message */}
      {cleanupResult && (
        <Box marginTop={1} paddingLeft={4}>
          <Text color={PRIMARY}>  {cleanupResult}</Text>
        </Box>
      )}

      {/* Select: model */}
      {mode === 'select' && currentItem.key === 'model' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={4}>
          <Text color={DIM}>  {t('config.selecting', { field: t(currentItem.labelKey) })}</Text>
          {RECOMMENDED_MODELS.map((m, i) => (
            <Text key={m.id}>
              <Text color={i === selectCursor ? ACCENT : DIM}>
                {i === selectCursor ? '  ❯ ' : '    '}
              </Text>
              <Text color={i === selectCursor ? PRIMARY : DIM}>
                {m.id === config.llm.default_model ? '◉' : '◯'} {m.name}
              </Text>
              <Text color={DIM}> {t(m.pricingKey)} · {t(m.tagKey)}</Text>
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
