import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zipSync, strToU8 } from 'fflate'
import { readManifest, readSoulFiles } from '../soul/package.js'
import { loadWorld, getWorldDir } from '../world/manifest.js'
import { generateSkillMd } from './skill-template.js'
import { generateStorySpec, type StorySpecConfig } from './story-spec.js'

export interface PackageConfig {
  /** Array of soul names to include in souls/<name>/ subdirectories */
  souls: string[]
  world_name: string
  /** Story name provided by the user — used as the skill identity (file name + description) */
  story_name: string
  story_spec: StorySpecConfig
  /** Required absolute path of the parent directory where the .skill file will be created */
  output_base_dir: string
}

export interface PackageResult {
  /** Absolute path to the generated .skill archive file */
  output_file: string
  /** Number of files inside the archive */
  file_count: number
  /** Size of the .skill file in bytes */
  size_bytes: number
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '')
}

/**
 * Compute the base name (no extension) for a skill, derived from story name + world.
 * Format: `{story-name}-in-{world}` — e.g. `姐妹救赎-in-fate-stay-night`
 * Both parts are kebab-cased but CJK unicode is preserved.
 * No `soulkiller:` prefix — that violated Anthropic Skill naming conventions.
 */
export function getSkillBaseName(storyName: string, worldName: string): string {
  return `${toKebabCase(storyName)}-in-${toKebabCase(worldName)}`
}

/**
 * Compute the full skill archive file name (with .skill extension).
 */
export function getSkillFileName(storyName: string, worldName: string): string {
  return `${getSkillBaseName(storyName, worldName)}.skill`
}

interface SoulArchiveEntry {
  files: Record<string, Uint8Array>
  displayName: string
}

/**
 * Build the in-memory file map for one soul, namespaced under souls/<soulName>/.
 */
function buildSoulFiles(soulName: string): SoulArchiveEntry {
  const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', soulName)
  const manifest = readManifest(soulDir)
  const soulFiles = readSoulFiles(soulDir)

  const files: Record<string, Uint8Array> = {}
  files[`souls/${soulName}/identity.md`] = strToU8(soulFiles.identity)
  files[`souls/${soulName}/style.md`] = strToU8(soulFiles.style)
  if (soulFiles.capabilities) {
    files[`souls/${soulName}/capabilities.md`] = strToU8(soulFiles.capabilities)
  }
  if (soulFiles.milestones) {
    files[`souls/${soulName}/milestones.md`] = strToU8(soulFiles.milestones)
  }

  // Read behavior files
  const srcBehaviorsDir = path.join(soulDir, 'soul', 'behaviors')
  if (fs.existsSync(srcBehaviorsDir)) {
    const behaviorFiles = fs.readdirSync(srcBehaviorsDir).filter((f) => f.endsWith('.md')).sort()
    for (const f of behaviorFiles) {
      const content = fs.readFileSync(path.join(srcBehaviorsDir, f))
      files[`souls/${soulName}/behaviors/${f}`] = new Uint8Array(content)
    }
  }

  return { files, displayName: manifest?.display_name ?? soulName }
}

