import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { PRIMARY, DIM } from '../animation/colors.js'
import { t } from '../../i18n/index.js'
import type { SoulManifest } from '../../soul/manifest.js'

const SOULS_DIR = path.join(os.homedir(), '.soulkiller', 'souls')

interface SoulEntry {
  name: string
  chunkCount: number | null
}

export function ListCommand() {
  const [souls, setSouls] = useState<SoulEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const entries: SoulEntry[] = []

    if (fs.existsSync(SOULS_DIR)) {
      const dirs = fs.readdirSync(SOULS_DIR, { withFileTypes: true })
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue
        const manifestPath = path.join(SOULS_DIR, dir.name, 'manifest.json')
        let chunkCount: number | null = null
        if (fs.existsSync(manifestPath)) {
          try {
            const raw = fs.readFileSync(manifestPath, 'utf-8')
            const manifest = JSON.parse(raw) as SoulManifest
            chunkCount = manifest.chunk_count
          } catch {
            // ignore parse errors
          }
        }
        entries.push({ name: dir.name, chunkCount })
      }
    }

    setSouls(entries)
    setLoaded(true)
  }, [])

  if (!loaded) {
    return (
      <Box paddingLeft={2}>
        <Text color={PRIMARY}>▓ {t('list.scanning')}</Text>
      </Box>
    )
  }

  if (souls.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text color={DIM}>{t('list.empty')}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={PRIMARY} bold>{t('list.title')}</Text>
      <Text> </Text>
      {souls.map((s) => (
        <Text key={s.name}>
          <Text color={PRIMARY}>  ◈ {s.name.padEnd(20)}</Text>
          <Text color={DIM}>
            {s.chunkCount !== null ? `${s.chunkCount} chunks` : 'no manifest'}
          </Text>
        </Text>
      ))}
    </Box>
  )
}
