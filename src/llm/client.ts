import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { SoulkillerConfig } from '../config/schema.js'

let _model: LanguageModel | null = null
let _modelName: string = ''

/**
 * Append :exacto to OpenRouter model names for improved tool calling reliability.
 * Exacto routes to providers with better tool calling quality signals.
 * See: https://openrouter.ai/docs/guides/routing/model-variants/exacto
 */
export function withExacto(modelName: string): string {
  // Don't double-append; skip for non-OpenRouter or local models
  if (modelName.includes(':exacto') || !modelName.includes('/')) return modelName
  return `${modelName}:exacto`
}

/**
 * Create and cache the AI SDK LanguageModel from config.
 * Uses OpenRouter via @ai-sdk/openai-compatible.
 */
export function createLLMClient(config: SoulkillerConfig): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: config.llm.api_key,
    baseURL: process.env.SOULKILLER_API_URL ?? 'https://openrouter.ai/api/v1',
  })
  _modelName = config.llm.default_model
  _model = provider(_modelName)
  return _model
}

/**
 * Get the cached LanguageModel. Must call createLLMClient first.
 */
export function getLLMClient(): LanguageModel {
  if (!_model) {
    throw new Error('LLM client not initialized. Call createLLMClient first.')
  }
  return _model
}

/**
 * Get the model name string (for logging/display).
 */
export function getLLMModelName(): string {
  return _modelName
}

/**
 * Validate an OpenRouter API key by checking /auth/key endpoint.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; balance?: number; error?: string }> {
  try {
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
