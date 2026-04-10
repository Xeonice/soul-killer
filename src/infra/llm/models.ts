import { RECOMMENDED_MODELS } from '../../config/schema.js'

export function getRecommendedModels() {
  return RECOMMENDED_MODELS
}

export function findModel(id: string) {
  return RECOMMENDED_MODELS.find((m) => m.id === id)
}

export function suggestModelByUseCase(useCase: 'distill' | 'chat' | 'trial') {
  return RECOMMENDED_MODELS.filter((m) => m.useCase === useCase || useCase === 'chat')
}
