import type { WorldEntry } from './entry.js'
import type { WorldBinding } from './binding.js'
import type { WorldManifest } from './manifest.js'
import type { ResolvedEntry } from './resolver.js'
import { resolveEntries, resolveSemanticEntries } from './resolver.js'
import { renderTemplate, type TemplateContext } from './template.js'
import { loadAllEntries } from './entry.js'
import { loadWorld } from './manifest.js'
import type { EngineAdapter, RecallResult } from '../engine/adapter.js'
import type { ChatMessage } from '../llm/stream.js'
import type { TagSet } from '../tags/taxonomy.js'
import { t } from '../i18n/index.js'

export interface SoulFiles {
  identity: string
  style: string
  behaviors: Record<string, string>
  examples: Record<string, string>
}

export interface AssemblyInput {
  soulFiles: SoulFiles
  soulName: string
  soulDisplayName: string
  soulTags: TagSet
  bindings: WorldBinding[]
  userInput: string
  recentMessages: ChatMessage[]
  recallResults: RecallResult[]
  engine?: EngineAdapter
}

const TOKENS_PER_CHAR = 1 / 3

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR)
}

export async function assembleContext(input: AssemblyInput): Promise<string> {
  const {
    soulFiles,
    soulName,
    soulDisplayName,
    soulTags,
    bindings,
    userInput,
    recentMessages,
    recallResults,
    engine,
  } = input

  // If no bindings, fallback to original buildSystemPrompt behavior
  if (bindings.length === 0) {
    return buildLegacyPrompt(soulFiles)
  }

  // Collect all resolved entries from all worlds
  const allResolved: ResolvedEntry[] = []
  const worldManifests = new Map<string, WorldManifest>()

  for (const binding of bindings) {
    const manifest = loadWorld(binding.world)
    if (!manifest) continue
    worldManifests.set(binding.world, manifest)

    const entries = loadAllEntries(binding.world)

    // Resolve always + keyword entries
    const resolved = resolveEntries(entries, binding, userInput, recentMessages)
    allResolved.push(...resolved)

    // Resolve semantic entries if engine is available
    if (engine) {
      const semanticResolved = await resolveSemanticEntries(
        entries,
        binding,
        userInput,
        engine,
      )
      allResolved.push(...semanticResolved)
    }
  }

  // Deduplicate: same entry name → keep highest priority (lowest order world)
  const deduped = deduplicateEntries(allResolved)

  // Split by category — each entry goes to exactly one bucket
  const alwaysBefore: ResolvedEntry[] = []
  const triggered: ResolvedEntry[] = []
  const atmosphere: ResolvedEntry[] = []

  for (const r of deduped) {
    if (r.entry.meta.scope === 'atmosphere') {
      atmosphere.push(r)
    } else if (
      r.entry.meta.mode === 'always' &&
      (r.entry.meta.scope === 'background' || r.entry.meta.scope === 'rule')
    ) {
      alwaysBefore.push(r)
    } else {
      triggered.push(r)
    }
  }

  // Sort by effective priority (descending)
  alwaysBefore.sort((a, b) => b.effectivePriority - a.effectivePriority)
  triggered.sort((a, b) => b.effectivePriority - a.effectivePriority)

  // Build template context
  const firstWorld = bindings[0]
  const firstManifest = worldManifests.get(firstWorld?.world ?? '')
  const templateCtx: TemplateContext = {
    soul: {
      name: soulName,
      display_name: soulDisplayName,
      identity: soulFiles.identity,
      tags: soulTags,
    },
    world: {
      name: firstManifest?.name ?? '',
      display_name: firstManifest?.display_name ?? '',
    },
    entries: buildEntriesMap(deduped),
  }

  // Apply token budget per world
  const budgetedTriggered = applyBudget(triggered, bindings, worldManifests)

  // Assemble parts
  const parts: string[] = []

  // 1. World always entries (background + rule)
  for (const r of alwaysBefore) {
    parts.push(renderTemplate(r.entry.content, templateCtx))
  }

  // 2. Persona context from bindings
  for (const binding of bindings) {
    if (binding.persona_context) {
      const worldCtx = { ...templateCtx }
      const manifest = worldManifests.get(binding.world)
      if (manifest) {
        worldCtx.world = { name: manifest.name, display_name: manifest.display_name }
      }
      parts.push(renderTemplate(binding.persona_context, worldCtx))
    }
  }

  // 3. Soul identity
  parts.push(`## ${t('system_prompt.identity')}\n`)
  parts.push(soulFiles.identity)

  // 4. Soul style
  parts.push(`\n## ${t('system_prompt.style')}\n`)
  parts.push(soulFiles.style)

  // 5. Soul behaviors
  const behaviorEntries = Object.entries(soulFiles.behaviors)
  if (behaviorEntries.length > 0) {
    parts.push(`\n## ${t('system_prompt.behaviors')}\n`)
    for (const [name, content] of behaviorEntries) {
      parts.push(`### ${name}\n${content}\n`)
    }
  }

  // 5.5 Soul examples
  const exampleEntries = Object.entries(soulFiles.examples ?? {})
  if (exampleEntries.length > 0) {
    parts.push('\n## Examples\n')
    for (const [, content] of exampleEntries) {
      parts.push(`${content}\n`)
    }
  }

  // 6. Triggered entries (keyword + semantic)
  if (budgetedTriggered.length > 0) {
    parts.push('\n## World Context\n')
    for (const r of budgetedTriggered) {
      parts.push(renderTemplate(r.entry.content, templateCtx))
    }
  }

  // 7. Recall results
  if (recallResults.length > 0) {
    parts.push('\n## Recall\n')
    for (const r of recallResults) {
      parts.push(r.chunk.content)
    }
  }

  // 8. Atmosphere
  for (const r of atmosphere) {
    parts.push(renderTemplate(r.entry.content, templateCtx))
  }

  return parts.join('\n')
}

