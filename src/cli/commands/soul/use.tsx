import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { RelicLoadAnimation } from '../../animation/relic-load-animation.js'
import { PRIMARY, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

interface UseCommandProps {
  name: string
  onComplete: (soulDir: string) => void
}

interface SoulManifest {
  chunk_count?: number
  languages?: string[]
}

export function UseCommand({ name, onComplete }: UseCommandProps) {
  const [status, setStatus] = useState<'checking' | 'animating' | 'not-found'>('checking')
  const [manifest, setManifest] = useState<SoulManifest>({})
  const soulDir = path.join(SOULS_DIR, name)

  useEffect(() => {
    if (fs.existsSync(soulDir)) {
      // Load manifest for animation
      const manifestPath = path.join(soulDir, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SoulManifest
          setManifest(data)
        } catch {
          // Use defaults
        }
      }
      setStatus('animating')
    } else {
      setStatus('not-found')
    }
  }, [name, soulDir])

  if (status === 'checking') {
    return (
      <Box paddingLeft={2}>
        <Text color={PRIMARY}>▓ {t('use.checking', { name })}</Text>
      </Box>
    )
  }

  if (status === 'not-found') {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={DIM}>✗ {t('use.not_found', { name })}</Text>
        <Text color={DIM}>  {t('use.local_path')}: {soulDir}</Text>
        <Text color={DIM}>  {t('use.remote_not_ready')}</Text>
      </Box>
    )
  }

  return (
    <RelicLoadAnimation
      soulName={name}
      chunkCount={manifest.chunk_count}
      languages={manifest.languages}
      onComplete={() => onComplete(soulDir)}
    />
  )
}
