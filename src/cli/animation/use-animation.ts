import { loadConfig } from '../../config/loader.js'

export function isAnimationEnabled(): boolean {
  const config = loadConfig()
  return config?.animation !== false
}
