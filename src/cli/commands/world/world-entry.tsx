import React, { useState } from 'react'
import { Text, Box } from 'ink'
import { TextInput } from '../../components/text-input.js'
import { addEntry, type EntryMode, type EntryScope } from '../../../world/entry.js'
import { worldExists } from '../../../world/manifest.js'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'

type Step = 'name' | 'mode' | 'scope' | 'keywords' | 'priority' | 'content' | 'done' | 'error'

interface WorldEntryProps {
  worldName: string
  onComplete: () => void
}

export function WorldEntryCommand({ worldName, onComplete }: WorldEntryProps) {
  const [step, setStep] = useState<Step>(() => {
    if (!worldExists(worldName)) return 'error'
    return 'name'
  })
  const [entryName, setEntryName] = useState('')
  const [mode, setMode] = useState<EntryMode>('keyword')
  const [scope, setScope] = useState<EntryScope>('lore')
  const [keywords, setKeywords] = useState<string[]>([])
  const [priority, setPriority] = useState(100)
  const [errorMsg] = useState(() =>
    !worldExists(worldName) ? t('world.error.not_found', { name: worldName }) : '',
  )

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">ERROR: {errorMsg}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {t('world.entry.added', { name: entryName, world: worldName })}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>{t('world.entry.creating', { world: worldName })}</Text>

      {step === 'name' && (
        <Box>
          <Text color={DIM}>Entry name (kebab-case): </Text>
          <TextInput onSubmit={(v) => { setEntryName(v); setStep('mode') }} />
        </Box>
      )}

      {step === 'mode' && (
        <Box>
          <Text color={DIM}>Mode (always/keyword/semantic) [keyword]: </Text>
          <TextInput onSubmit={(v) => {
            const m = (['always', 'keyword', 'semantic'].includes(v) ? v : 'keyword') as EntryMode
            setMode(m)
            setStep('scope')
          }} />
        </Box>
      )}

      {step === 'scope' && (
        <Box>
          <Text color={DIM}>Scope (background/rule/lore/atmosphere) [lore]: </Text>
          <TextInput onSubmit={(v) => {
            const s = (['background', 'rule', 'lore', 'atmosphere'].includes(v) ? v : 'lore') as EntryScope
            setScope(s)
            setStep(mode === 'keyword' ? 'keywords' : 'priority')
          }} />
        </Box>
      )}

      {step === 'keywords' && (
        <Box>
          <Text color={DIM}>{t('world.entry.keywords_prompt')}: </Text>
          <TextInput onSubmit={(v) => {
            setKeywords(v.split(',').map((k) => k.trim()).filter(Boolean))
            setStep('priority')
          }} />
        </Box>
      )}

      {step === 'priority' && (
        <Box>
          <Text color={DIM}>Priority (0-1000) [100]: </Text>
          <TextInput onSubmit={(v) => {
            setPriority(v ? parseInt(v, 10) || 100 : 100)
            setStep('content')
          }} />
        </Box>
      )}

      {step === 'content' && (
        <Box>
          <Text color={DIM}>{t('world.entry.content_prompt')}: </Text>
          <TextInput onSubmit={(v) => {
            addEntry(worldName, { name: entryName, keywords, priority, mode, scope }, v)
            setStep('done')
          }} />
        </Box>
      )}
    </Box>
  )
}
