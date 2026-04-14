export type SupportedLanguage = 'zh' | 'ja' | 'en'

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh', 'ja', 'en']

export type SearchProvider = 'exa' | 'tavily'

export interface SoulkillerConfig {
  llm: {
    provider: 'openrouter'
    api_key: string
    default_model: string
    distill_model?: string
  }
  search?: {
    provider?: SearchProvider
    tavily_api_key?: string
    exa_api_key?: string
  }
  language: SupportedLanguage
  animation: boolean
}

export const DEFAULT_CONFIG: Partial<SoulkillerConfig> = {
  llm: {
    provider: 'openrouter',
    api_key: '',
    default_model: 'google/gemini-2.5-flash',
  },
  language: 'zh',
  animation: true,
}

export interface RecommendedModel {
  id: string
  name: string
  pricingKey: string
  tagKey: string
  useCase: string
}

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    pricingKey: 'model.pricing.gemini_flash',
    tagKey: 'model.tag.recommended',
    useCase: 'distill',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat v3',
    pricingKey: 'model.pricing.deepseek',
    tagKey: 'model.tag.cheapest',
    useCase: 'chat',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    pricingKey: 'model.pricing.claude_sonnet',
    tagKey: 'model.tag.quality',
    useCase: 'distill',
  },
  {
    id: 'z-ai/glm-5-turbo',
    name: 'GLM-5 Turbo',
    pricingKey: 'model.pricing.glm5_turbo',
    tagKey: 'model.tag.agent',
    useCase: 'chat',
  },
  {
    id: 'qwen/qwen3.5-plus-02-15',
    name: 'Qwen 3.5 Plus',
    pricingKey: 'model.pricing.qwen35',
    tagKey: 'model.tag.cheapest',
    useCase: 'chat',
  },
  {
    id: 'minimax/minimax-m2.7',
    name: 'MiniMax M2.7',
    pricingKey: 'model.pricing.minimax27',
    tagKey: 'model.tag.cheapest',
    useCase: 'chat',
  },
  {
    id: 'openrouter/auto',
    name: 'Auto (OpenRouter)',
    pricingKey: 'model.pricing.auto',
    tagKey: 'model.tag.auto',
    useCase: 'chat',
  },
]
