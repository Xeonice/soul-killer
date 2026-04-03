import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parse, stringify } from 'yaml'
import type { SoulkillerConfig } from './schema.js'

const SOULKILLER_DIR = path.join(os.homedir(), '.soulkiller')
const CONFIG_PATH = path.join(SOULKILLER_DIR, 'config.yaml')

export function getConfigDir(): string {
  return SOULKILLER_DIR
}

export function getConfigPath(): string {
  return CONFIG_PATH
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH)
}

export function loadConfig(): SoulkillerConfig | null {
  if (!configExists()) return null
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  const config = parse(raw) as SoulkillerConfig
  // Fill in defaults for fields added after initial config creation
  if (config.language === undefined) config.language = 'zh'
  if (config.animation === undefined) config.animation = true
  return config
}

export function saveConfig(config: SoulkillerConfig): void {
  if (!fs.existsSync(SOULKILLER_DIR)) {
    fs.mkdirSync(SOULKILLER_DIR, { recursive: true })
  }
  fs.writeFileSync(CONFIG_PATH, stringify(config), 'utf-8')
}

export function isConfigured(): boolean {
  const config = loadConfig()
  return config !== null && config.llm?.api_key !== ''
}
