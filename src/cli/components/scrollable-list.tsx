import React from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM } from '../animation/colors.js'

interface ScrollableListProps<T> {
  items: T[]
  cursor: number
  maxVisible?: number
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode
  emptyMessage?: string
  title?: string
  hint?: string
}

export function ScrollableList<T>({
  items,
  cursor,
  maxVisible = 10,
  renderItem,
  emptyMessage,
  title,
  hint,
}: ScrollableListProps<T>) {
  if (items.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        {title && <Text color={PRIMARY} bold>{title}</Text>}
        {emptyMessage && <Text color={DIM}>  {emptyMessage}</Text>}
      </Box>
    )
  }

  const total = items.length
  const windowSize = Math.min(total, maxVisible)
  let windowStart = 0

  if (total > maxVisible) {
    windowStart = Math.max(0, Math.min(cursor - 3, total - windowSize))
  }

  const windowEnd = windowStart + windowSize
  const visibleItems = items.slice(windowStart, windowEnd)
  const hasAbove = windowStart > 0
  const hasBelow = windowEnd < total

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {title && <Text color={PRIMARY} bold>{title}</Text>}
      {hint && <Text color={DIM}>  {hint}</Text>}
      {(title || hint) && <Text> </Text>}
      {hasAbove && (
        <Text color={DIM}>    ▲ {windowStart} more</Text>
      )}
      {visibleItems.map((item, vi) => {
        const absoluteIdx = windowStart + vi
        const focused = absoluteIdx === cursor
        return (
          <Box key={absoluteIdx} flexDirection="column">
            {renderItem(item, absoluteIdx, focused)}
          </Box>
        )
      })}
      {hasBelow && (
        <Text color={DIM}>    ▼ {total - windowEnd} more</Text>
      )}
    </Box>
  )
}
