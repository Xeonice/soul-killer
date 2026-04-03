import type OpenAI from 'openai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream chat completion from OpenRouter, yielding text chunks.
 */
export async function* streamChat(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      yield delta
    }
  }
}
