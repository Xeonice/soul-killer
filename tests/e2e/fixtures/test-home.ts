import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { stringify } from 'yaml'
import type { SoulkillerConfig } from '../../../src/config/schema.js'

export interface TestHome {
  homeDir: string
  configPath: string
  soulsDir: string
  cleanup: () => void
}

export function createTestHome(opts?: {
  mockServerUrl?: string
}): TestHome {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-test-'))
  const soulkillerDir = path.join(homeDir, '.soulkiller')
  const soulsDir = path.join(soulkillerDir, 'souls')
  const configPath = path.join(soulkillerDir, 'config.yaml')

  fs.mkdirSync(soulsDir, { recursive: true })

  const config: SoulkillerConfig = {
    llm: {
      provider: 'openrouter',
      api_key: 'test-key-for-e2e',
      default_model: 'test/model',
    },
    language: 'en',
    animation: false,
  }

  fs.writeFileSync(configPath, stringify(config), 'utf-8')

  return {
    homeDir,
    configPath,
    soulsDir,
    cleanup: () => {
      fs.rmSync(homeDir, { recursive: true, force: true })
    },
  }
}
