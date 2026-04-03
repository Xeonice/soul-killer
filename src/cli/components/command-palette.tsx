import React from 'react'
import { Text, Box } from 'ink'
import type { CommandDef } from '../command-registry.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'

interface CommandPaletteProps {
  items: CommandDef[]
  selectedIndex: number
  maxVisible?: number
  title?: string
  showSlash?: boolean
}

export function CommandPalette({
  items,
  selectedIndex,
  maxVisible = 8,
  title = 'COMMANDS',
  showSlash = true,
}: CommandPaletteProps) {
  if (items.length === 0) return null

  // Calculate scroll window
  const total = items.length
  const windowSize = Math.min(total, maxVisible)
  let startIdx = 0

  if (total > maxVisible) {
    // Keep selected item in view
    const halfWindow = Math.floor(windowSize / 2)
    startIdx = Math.max(0, Math.min(selectedIndex - halfWindow, total - windowSize))
  }

  const visibleItems = items.slice(startIdx, startIdx + windowSize)
  const hasMore = total > maxVisible

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={PRIMARY}
      width={44}
    >
      <Text color={ACCENT} bold> {title} </Text>
      {visibleItems.map((item, i) => {
        const absoluteIdx = startIdx + i
        const isSelected = absoluteIdx === selectedIndex
        return (
          <Text key={item.name}>
            <Text color={isSelected ? PRIMARY : DIM}>
              {isSelected ? ' ❯ ' : '   '}
            </Text>
            <Text color={isSelected ? PRIMARY : DIM}>
              {showSlash ? '/' : ''}{item.name.padEnd(showSlash ? 14 : 15)}
            </Text>
            <Text color={DIM}>
              {item.description}
            </Text>
          </Text>
        )
      })}
      {hasMore && (
        <Text color={DIM}>   ({total} commands, scroll with ↑↓)</Text>
      )}
    </Box>
  )
}
