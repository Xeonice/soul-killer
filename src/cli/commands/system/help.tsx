import React from 'react'
import { Text, Box } from 'ink'
import { getCommandGroups } from '../../command-registry.js'
import { PRIMARY, ACCENT, DIM } from '../../animation/colors.js'
import { t } from '../../../infra/i18n/index.js'

export function HelpCommand() {
  const groups = getCommandGroups()

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>SOULKILLER v0.1.0 — Commands</Text>
      <Text> </Text>
      {groups.map((group) => (
        <Box key={group.title} flexDirection="column" marginBottom={1}>
          <Text color={PRIMARY} bold>{group.title}</Text>
          {group.commands.map((cmd) => (
            <Text key={cmd.name}>
              <Text color={PRIMARY}>  /{cmd.name.padEnd(21)}</Text>
              <Text color={DIM}>{cmd.description}</Text>
            </Text>
          ))}
        </Box>
      ))}
      <Text color={DIM}>{t('help.chat_hint')}</Text>
    </Box>
  )
}
