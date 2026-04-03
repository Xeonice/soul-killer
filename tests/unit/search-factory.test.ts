import { describe, it, expect } from 'vitest'
import { createSearchTools } from '../../src/agent/tools/search-factory.js'
import type { SoulkillerConfig } from '../../src/config/schema.js'

describe('SearchFactory', () => {
  it('returns schemas and executors when tavily key is configured', () => {
    const config: SoulkillerConfig = {
      llm: { provider: 'openrouter', api_key: 'test', default_model: 'test' },
      search: { tavily_api_key: 'tvly-test' },
    }
    const { schemas, executors } = createSearchTools(config)
    expect(schemas.search).toBeDefined()
    expect(schemas.wikipedia).toBeDefined()
    expect(executors.search).toBeTypeOf('function')
    expect(executors.wikipedia).toBeTypeOf('function')
  })

  it('returns schemas and executors when no tavily key', () => {
    const config: SoulkillerConfig = {
      llm: { provider: 'openrouter', api_key: 'test', default_model: 'test' },
    }
    const { schemas, executors } = createSearchTools(config)
    expect(schemas.search).toBeDefined()
    expect(executors.search).toBeTypeOf('function')
  })

  it('returns schemas and executors when tavily key is empty', () => {
    const config: SoulkillerConfig = {
      llm: { provider: 'openrouter', api_key: 'test', default_model: 'test' },
      search: { tavily_api_key: '' },
    }
    const { schemas, executors } = createSearchTools(config)
    expect(schemas.search).toBeDefined()
    expect(executors.search).toBeTypeOf('function')
  })
})
