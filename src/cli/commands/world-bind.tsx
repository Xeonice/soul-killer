import React, { useState } from 'react'
import { Text, Box } from 'ink'
import { TextInput } from '../components/text-input.js'
import { bindWorld, unbindWorld, loadBinding } from '../../world/binding.js'
import { worldExists } from '../../world/manifest.js'
import { PRIMARY, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'

interface WorldBindProps {
  worldName: string
  soulDir: string
  action: 'bind' | 'unbind'
  onComplete: () => void
}

export function WorldBindCommand({ worldName, soulDir, action, onComplete }: WorldBindProps) {
  const [step, setStep] = useState<'order' | 'done' | 'error'>(() => {
    if (action === 'unbind') {
      return 'done'
    }
    if (!worldExists(worldName)) return 'error'
    return 'order'
  })
  const [message, setMessage] = useState(() => {
    if (action === 'unbind') {
      unbindWorld(soulDir, worldName)
      return t('world.unbound', { name: worldName })
    }
    if (!worldExists(worldName)) return t('world.error.not_found', { name: worldName })
    return ''
  })

  if (step === 'error') {
    setTimeout(onComplete, 100)
    return <Text color="red">{message}</Text>
  }

  if (step === 'done') {
    setTimeout(onComplete, 100)
    return <Text color={PRIMARY}>✓ {message}</Text>
  }

  return (
    <Box flexDirection="column">
      {step === 'order' && (
        <Box>
          <Text color={DIM}>Priority order (0 = highest) [0]: </Text>
          <TextInput onSubmit={(v) => {
            const order = v ? parseInt(v, 10) || 0 : 0
            try {
              bindWorld(soulDir, worldName, { order })
              setMessage(t('world.bound', { name: worldName }))
              setStep('done')
            } catch (err) {
              setMessage(String(err))
              setStep('error')
            }
          }} />
        </Box>
      )}
    </Box>
  )
}
