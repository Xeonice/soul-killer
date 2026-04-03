import React from 'react'
import { Text, Box } from 'ink'
import type { PathItem } from '../path-resolver.js'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'

interface PathPaletteProps {
  items: PathItem[]
  selectedIndex: number
  maxVisible?: number
}

export function PathPalette({
  items,
  selectedIndex,
  maxVisible = 8,
}: PathPaletteProps) {
  if (items.length === 0) return null

  const total = items.length
  const windowSize = Math.min(total, maxVisible)
  let startIdx = 0

  if (total > maxVisible) {
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
      width={50}
    >
      <Text color={ACCENT} bold> PATH </Text>
      {visibleItems.map((item, i) => {
        const absoluteIdx = startIdx + i
        const isSelected = absoluteIdx === selectedIndex
        const displayName = item.isDirectory ? `${item.name}/` : item.name
        const icon = item.isDirectory ? '📁' : '📄'

        return (
          <Text key={item.fullPath}>
            <Text color={isSelected ? PRIMARY : DIM}>
              {isSelected ? ' ❯ ' : '   '}
            </Text>
            <Text>{icon} </Text>
            <Text color={item.isDirectory ? PRIMARY : DIM}>
              {displayName}
            </Text>
          </Text>
        )
      })}
      {hasMore && (
        <Text color={DIM}>   ({total} entries, scroll with ↑↓)</Text>
      )}
    </Box>
  )
}
