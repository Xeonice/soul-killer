import React, { useState, useCallback } from 'react'
import { Text, Box, useInput } from 'ink'
import { TextInput, CheckboxSelect } from '../cli/components/text-input.js'
import { validateApiKey } from '../infra/llm/client.js'
import { RECOMMENDED_MODELS, type SoulkillerConfig, type SupportedLanguage, type SearchProvider } from './schema.js'
import { saveConfig } from './loader.js'
import { PRIMARY, ACCENT, WARNING, DIM } from '../cli/animation/colors.js'
import { t, setLocale } from '../infra/i18n/index.js'
import { isDockerAvailable } from '../infra/search/searxng-search.js'

type Step = 'language' | 'intro' | 'api_key' | 'validating' | 'model_select' | 'search_engine' | 'exa_key' | 'tavily_key' | 'done'

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
  const [searchCursor, setSearchCursor] = useState(0)
  const [dockerAvailable, setDockerAvailable] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useInput((_, key) => {
    if (step === 'language') {
      if (key.upArrow) setLangCursor((i) => Math.max(0, i - 1))
      if (key.downArrow) setLangCursor((i) => Math.min(LANGUAGE_OPTIONS.length - 1, i + 1))
      if (key.return) {
        const selected = LANGUAGE_OPTIONS[langCursor]!.value
        setLanguage(selected)
        setLocale(selected)
        setStep('intro')
      }
    } else if (step === 'search_engine') {
      if (key.upArrow) setSearchCursor((i) => Math.max(0, i - 1))
      if (key.downArrow) setSearchCursor((i) => Math.min(2, i + 1))
      if (key.return) {
        setSearchError(null)
        if (searchCursor === 0) {
          // SearXNG
          if (dockerAvailable) {
            finishSetup('searxng')
          } else {
            setSearchError(t('setup.searxng_docker_not_found'))
          }
        } else if (searchCursor === 1) {
          // Exa
          setStep('exa_key')
        } else {
          // Tavily
          setStep('tavily_key')
        }
      }
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
    setDockerAvailable(isDockerAvailable())
    setStep('search_engine')
  }, [])

  const handleExaKeySubmit = useCallback((key: string) => {
    if (!key.trim()) {
      setStep('search_engine')
      return
    }
    finishSetup('exa', undefined, key.trim())
  }, [apiKey, selectedModel, language])

  const handleTavilyKeySubmit = useCallback((key: string) => {
    if (!key.trim()) {
      setStep('search_engine')
      return
    }
    finishSetup('tavily', key.trim())
  }, [apiKey, selectedModel, language])

  const finishSetup = useCallback((searchProvider: SearchProvider, tavilyKey?: string, exaKey?: string) => {
    const config: SoulkillerConfig = {
      llm: {
        provider: 'openrouter',
        api_key: apiKey,
        default_model: selectedModel,
      },
      language,
      animation: true,
      search: {
        provider: searchProvider,
        ...(tavilyKey ? { tavily_api_key: tavilyKey } : {}),
        ...(exaKey ? { exa_api_key: exaKey } : {}),
      },
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

      {step === 'search_engine' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.model_selected', { model: selectedModel })}</Text>
          <Text> </Text>
          <Text color={PRIMARY}>{t('setup.searxng_prompt')}</Text>
          <Text> </Text>
          {[
            `SearXNG  ${t('setup.searxng_desc')}`,
            `Exa      ${t('setup.exa_desc')}`,
            `Tavily   ${t('setup.tavily_desc')}`,
          ].map((label, i) => (
            <Text key={i} color={i === searchCursor ? PRIMARY : DIM}>
              {i === searchCursor ? '▸ ' : '  '}{label}
            </Text>
          ))}
          <Text> </Text>
          {dockerAvailable
            ? <Text color={PRIMARY}>{t('setup.searxng_docker_detected')}</Text>
            : <Text color={WARNING}>{t('setup.searxng_docker_not_found')}</Text>
          }
          {searchError && <Text color={WARNING}>  {searchError}</Text>}
          <Text color={DIM} dimColor>  ↑↓ Enter</Text>
        </>
      )}

      {step === 'exa_key' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.searxng_prompt')}: Exa</Text>
          <Text> </Text>
          <Text color={DIM}>{t('setup.exa_url')}</Text>
          <Text> </Text>
          <TextInput
            prompt={t('setup.exa_prompt')}
            mask
            onSubmit={handleExaKeySubmit}
          />
          <Text color={DIM}>  {t('setup.tavily_back')}</Text>
        </>
      )}

      {step === 'tavily_key' && (
        <>
          <Text color={PRIMARY}>✓ {t('setup.searxng_prompt')}: Tavily</Text>
          <Text> </Text>
          <Text color={DIM}>{t('setup.tavily_url')}</Text>
          <Text> </Text>
          <TextInput
            prompt={t('setup.tavily_prompt')}
            mask
            onSubmit={handleTavilyKeySubmit}
          />
          <Text color={DIM}>  {t('setup.tavily_back')}</Text>
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
