import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { SharedV3ProviderOptions } from '@ai-sdk/provider'
import type { SoulkillerConfig } from '../../config/schema.js'

let _model: LanguageModel | null = null
let _modelName: string = ''

/**
 * Models whose reasoning/thinking stream format is incompatible with
 * @ai-sdk/openai-compatible (e.g. delta.reasoning field not recognized).
 * For these models, we disable reasoning via providerOptions to get
 * standard non-reasoning responses.
 */
const REASONING_INCOMPATIBLE_MODELS = [
  'qwen/qwen3.5-plus',
  'qwen/qwen3.5-flash',
  'qwen/qwen3.5-',      // all open-weight qwen3.5 variants
  'qwen/qwen3.6-plus',
  'minimax/minimax-m2.7',
]

/**
 * Models that don't support `toolChoice: 'required'` on OpenRouter.
 * These will use 'auto' instead.
 */
const NO_TOOL_CHOICE_REQUIRED = [
  'qwen/qwen3.6-plus',
  'minimax/minimax-m2.7',
]

/**
 * Returns the appropriate toolChoice value for the given model.
 * Some models (e.g. Qwen 3.6 Plus) don't support 'required' on OpenRouter.
 */
export function getToolChoice(modelName: string, preferred: 'auto' | 'required'): 'auto' | 'required' {
  if (preferred === 'required' && NO_TOOL_CHOICE_REQUIRED.some((m) => modelName.startsWith(m))) {
    return 'auto'
  }
  return preferred
}

/**
 * Returns extra providerOptions for the given model. Currently used to
 * disable reasoning for models whose thinking format is incompatible
 * with the AI SDK's OpenAI-compatible provider.
 */
export function getProviderOptions(modelName: string): SharedV3ProviderOptions | undefined {
  if (REASONING_INCOMPATIBLE_MODELS.some((m) => modelName.startsWith(m))) {
    return { openrouter: { reasoning: { effort: 'none' } } } as SharedV3ProviderOptions
  }
  return undefined
}

/**
 * Models known to work reliably with the :exacto routing variant on OpenRouter.
 * Other models may not have multiple providers or may fail silently with :exacto.
 */
const EXACTO_COMPATIBLE_MODELS = [
  'z-ai/glm-5-turbo',
  'z-ai/glm-5',
  'deepseek/deepseek-chat',
  'anthropic/claude-sonnet-4.6',
]

/**
 * Append :exacto to OpenRouter model names for improved tool calling reliability.
 * Only applies to models known to have multiple providers on OpenRouter.
 * See: https://openrouter.ai/docs/guides/routing/model-variants/exacto
 */
export function withExacto(modelName: string): string {
  if (modelName.includes(':exacto') || !modelName.includes('/')) return modelName
  if (!EXACTO_COMPATIBLE_MODELS.some((m) => modelName.startsWith(m))) return modelName
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
