import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { generateManifest, packageSoul } from '../../src/soul/package.js'
import { generateSkillMd } from '../../src/export/skill-template.js'
import { generateStorySpec } from '../../src/export/story-spec.js'
import { getSkillDirName } from '../../src/export/packager.js'

describe('getSkillDirName', () => {
  it('creates kebab-case name with soulkiller prefix', () => {
    expect(getSkillDirName('V', 'cyberpunk 2077')).toBe('soulkiller:v-in-cyberpunk-2077')
  })

  it('handles already lowercase names with prefix', () => {
    expect(getSkillDirName('johnny', 'night-city')).toBe('soulkiller:johnny-in-night-city')
  })
})

describe('packager integration', () => {
  // Test the packager by calling it with real files in the real home dir.
  // We create temporary soul/world data, package, then clean up.
  const testSoulName = `__test-export-${Date.now()}`
  const testWorldName = `__test-world-${Date.now()}`
  const soulsDir = path.join(os.homedir(), '.soulkiller', 'souls')
  const worldsDir = path.join(os.homedir(), '.soulkiller', 'worlds')
  const exportsDir = path.join(os.homedir(), '.soulkiller', 'exports')
  let soulDir: string
  let worldDir: string

  beforeAll(() => {
    // Create test soul
    soulDir = path.join(soulsDir, testSoulName)
    packageSoul(soulDir)
    generateManifest(soulDir, testSoulName, 'Test Soul', 'A test soul', 10)
    fs.writeFileSync(path.join(soulDir, 'soul', 'identity.md'), '# Identity\nTest identity')
    fs.writeFileSync(path.join(soulDir, 'soul', 'style.md'), '# Style\nTest style')
    fs.writeFileSync(path.join(soulDir, 'soul', 'behaviors', 'b1.md'), '# Behavior 1')
    fs.writeFileSync(path.join(soulDir, 'soul', 'capabilities.md'), '# Capabilities\nExcalibur A++')
    fs.writeFileSync(path.join(soulDir, 'soul', 'milestones.md'), '# Milestones\n## [15] Drew the sword')

    // Create test world manually (no createWorld to avoid name conflicts)
    worldDir = path.join(worldsDir, testWorldName)
    fs.mkdirSync(path.join(worldDir, 'entries'), { recursive: true })
    fs.writeFileSync(path.join(worldDir, 'world.json'), JSON.stringify({
      name: testWorldName,
      display_name: 'Test World',
      version: '0.1.0',
      created_at: new Date().toISOString(),
      description: 'A test world',
      entry_count: 1,
      defaults: { context_budget: 2000, injection_position: 'after_soul' },
      worldType: 'fictional-existing',
      tags: {},
    }, null, 2))
    fs.writeFileSync(path.join(worldDir, 'entries', 'geography.md'), '---\nname: geography\nkeywords: [place]\npriority: 100\nmode: always\nscope: background\n---\n\nThe city is vast.')
  })

  afterAll(() => {
    // Clean up
    if (fs.existsSync(soulDir)) fs.rmSync(soulDir, { recursive: true, force: true })
    if (fs.existsSync(worldDir)) fs.rmSync(worldDir, { recursive: true, force: true })
    const exportDir = path.join(exportsDir, getSkillDirName(testSoulName, testWorldName))
    if (fs.existsSync(exportDir)) fs.rmSync(exportDir, { recursive: true, force: true })
  })

  it('creates a complete skill directory', async () => {
    // Dynamic import to get fresh module
    const { packageSkill } = await import('../../src/export/packager.js')

    const result = packageSkill({
      soul_name: testSoulName,
      world_name: testWorldName,
      story_spec: {
        genre: 'test-genre',
        tone: 'test-tone',
        acts: 3,
        endings_min: 3,
        rounds: '8-12',
        constraints: [],
      },
    })

    expect(result.files).toContain('SKILL.md')
    expect(result.files).toContain('story-spec.md')
    expect(result.files).toContain('soul/identity.md')
    expect(result.files).toContain('soul/style.md')
    expect(result.files).toContain('soul/capabilities.md')
    expect(result.files).toContain('soul/milestones.md')
    expect(result.files).toContain('world/world.json')
    expect(result.files).toContain('world/entries/geography.md')

    // Verify files exist on disk
    expect(fs.existsSync(path.join(result.output_dir, 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(result.output_dir, 'soul', 'identity.md'))).toBe(true)
    expect(fs.existsSync(path.join(result.output_dir, 'soul', 'capabilities.md'))).toBe(true)
    expect(fs.existsSync(path.join(result.output_dir, 'soul', 'milestones.md'))).toBe(true)

    // Verify SKILL.md content
    const skillContent = fs.readFileSync(path.join(result.output_dir, 'SKILL.md'), 'utf-8')
    expect(skillContent).toContain('Phase 0')
    expect(skillContent).toContain('Phase 1')
    expect(skillContent).toContain('Phase 2')
  })
})
