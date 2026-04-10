import React from 'react'
import { Text, Box } from 'ink'
import { listWorlds, loadWorld } from '../../../world/manifest.js'
import { loadAllEntries } from '../../../world/entry.js'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'

interface WorldListProps {
  // no props needed
}

export function WorldListCommand({}: WorldListProps) {
  const worlds = listWorlds()

  if (worlds.length === 0) {
    return <Text color={DIM}>{t('world.list.empty')}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color={PRIMARY} bold>{t('world.list.title')}</Text>
      <Text color={DIM}>{'─'.repeat(50)}</Text>
      {worlds.map((w) => (
        <Box key={w.name} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={ACCENT}>{w.name}</Text>
            <Text color={DIM}> ({w.display_name}) v{w.version}</Text>
          </Box>
          <Text color={DIM}>  {w.description}</Text>
          <Text color={DIM}>  {t('world.list.entries')}: {w.entry_count}</Text>
        </Box>
      ))}
    </Box>
  )
}

interface WorldShowProps {
  worldName: string
}

export function WorldShowCommand({ worldName }: WorldShowProps) {
  const manifest = loadWorld(worldName)

  if (!manifest) {
    return <Text color="red">{t('world.error.not_found', { name: worldName })}</Text>
  }

  const entries = loadAllEntries(worldName)

  return (
    <Box flexDirection="column">
      <Text color={PRIMARY} bold>{manifest.display_name}</Text>
      <Text color={DIM}>Name: {manifest.name} | Version: {manifest.version}</Text>
      <Text color={DIM}>Description: {manifest.description}</Text>
      <Text color={DIM}>Budget: {manifest.defaults.context_budget} tokens | Position: {manifest.defaults.injection_position}</Text>
      <Text color={DIM}>{'─'.repeat(50)}</Text>

      {entries.length === 0 ? (
        <Text color={DIM}>{t('world.show.no_entries')}</Text>
      ) : (
        entries.map((e) => (
          <Box key={e.meta.name} marginBottom={1}>
            <Text color={ACCENT}>{e.meta.name}</Text>
            <Text color={DIM}> [{e.meta.mode}/{e.meta.scope}] p:{e.meta.priority}</Text>
            {e.meta.keywords.length > 0 && (
              <Text color={DIM}> kw:[{e.meta.keywords.join(',')}]</Text>
            )}
          </Box>
        ))
      )}
    </Box>
  )
}
