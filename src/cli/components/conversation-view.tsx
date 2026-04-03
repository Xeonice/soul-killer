import React from 'react'
import { Text, Box } from 'ink'
import { PRIMARY, ACCENT, DIM, DARK } from '../animation/colors.js'
import { isAnimationEnabled } from '../animation/use-animation.js'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationViewProps {
  messages: ConversationMessage[]
  soulName: string
  isThinking: boolean
  isStreaming: boolean
  streamContent?: string
  maxTurns?: number
}

const MAX_DISPLAY_TURNS = 20

export function ConversationView({
  messages,
  soulName,
  isThinking,
  isStreaming,
  streamContent,
  maxTurns = MAX_DISPLAY_TURNS,
}: ConversationViewProps) {
  // Limit displayed messages to recent turns (1 turn = user + assistant)
  const maxMessages = maxTurns * 2
  const displayMessages = messages.length > maxMessages
    ? messages.slice(-maxMessages)
    : messages

  return (
    <Box flexDirection="column">
      {displayMessages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={msg.role === 'assistant' ? 1 : 0}>
          {msg.role === 'user' && (
            <Text color={DIM}>❯ {msg.content}</Text>
          )}
          {msg.role === 'assistant' && (
            <>
              <Text color={PRIMARY} bold>◈ {soulName}</Text>
              <Text color={ACCENT}>{msg.content}</Text>
              {i < displayMessages.length - 1 && displayMessages[i + 1]?.role === 'user' && (
                <Text color={DARK}>{'─'.repeat(40)}</Text>
              )}
            </>
          )}
        </Box>
      ))}

      {/* Current streaming response */}
      {(isThinking || isStreaming) && (
        <Box flexDirection="column">
          {/* Show user's latest message if not yet in messages (already pushed) */}
          <Text color={PRIMARY} bold>◈ {soulName}</Text>
          {isThinking && !isStreaming && (
            <ThinkingSpinner />
          )}
          {isStreaming && streamContent && (
            <Text color={ACCENT}>{streamContent}</Text>
          )}
        </Box>
      )}
    </Box>
  )
}

function ThinkingSpinner() {
  const [frame, setFrame] = React.useState(0)
  const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  const animationEnabled = isAnimationEnabled()

  React.useEffect(() => {
    if (!animationEnabled) return
    const timer = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80)
    return () => clearInterval(timer)
  }, [animationEnabled])

  return (
    <Text color={DIM}>
      {animationEnabled ? SPINNER[frame] : '⠿'} scanning memory cortex...
    </Text>
  )
}
