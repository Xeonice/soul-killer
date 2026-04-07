import { streamText, type LanguageModel } from 'ai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream chat completion from OpenRouter, yielding text chunks.
 */
export async function* streamChat(
  model: LanguageModel,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const result = streamText({
    model,
    messages,
  })

  for await (const chunk of result.textStream) {
    yield chunk
  }
}
