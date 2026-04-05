import fs from 'node:fs'
import path from 'node:path'
import { worldExists } from './manifest.js'

export interface EntryFilter {
  include_scopes?: string[]
  exclude_entries?: string[]
  priority_boost?: Record<string, number>
}

export interface WorldBinding {
  world: string
  enabled: boolean
  order: number
  overrides?: {
    context_budget?: number
    injection_position?: 'before_soul' | 'after_soul' | 'interleaved'
  }
  entry_filter?: EntryFilter
  persona_context?: string
}

function bindingsDir(soulDir: string): string {
  return path.join(soulDir, 'bindings')
}

function bindingPath(soulDir: string, worldName: string): string {
  return path.join(bindingsDir(soulDir), `${worldName}.json`)
}

export function bindWorld(
  soulDir: string,
  worldName: string,
  options?: Partial<Omit<WorldBinding, 'world'>>,
): WorldBinding {
  if (!worldExists(worldName)) {
    throw new Error(`World "${worldName}" does not exist`)
  }

  const dir = bindingsDir(soulDir)
  fs.mkdirSync(dir, { recursive: true })

  const binding: WorldBinding = {
    world: worldName,
    enabled: options?.enabled ?? true,
    order: options?.order ?? 0,
    ...(options?.overrides && { overrides: options.overrides }),
    ...(options?.entry_filter && { entry_filter: options.entry_filter }),
    ...(options?.persona_context && { persona_context: options.persona_context }),
  }

  fs.writeFileSync(bindingPath(soulDir, worldName), JSON.stringify(binding, null, 2))
  return binding
}

export function unbindWorld(soulDir: string, worldName: string): void {
  const filePath = bindingPath(soulDir, worldName)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function loadBindings(soulDir: string): WorldBinding[] {
  const dir = bindingsDir(soulDir)
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
      return JSON.parse(raw) as WorldBinding
    })
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order)
}

export function loadBinding(soulDir: string, worldName: string): WorldBinding | null {
  const filePath = bindingPath(soulDir, worldName)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorldBinding
}

export function updateBinding(soulDir: string, binding: WorldBinding): void {
  const dir = bindingsDir(soulDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(bindingPath(soulDir, binding.world), JSON.stringify(binding, null, 2))
}
