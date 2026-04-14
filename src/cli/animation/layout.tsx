import React from 'react'
import { Box } from 'ink'

export function getContentWidth(termWidth = process.stdout.columns ?? 80): number {
  return Math.min(130, termWidth - 4)
}

interface CenteredStageProps {
  children: React.ReactNode
}

export function CenteredStage({ children }: CenteredStageProps) {
  const termWidth = process.stdout.columns ?? 80
  const contentWidth = getContentWidth(termWidth)
  return (
    <Box flexDirection="column" alignItems="center" width={termWidth}>
      <Box flexDirection="column" alignItems="center" width={contentWidth}>
        {children}
      </Box>
    </Box>
  )
}
