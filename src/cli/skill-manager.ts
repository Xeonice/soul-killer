/**
 * `soulkiller skill <subcommand>`
 *
 * Manages installed soulkiller skills: list, upgrade, migrate.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

const SKILLS_DIR = join(homedir(), '.claude', 'skills')

interface SkillInfo {
  name: string
  dir: string
  engineVersion: number | null
  soulkillerVersion: string | null
  needsMigration: boolean
  needsUpdate: boolean
}

// Import at call time to avoid circular deps with template
let _engineVersion: number | null = null
function getCurrentEngineVersion(): number {
  if (_engineVersion !== null) return _engineVersion
  try {
    const mod = require('../export/spec/skill-template.js')
    _engineVersion = mod.CURRENT_ENGINE_VERSION ?? 1
  } catch {
    _engineVersion = 1
  }
  return _engineVersion
}

let _engineTemplate: string | null = null
function getCurrentEngineTemplate(): string {
  if (_engineTemplate !== null) return _engineTemplate
  try {
    const mod = require('../export/spec/skill-template.js')
    _engineTemplate = mod.generateEngineTemplate?.() ?? ''
  } catch {
    _engineTemplate = ''
  }
  return _engineTemplate
}

function isSoulkillerSkill(dir: string): boolean {
  // Has soulkiller.json → definitely a soulkiller skill
  if (existsSync(join(dir, 'soulkiller.json'))) return true
  // Has runtime/ directory → legacy soulkiller skill
  if (existsSync(join(dir, 'runtime'))) return true
  return false
}

function readSoulkillerJson(dir: string): { engine_version?: number; soulkiller_version?: string } | null {
  const path = join(dir, 'soulkiller.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function getSkillInfo(name: string, dir: string): SkillInfo {
  const meta = readSoulkillerJson(dir)
  const currentEngine = getCurrentEngineVersion()

  if (meta) {
    const engineVersion = meta.engine_version ?? null
    return {
      name,
      dir,
      engineVersion,
      soulkillerVersion: meta.soulkiller_version ?? null,
      needsMigration: false,
      needsUpdate: engineVersion !== null && engineVersion < currentEngine,
    }
  }

  // Legacy skill — no soulkiller.json
  return {
    name,
    dir,
    engineVersion: null,
    soulkillerVersion: null,
    needsMigration: true,
    needsUpdate: false,
  }
}

// ── skill list ──────────────────────────────────────────────────

export function skillList(): number {
  if (!existsSync(SKILLS_DIR)) {
    console.log('  No soulkiller skills found.')
    return 0
  }

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
  const skills: SkillInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(SKILLS_DIR, entry.name)
    if (!isSoulkillerSkill(dir)) continue
    skills.push(getSkillInfo(entry.name, dir))
  }

  if (skills.length === 0) {
    console.log('  No soulkiller skills found.')
    return 0
  }

  const currentEngine = getCurrentEngineVersion()
  console.log(`  Current engine version: ${currentEngine}\n`)

  // Header
  const nameWidth = Math.max(30, ...skills.map((s) => s.name.length + 2))
  console.log(
    `  ${'NAME'.padEnd(nameWidth)}${'ENGINE'.padEnd(10)}${'SOULKILLER'.padEnd(14)}STATUS`,
  )
  console.log(`  ${'─'.repeat(nameWidth + 10 + 14 + 16)}`)

  for (const s of skills) {
    const engineCol = s.engineVersion !== null ? String(s.engineVersion) : '—'
    const versionCol = s.soulkillerVersion ?? '—'
    let status: string
    if (s.needsMigration) status = 'needs migration'
    else if (s.needsUpdate) status = 'needs update'
    else status = 'up to date'

    console.log(
      `  ${s.name.padEnd(nameWidth)}${engineCol.padEnd(10)}${versionCol.padEnd(14)}${status}`,
    )
  }

  console.log()
  return 0
}

// ── skill upgrade ───────────────────────────────────────────────

export async function skillUpgrade(target?: string): Promise<number> {
  if (!existsSync(SKILLS_DIR)) {
    console.log('  No soulkiller skills found.')
    return 0
  }

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
  const skills: SkillInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(SKILLS_DIR, entry.name)
    if (!isSoulkillerSkill(dir)) continue
    const info = getSkillInfo(entry.name, dir)
    if (target && target !== '--all' && entry.name !== target) continue
    if (info.needsMigration || info.needsUpdate) {
      skills.push(info)
    }
  }

  if (skills.length === 0) {
    console.log('  All skills are up to date.')
    return 0
  }

  console.log(`  Found ${skills.length} skill(s) to upgrade:\n`)

  let upgraded = 0
  let migrated = 0
  let failed = 0

  for (const skill of skills) {
    process.stdout.write(`  ${skill.name}... `)

    try {
      if (skill.needsMigration) {
        await migrateSkill(skill.dir)
        migrated++
        console.log('migrated ✓')
      } else {
        upgradeEngine(skill.dir)
        upgraded++
        console.log('upgraded ✓')
      }
    } catch (err) {
      failed++
      console.log(`FAILED: ${(err as Error).message}`)
    }
  }

  console.log()
  if (migrated > 0) console.log(`  ${migrated} skill(s) migrated to split format.`)
  if (upgraded > 0) console.log(`  ${upgraded} skill(s) engine updated.`)
  if (failed > 0) console.log(`  ${failed} skill(s) failed.`)
  console.log()

  return failed > 0 ? 1 : 0
}

function upgradeEngine(skillDir: string): void {
  const enginePath = join(skillDir, 'runtime', 'engine.md')
  const engineContent = getCurrentEngineTemplate()
  if (!engineContent) throw new Error('Engine template not available')

  const runtimeDir = join(skillDir, 'runtime')
  if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true })

  writeFileSync(enginePath, engineContent, 'utf8')
  writeSoulkillerJson(skillDir)
}

async function migrateSkill(skillDir: string): Promise<void> {
  // Verify story-spec.md exists
  const storySpecPath = join(skillDir, 'story-spec.md')
  if (!existsSync(storySpecPath)) {
    throw new Error('story-spec.md not found — cannot migrate')
  }

  // Backup old SKILL.md
  const skillMdPath = join(skillDir, 'SKILL.md')
  if (existsSync(skillMdPath)) {
    renameSync(skillMdPath, join(skillDir, 'SKILL.md.bak'))
  }

  // Generate new SKILL.md from source data
  const newSkillMd = rebuildContentFromSources(skillDir)
  writeFileSync(skillMdPath, newSkillMd, 'utf8')

  // Write engine.md
  const runtimeDir = join(skillDir, 'runtime')
  if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true })
  const engineContent = getCurrentEngineTemplate()
  if (!engineContent) throw new Error('Engine template not available')
  writeFileSync(join(runtimeDir, 'engine.md'), engineContent, 'utf8')

  // Write soulkiller.json
  writeSoulkillerJson(skillDir)

  // Clean up runtime/lib/ (no longer needed)
  const libDir = join(runtimeDir, 'lib')
  if (existsSync(libDir)) {
    rmSync(libDir, { recursive: true })
  }
}

function writeSoulkillerJson(skillDir: string): void {
  const currentEngine = getCurrentEngineVersion()
  const soulkillerVersion = process.env.SOULKILLER_VERSION ?? 'dev'
  const skillId = basename(skillDir)

  const existing = readSoulkillerJson(skillDir) ?? {}

  const json = {
    engine_version: currentEngine,
    soulkiller_version: soulkillerVersion,
    exported_at: existing.soulkiller_version ? (existing as Record<string, unknown>).exported_at : new Date().toISOString(),
    skill_id: skillId,
  }

  writeFileSync(join(skillDir, 'soulkiller.json'), JSON.stringify(json, null, 2) + '\n', 'utf8')
}

// ── Rebuild content SKILL.md from source data ───────────────────

function rebuildContentFromSources(skillDir: string): string {
  const storySpecPath = join(skillDir, 'story-spec.md')
  const storySpecRaw = readFileSync(storySpecPath, 'utf8')

  // Parse YAML frontmatter from story-spec.md
  const fmMatch = storySpecRaw.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter = fmMatch?.[1] ?? ''

  // Extract key fields from frontmatter (simple line-based parsing)
  const storyName = extractYamlField(frontmatter, 'story_name') ?? basename(skillDir)
  const genre = extractYamlField(frontmatter, 'genre') ?? ''

  // Read old SKILL.md frontmatter for name/description
  const oldSkillMdPath = join(skillDir, 'SKILL.md.bak')
  let skillName = basename(skillDir)
  let description = ''
  if (existsSync(oldSkillMdPath)) {
    const oldContent = readFileSync(oldSkillMdPath, 'utf8')
    const oldFm = oldContent.match(/^---\n([\s\S]*?)\n---/)
    if (oldFm) {
      skillName = extractYamlField(oldFm[1], 'name') ?? skillName
      description = extractYamlField(oldFm[1], 'description') ?? ''
    }
  }

  // Scan souls/ directory for character slug → name mapping
  const soulsDir = join(skillDir, 'souls')
  const characters: Array<{ name: string; slug: string; displayName: string }> = []
  if (existsSync(soulsDir)) {
    for (const entry of readdirSync(soulsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const identityPath = join(soulsDir, entry.name, 'identity.md')
      if (!existsSync(identityPath)) continue
      const identity = readFileSync(identityPath, 'utf8')
      // Extract name from "# <name>" or "# <name> - <title>"
      const nameMatch = identity.match(/^# (.+?)(?:\s*[-—]|$)/m)
      // Skip the first "# Identity" heading
      const lines = identity.split('\n')
      let charName = entry.name
      for (const line of lines) {
        if (line.startsWith('# ') && !line.startsWith('# Identity')) {
          const m = line.match(/^# (.+?)(?:\s*[-—]|$)/)
          if (m) charName = m[1].trim()
          break
        }
      }
      characters.push({ name: charName, slug: entry.name, displayName: charName })
    }
  }

  // Extract appears_from from story-spec frontmatter characters
  const appearsFromMap = new Map<string, string>()
  const charBlockRegex = /- name: "([^"]+)"[\s\S]*?appears_from: (\S+)/g
  let match
  while ((match = charBlockRegex.exec(frontmatter)) !== null) {
    appearsFromMap.set(match[1], match[2])
  }

  // Build character path mapping
  const charMapping = characters.length > 0
    ? characters.map((c) => `- **${c.displayName}** → \`souls/${c.slug}/\``).join('\n')
    : ''

  // Build reading list
  const soulsList = characters.map((c) =>
    `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/identity.md\` (${c.displayName})\n` +
    `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/style.md\`\n` +
    `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/capabilities.md\` (if present)\n` +
    `   - \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/milestones.md\` (if present)\n` +
    `   - All files under \`\${CLAUDE_SKILL_DIR}/souls/${c.slug}/behaviors/\``
  ).join('\n')

  // Build appears_from section
  const appearsFrom = characters
    .filter((c) => appearsFromMap.has(c.name))
    .map((c) => `- ${c.displayName}: starting from ${appearsFromMap.get(c.name)}`)
    .join('\n')

  const isMulti = characters.length > 1
  const charList = characters.map((c) => c.displayName).join(', ')
  const worldName = storyName // Use story name as world reference

  return `---
name: ${skillName}
description: ${description}
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

You are a ${isMulti ? 'multi-character ' : ''}visual novel engine. You will run the story "${storyName}"${isMulti ? `, featuring ${charList} as main characters` : ''}.

Execution has five phases: Phase -1 (Script Library Menu) -> Phase 0 (Length & Seeds) -> Phase 1 (Script Generation & Persistence) -> Phase 2 (${isMulti ? 'Multi-Character ' : ''}Story Runtime) -> Phase 3 (Ending Gallery).

**Before executing any phase**, Read \`\${CLAUDE_SKILL_DIR}/runtime/engine.md\` in full. It defines the complete execution protocol for all phases.

${charMapping ? `## Character Path Mapping (Important)

All character file paths in this skill use ASCII slugs because the Anthropic Skill spec requires archive paths to be ASCII-only. When you need to read a character's identity / style / capabilities / milestones / behaviors, you **must** use the slug from the table below:

${charMapping}

When the rest of this document refers to \`souls/{character}/...\`, {character} is a placeholder — **use the slug from the table above for the actual path**.
` : ''}
## Required Reading List

1. Each character's personality files (every file must be Read in full, without offset/limit):
${soulsList}
2. Read all .md files under \`\${CLAUDE_SKILL_DIR}/world/\` dimension subdirectories — the worldview. Skip \`_\`-prefixed files, exclude \`history/events/\` and \`history/timeline.md\`
3. Read \`\${CLAUDE_SKILL_DIR}/world/history/timeline.md\` (if present) — world chronicle
4. Read all files under \`\${CLAUDE_SKILL_DIR}/world/history/events/\` (if present) — chronicle details
5. Re-Read the complete \`\${CLAUDE_SKILL_DIR}/story-spec.md\`

${appearsFrom ? `## Character Scheduling

${appearsFrom}
` : ''}
`
}

function extractYamlField(yaml: string, key: string): string | null {
  const regex = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm')
  const match = yaml.match(regex)
  return match?.[1]?.trim() ?? null
}