export function packageSkill(config: PackageConfig): PackageResult {
  const { souls, world_name, story_name, story_spec, output_base_dir } = config

  if (!souls || souls.length === 0) {
    throw new Error('packageSkill requires at least one soul')
  }
  if (!story_name || story_name.trim().length === 0) {
    throw new Error('packageSkill requires a non-empty story_name')
  }
  if (!output_base_dir) {
    throw new Error('packageSkill requires output_base_dir')
  }

  const baseName = getSkillBaseName(story_name, world_name)
  const fileName = `${baseName}.skill`
  const outputFile = path.join(output_base_dir, fileName)

  // Ensure parent dir exists (three preset output locations may not exist yet)
  fs.mkdirSync(output_base_dir, { recursive: true })

  // Remove existing archive if any (overwrite semantics)
  if (fs.existsSync(outputFile)) {
    fs.rmSync(outputFile)
  }

  // ── Build the in-memory file map ─────────────────────────────────

  const archiveFiles: Record<string, Uint8Array> = {}

  // 1. Souls — collect each soul into souls/<name>/
  for (const soulName of souls) {
    const entry = buildSoulFiles(soulName)
    Object.assign(archiveFiles, entry.files)
  }

  // Enrich story_spec.characters with display_name from manifest if missing
  if (story_spec.characters) {
    for (const char of story_spec.characters) {
      if (!char.display_name) {
        const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', char.name)
        const manifest = readManifest(soulDir)
        if (manifest) char.display_name = manifest.display_name
      }
    }
  }

  // 2. World files — world/world.json + world/<dimension>/*.md (per-dimension layout)
  const worldDir = getWorldDir(world_name)
  const worldJsonSrc = path.join(worldDir, 'world.json')
  if (fs.existsSync(worldJsonSrc)) {
    archiveFiles['world/world.json'] = new Uint8Array(fs.readFileSync(worldJsonSrc))
  }

  // Dimension subdirectories — each one is a flat list of regular entries.
  // Skip `_*.md` (author views like _index.md) and the history-specific
  // subfiles (timeline.md + events/) which are copied below.
  const DIMENSIONS = ['geography', 'history', 'factions', 'systems', 'society', 'culture', 'species', 'figures', 'atmosphere'] as const
  for (const dim of DIMENSIONS) {
    const dimDir = path.join(worldDir, dim)
    if (!fs.existsSync(dimDir)) continue
    for (const f of fs.readdirSync(dimDir)) {
      if (!f.endsWith('.md')) continue
      if (f.startsWith('_')) continue
      if (dim === 'history' && f === 'timeline.md') continue
      const full = path.join(dimDir, f)
      try {
        if (!fs.statSync(full).isFile()) continue
      } catch {
        continue
      }
      archiveFiles[`world/${dim}/${f}`] = new Uint8Array(fs.readFileSync(full))
    }
  }

  // 2.5 World chronicle — timeline single file + events directory under history/.
  // Optional: worlds without a history subtree are simply skipped.
  const timelineSrc = path.join(worldDir, 'history', 'timeline.md')
  if (fs.existsSync(timelineSrc)) {
    archiveFiles['world/history/timeline.md'] = new Uint8Array(fs.readFileSync(timelineSrc))
  }
  const eventsDir = path.join(worldDir, 'history', 'events')
  if (fs.existsSync(eventsDir)) {
    for (const f of fs.readdirSync(eventsDir)) {
      if (!f.endsWith('.md')) continue
      if (f.startsWith('_')) continue
      archiveFiles[`world/history/events/${f}`] = new Uint8Array(
        fs.readFileSync(path.join(eventsDir, f)),
      )
    }
  }

  // 3. story-spec.md
  const storySpecContent = generateStorySpec(story_spec)
  archiveFiles['story-spec.md'] = strToU8(storySpecContent)

  // 4. SKILL.md (skillName uses baseName WITHOUT .skill extension and WITHOUT soulkiller: prefix)
  const worldManifest = loadWorld(world_name)
  const worldDisplayName = worldManifest?.display_name ?? world_name
  const isMulti = souls.length > 1

  const description = isMulti
    ? `${story_name} — 在${worldDisplayName}中的多角色视觉小说。每次运行都是全新剧本。`
    : `${story_name} — 在${worldDisplayName}中的视觉小说。每次运行都是全新故事。`

  const skillContent = generateSkillMd({
    skillName: baseName,
    storyName: story_name,
    worldDisplayName: worldDisplayName,
    description,
    characters: story_spec.characters,
    acts_options: story_spec.acts_options,
    default_acts: story_spec.default_acts,
  })
  archiveFiles['SKILL.md'] = strToU8(skillContent)

  // 5. Runtime placeholder directories — scripts/ and saves/ are populated
  //    at skill runtime when LLM persists generated scripts and player saves.
  //    .gitkeep files reserve the directory inside the zip archive.
  archiveFiles['runtime/scripts/.gitkeep'] = strToU8('')
  archiveFiles['runtime/saves/.gitkeep'] = strToU8('')

  // ── Zip and write ─────────────────────────────────

  const zipped = zipSync(archiveFiles)
  fs.writeFileSync(outputFile, zipped)

  return {
    output_file: outputFile,
    file_count: Object.keys(archiveFiles).length,
    size_bytes: zipped.length,
  }
}
