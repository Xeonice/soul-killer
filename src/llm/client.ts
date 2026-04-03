import OpenAI from 'openai'
import type { SoulkillerConfig } from '../config/schema.js'

let _client: OpenAI | null = null

export function createLLMClient(config: SoulkillerConfig): OpenAI {
  _client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.llm.api_key,
  })
  return _client
}

export function getLLMClient(): OpenAI {
  if (!_client) {
    throw new Error('LLM client not initialized. Call createLLMClient first.')
  }
  return _client
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; balance?: number; error?: string }> {
  try {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })
    // OpenRouter exposes /auth/key for key validation
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) {
      return { valid: false, error: `API returned ${response.status}` }
    }
    const data = (await response.json()) as { data?: { limit?: number; usage?: number } }
    const limit = data.data?.limit ?? 0
    const usage = data.data?.usage ?? 0
    return { valid: true, balance: limit > 0 ? limit - usage : undefined }
  } catch (err) {
    return { valid: false, error: String(err) }
  }
}