function buildLegacyPrompt(soulFiles: SoulFiles): string {
  const parts = [
    t('system_prompt.intro') + '\n',
    `## ${t('system_prompt.identity')}\n`,
    soulFiles.identity,
    `\n## ${t('system_prompt.style')}\n`,
    soulFiles.style,
  ]

  const behaviorEntries = Object.entries(soulFiles.behaviors)
  if (behaviorEntries.length > 0) {
    parts.push(`\n## ${t('system_prompt.behaviors')}\n`)
    for (const [name, content] of behaviorEntries) {
      parts.push(`### ${name}\n${content}\n`)
    }
  }

  const exampleEntries = Object.entries(soulFiles.examples ?? {})
  if (exampleEntries.length > 0) {
    parts.push(`\n## Examples\n`)
    for (const [, content] of exampleEntries) {
      parts.push(`${content}\n`)
    }
  }

  return parts.join('\n')
}

function deduplicateEntries(entries: ResolvedEntry[]): ResolvedEntry[] {
  const seen = new Map<string, ResolvedEntry>()
  for (const entry of entries) {
    const existing = seen.get(entry.entry.meta.name)
    if (!existing || entry.effectivePriority > existing.effectivePriority) {
      seen.set(entry.entry.meta.name, entry)
    }
  }
  return Array.from(seen.values())
}

function buildEntriesMap(entries: ResolvedEntry[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const r of entries) {
    map[r.entry.meta.name] = r.entry.content
  }
  return map
}

function applyBudget(
  entries: ResolvedEntry[],
  bindings: WorldBinding[],
  manifests: Map<string, WorldManifest>,
): ResolvedEntry[] {
  // Calculate budget per world
  const budgetByWorld = new Map<string, number>()
  for (const binding of bindings) {
    const manifest = manifests.get(binding.world)
    const budget = binding.overrides?.context_budget ?? manifest?.defaults.context_budget ?? 2000
    budgetByWorld.set(binding.world, budget)
  }

  // Track token usage per world
  const usageByWorld = new Map<string, number>()
  const result: ResolvedEntry[] = []

  // Entries are already sorted by priority (desc), so higher priority entries get budget first
  for (const entry of entries) {
    const budget = budgetByWorld.get(entry.worldName) ?? 2000
    const currentUsage = usageByWorld.get(entry.worldName) ?? 0
    const entryTokens = estimateTokens(entry.entry.content)

    if (currentUsage + entryTokens <= budget) {
      result.push(entry)
      usageByWorld.set(entry.worldName, currentUsage + entryTokens)
    }
  }

  return result
}
