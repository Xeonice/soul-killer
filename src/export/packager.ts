import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readManifest, readSoulFiles } from '../soul/package.js'
import { loadWorld, getWorldDir } from '../world/manifest.js'
import { generateSkillMd } from './skill-template.js'
import { generateStorySpec, type StorySpecConfig } from './story-spec.js'

export interface PackageConfig {
  soul_name: string
  world_name: string
  story_spec: StorySpecConfig
  output_dir?: string
}

export interface PackageResult {
  output_dir: string
  files: string[]
}

function getExportsDir(): string {
  return path.join(os.homedir(), '.soulkiller', 'exports')
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '')
}

export function getSkillDirName(soulName: string, worldName: string): string {
  return `soulkiller:${toKebabCase(soulName)}-in-${toKebabCase(worldName)}`
}

export function packageSkill(config: PackageConfig): PackageResult {
  const { soul_name, world_name, story_spec } = config
  const dirName = getSkillDirName(soul_name, world_name)
  const outputDir = config.output_dir
    ? path.join(config.output_dir, dirName)
    : path.join(getExportsDir(), dirName)

  // Clean and recreate
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true })
  }
  fs.mkdirSync(outputDir, { recursive: true })

  const files: string[] = []

  // 1. Copy soul files
  const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', soul_name)
  const soulManifest = readManifest(soulDir)
  const soulFiles = readSoulFiles(soulDir)
  const destSoulDir = path.join(outputDir, 'soul')
  const destBehaviorsDir = path.join(destSoulDir, 'behaviors')
  fs.mkdirSync(destBehaviorsDir, { recursive: true })

  fs.writeFileSync(path.join(destSoulDir, 'identity.md'), soulFiles.identity)
  files.push('soul/identity.md')
  fs.writeFileSync(path.join(destSoulDir, 'style.md'), soulFiles.style)
  files.push('soul/style.md')
  if (soulFiles.capabilities) {
    fs.writeFileSync(path.join(destSoulDir, 'capabilities.md'), soulFiles.capabilities)
    files.push('soul/capabilities.md')
  }
  if (soulFiles.milestones) {
    fs.writeFileSync(path.join(destSoulDir, 'milestones.md'), soulFiles.milestones)
    files.push('soul/milestones.md')
  }

  // Copy behavior files preserving original names
  const srcBehaviorsDir = path.join(soulDir, 'soul', 'behaviors')
  if (fs.existsSync(srcBehaviorsDir)) {
    const behaviorFiles = fs.readdirSync(srcBehaviorsDir).filter((f) => f.endsWith('.md')).sort()
    for (const f of behaviorFiles) {
      fs.copyFileSync(path.join(srcBehaviorsDir, f), path.join(destBehaviorsDir, f))
      files.push(`soul/behaviors/${f}`)
    }
  }

  // 2. Copy world files
  const worldDir = getWorldDir(world_name)
  const destWorldDir = path.join(outputDir, 'world')
  const destEntriesDir = path.join(destWorldDir, 'entries')
  fs.mkdirSync(destEntriesDir, { recursive: true })

  const worldJsonSrc = path.join(worldDir, 'world.json')
  if (fs.existsSync(worldJsonSrc)) {
    fs.copyFileSync(worldJsonSrc, path.join(destWorldDir, 'world.json'))
    files.push('world/world.json')
  }

  const entriesDir = path.join(worldDir, 'entries')
  if (fs.existsSync(entriesDir)) {
    const entryFiles = fs.readdirSync(entriesDir).filter((f) => f.endsWith('.md'))
    for (const f of entryFiles) {
      fs.copyFileSync(path.join(entriesDir, f), path.join(destEntriesDir, f))
      files.push(`world/entries/${f}`)
    }
  }

  // 3. Generate story-spec.md
  const storySpecContent = generateStorySpec(story_spec)
  fs.writeFileSync(path.join(outputDir, 'story-spec.md'), storySpecContent)
  files.push('story-spec.md')

  // 4. Generate SKILL.md
  const displayName = soulManifest?.display_name ?? soul_name
  const worldManifest = loadWorld(world_name)
  const worldDisplayName = worldManifest?.display_name ?? world_name
  const skillContent = generateSkillMd({
    skillName: dirName,
    soulDisplayName: displayName,
    worldDisplayName: worldDisplayName,
    description: `视觉小说 — 在${worldDisplayName}的世界中与${displayName}的一次相遇。每次运行都是全新故事。`,
  })
  fs.writeFileSync(path.join(outputDir, 'SKILL.md'), skillContent)
  files.push('SKILL.md')

  return { output_dir: outputDir, files }
}
