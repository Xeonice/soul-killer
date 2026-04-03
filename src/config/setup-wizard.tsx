import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { TextInput, CheckboxSelect } from '../cli/components/text-input.js'
import { validateApiKey } from '../llm/client.js'
import { RECOMMENDED_MODELS, type SoulkillerConfig, type SupportedLanguage } from './schema.js'
import { saveConfig } from './loader.js'
import { PRIMARY, ACCENT, WARNING, DIM } from '../cli/animation/colors.js'
import { t, setLocale } from '../i18n/index.js'

type Step = 'language' | 'intro' | 'api_key' | 'validating' | 'model_select' | 'tavily_key' | 'done'

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

interface SetupWizardProps {
  onComplete: (config: SoulkillerConfig) => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('language')
  const [language, setLanguage] = useState<SupportedLanguage>('zh')
  const [langCursor, setLangCursor] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [balance, setBalance] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)

  useInput((_, key) => {
    if (step !== 'language') return
    if (key.upArrow) setLangCursor((i) => Math.max(0, i - 1))
    if (key.downArrow) setLangCursor((i) => Math.min(LANGUAGE_OPTIONS.length - 1, i + 1))
    if (key.return) {
      const selected = LANGUAGE_OPTIONS[langCursor]!.value
      setLanguage(selected)
      setLocale(selected)
      setStep('intro')
    }
  })

  const handleKeySubmit = useCallback(async (key: string) => {
    setApiKey(key)
    setStep('validating')
    const result = await validateApiKey(key)
    if (result.valid) {
      setBalance(result.balance)
      setStep('model_select')
    } else {
      setError(result.error ?? 'Invalid key')
      setStep('api_key')
    }
  }, [])

  const handleModelSelect = useCallback((selected: string[]) => {
    setSelectedModel(selected[0] ?? RECOMMENDED_MODELS[0].id)
    setStep('tavily_key')
  }, [])

  const handleTavilyKeySubmit = useCallback((tavilyKey: string) => {
    const config: SoulkillerConfig = {
      llm: {
        provider: 'openrouter',
        api_key: apiKey,
        default_model: selectedModel,
      },
      language,
      ...(tavilyKey.trim() ? { search: { tavily_api_key: tavilyKey.trim() } } : {}),
    }
    saveConfig(config)
    setStep('done')
    onComplete(config)
  }, [apiKey, selectedModel, language, onComplete])

  if (step === 'language') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT} bold>SOULKILLER SETUP</Text>
        <Text> </Text>
        <Text color={PRIMARY}>Select Language / 选择语言 / 言語を選択</Text>
        <Text> </Text>
        {LANGUAGE_OPTIONS.map((opt, i) => (
          <Text key={opt.value} color={i === langCursor ? PRIMARY : DIM}>
            {i === langCursor ? '▸ ' : '  '}{opt.label}
          </Text>
        ))}
        <Text color={DIM} dimColor>  ↑↓ Enter</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>{t('setup.intro')}</Text>
      <Text> </Text>
      <Text color={DIM}>{t('setup.openrouter_desc')}</Text>
      <Text color={DIM}>{t('setup.openrouter_hint')}</Text>
      <Text> </Text>

      {step === 'intro' && (
        <TextInput
          prompt="OpenRouter API Key:"
          mask
          onSubmit={handleKeySubmit}
        />
      )}

      {step === 'api_key' && (
        <>
          {error && <Text color={WARNING}>✗ {error}</Text>}
          <TextInput
            prompt="OpenRouter API Key:"
            mask
            onSubmit={handleKeySubmit}
          />
        </>
      )}

      {step === 'validating' && (
        <Text color={DIM}>⠋ {t('setup.validating')}</Text>
      )}

      {step === 'model_select' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.key_valid')}{balance !== undefined ? ` · ${t('setup.balance', { amount: balance.toFixed(2) })}` : ''}</Text>
          <Text> </Text>
          <Text color={PRIMARY}>{t('setup.select_model')}</Text>
          <CheckboxSelect
            items={RECOMMENDED_MODELS.map((m) => ({
              value: m.id,
              label: `${m.name}  ${t(m.pricingKey)} · ${t(m.tagKey)}`,
              checked: m.id === RECOMMENDED_MODELS[0].id,
            }))}
            onSubmit={handleModelSelect}
          />
        </>
      )}

      {step === 'tavily_key' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.model_selected', { model: selectedModel })}</Text>
          <Text> </Text>
          <Text color={DIM}>{t('setup.tavily_desc')}</Text>
          <Text color={DIM}>{t('setup.tavily_optional')}</Text>
          <Text color={DIM}>{t('setup.tavily_url')}</Text>
          <Text> </Text>
          <TextInput
            prompt={t('setup.tavily_prompt')}
            mask
            onSubmit={handleTavilyKeySubmit}
          />
        </>
      )}

      {step === 'done' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.done')}</Text>
          <Text> </Text>
          <Text color={DIM}>{t('setup.next_create')}</Text>
          <Text color={DIM}>{t('setup.next_use')}</Text>
        </>
      )}
    </Box>
  )
}
