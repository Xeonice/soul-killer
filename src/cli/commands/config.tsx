import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { loadConfig, saveConfig } from '../../config/loader.js'
import { RECOMMENDED_MODELS, SUPPORTED_LANGUAGES } from '../../config/schema.js'
import type { SoulkillerConfig, SupportedLanguage } from '../../config/schema.js'
import { t, setLocale } from '../../i18n/index.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../animation/colors.js'

type ConfigKey = 'model' | 'api_key' | 'tavily_key' | 'language' | 'animation'
type EditMode = 'menu' | 'editing' | 'select'

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
    key: 'tavily_key',
    labelKey: 'config.label.tavily_key',
    getValue: (c) => c.search?.tavily_api_key ?? '',
    displayValue: (c) => c.search?.tavily_api_key ? maskApiKey(c.search.tavily_api_key) : t('config.not_set'),
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
]

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
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

  const handleSave = useCallback((key: ConfigKey, value: string) => {
    if (!config) return
    const updated = { ...config, llm: { ...config.llm }, search: { ...config.search } }
    switch (key) {
      case 'model':
        updated.llm.default_model = value
        break
      case 'api_key':
        updated.llm.api_key = value
        break
      case 'tavily_key':
        if (value.trim()) {
          updated.search = { ...updated.search, tavily_api_key: value.trim() }
        } else {
          delete updated.search?.tavily_api_key
        }
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
        // language and animation use select mode, others use text editing
        if (item.key === 'language') {
          const currentIdx = LANGUAGE_OPTIONS.findIndex((l) => l.value === config.language)
          setSelectCursor(currentIdx >= 0 ? currentIdx : 0)
          setMode('select')
        } else if (item.key === 'animation') {
          setSelectCursor(config.animation ? 0 : 1)
          setMode('select')
        } else if (item.key === 'model') {
          // Model: show recommended models as select
          const currentIdx = RECOMMENDED_MODELS.findIndex((m) => m.id === config.llm.default_model)
          setSelectCursor(currentIdx >= 0 ? currentIdx : 0)
          setMode('select')
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
        handleSave(item.key, editValue)
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

    if (mode === 'select') {
      const item = CONFIG_ITEMS[cursor]!
      const optionCount = item.key === 'language'
        ? LANGUAGE_OPTIONS.length
        : item.key === 'model'
          ? RECOMMENDED_MODELS.length
          : 2 // animation: ON/OFF

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
        let value: string
        if (item.key === 'language') {
          value = LANGUAGE_OPTIONS[selectCursor]!.value
        } else if (item.key === 'model') {
          value = RECOMMENDED_MODELS[selectCursor]!.id
        } else {
          value = selectCursor === 0 ? 'true' : 'false'
        }
        handleSave(item.key, value)
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
            <Text color={PRIMARY}>  {'>'} {(currentItem.key === 'api_key' || currentItem.key === 'tavily_key') ? '•'.repeat(editValue.length) : editValue}</Text>
            <Text color={PRIMARY}>█</Text>
          </Text>
          <Text color={DIM}>  {t('config.edit_hint')}</Text>
        </Box>
      )}

      {/* Select area */}
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
