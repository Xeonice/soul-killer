import React from 'react'
import { Text, Box } from 'ink'
import { RECOMMENDED_MODELS } from '../../config/schema.js'
import { loadConfig, saveConfig } from '../../config/loader.js'
import { PRIMARY, ACCENT, DIM, WARNING } from '../animation/colors.js'
import { t } from '../../i18n/index.js'

interface ModelCommandProps {
  args: string
}

export function ModelCommand({ args }: ModelCommandProps) {
  const config = loadConfig()
  if (!config) {
    return <Text color={WARNING}>{t('model.not_initialized')}</Text>
  }

  // /model — show current
  if (!args) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={PRIMARY}>{t('model.current')}: <Text bold>{config.llm.default_model}</Text></Text>
        {config.llm.distill_model && (
          <Text color={DIM}>{t('model.distill')}: {config.llm.distill_model}</Text>
        )}
        <Text> </Text>
        <Text color={ACCENT}>{t('model.available')}:</Text>
        {RECOMMENDED_MODELS.map((m) => (
          <Text key={m.id}>
            <Text color={m.id === config.llm.default_model ? PRIMARY : DIM}>
              {m.id === config.llm.default_model ? '  ◉ ' : '  ◯ '}
            </Text>
            <Text color={DIM}>{m.id.padEnd(38)}{t(m.pricingKey)} · {t(m.tagKey)}</Text>
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM}>{t('model.switch_hint')}</Text>
      </Box>
    )
  }

  // /model suggest
  if (args === 'suggest') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={ACCENT}>{t('model.suggest_title')}:</Text>
        <Text color={PRIMARY}>  {t('model.suggest_distill')}</Text>
        <Text color={PRIMARY}>  {t('model.suggest_chat')}</Text>
        <Text color={PRIMARY}>  {t('model.suggest_long_ctx')}</Text>
        <Text color={PRIMARY}>  {t('model.suggest_free')}</Text>
      </Box>
    )
  }

  // /model <id> — switch
  const newModel = args.trim()
  config.llm.default_model = newModel
  saveConfig(config)

  return (
    <Text color={PRIMARY}>✓ {t('model.switched', { model: newModel })}</Text>
  )
}
