import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { generateManifest, packageSoul } from '../../src/soul/package.js'
import { getSkillFileName, getSkillBaseName } from '../../src/export/packager.js'

describe('getSkillFileName', () => {
  it('creates kebab-case .skill file name from story name + world name', () => {
    expect(getSkillFileName('暗巷追凶', 'cyberpunk 2077')).toBe('暗巷追凶-in-cyberpunk-2077.skill')
  })

  it('handles lowercase ASCII story names', () => {
    expect(getSkillFileName('johnny-story', 'night-city')).toBe('johnny-story-in-night-city.skill')
  })

  it('does not include soulkiller: prefix', () => {
    const name = getSkillFileName('any-story', 'any-world')
    expect(name).not.toContain('soulkiller:')
  })

  it('preserves -in- separator and .skill extension', () => {
    const name = getSkillFileName('a', 'b')
    expect(name).toBe('a-in-b.skill')
  })
})

describe('getSkillBaseName', () => {
  it('returns name without .skill extension', () => {
    expect(getSkillBaseName('story', 'world')).toBe('story-in-world')
    expect(getSkillBaseName('story', 'world')).not.toContain('.skill')
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
  const testStoryName = 'test-story'
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
    // Per-dimension layout: each entry lives under <dimension>/<name>.md
    fs.mkdirSync(path.join(worldDir, 'geography'), { recursive: true })
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
    fs.writeFileSync(path.join(worldDir, 'geography', 'geography.md'), '---\nname: geography\nkeywords: [place]\npriority: 100\nmode: always\nscope: background\ndimension: geography\n---\n\nThe city is vast.')

    // Seed history chronicle: timeline.md single file + events/<stem>.md
    fs.mkdirSync(path.join(worldDir, 'history', 'events'), { recursive: true })
    fs.writeFileSync(
      path.join(worldDir, 'history', 'timeline.md'),
      `---
type: chronicle-timeline
dimension: history
mode: always
---

# Test World 编年史

## 208 年 — 208-chibi
> sort_key: 208
> display_time: "208 年"
> ref: ./events/208-chibi.md

208 年 · 赤壁之战
`,
    )
    fs.writeFileSync(
      path.join(worldDir, 'history', 'events', '208-chibi.md'),
      '---\nname: 208-chibi\nkeywords: ["chibi", "red-cliff"]\npriority: 800\nmode: keyword\nscope: chronicle\ndimension: history\nsort_key: 208\n---\n\n赤壁之战的完整经过...',
    )
  })

  afterAll(() => {
    // Clean up
    if (fs.existsSync(soulDir)) fs.rmSync(soulDir, { recursive: true, force: true })
    if (fs.existsSync(worldDir)) fs.rmSync(worldDir, { recursive: true, force: true })
    const exportFile = path.join(exportsDir, getSkillFileName(testStoryName, testWorldName))
    if (fs.existsSync(exportFile)) fs.rmSync(exportFile, { force: true })
  })

  it('creates a .skill archive file with correct internal structure', async () => {
    // Dynamic import to get fresh module
    const { packageSkill } = await import('../../src/export/packager.js')

    const result = packageSkill({
      souls: [testSoulName],
      world_name: testWorldName,
      story_name: testStoryName,
      output_base_dir: exportsDir,
      story_spec: {
        story_name: testStoryName,
        genre: 'test-genre',
        tone: 'test-tone',
        acts_options: [
          { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
          { acts: 5, label_zh: '中篇', rounds_total: '40-60', endings_count: 5 },
        ],
        default_acts: 3,
        constraints: [],
      },
    })

    // Result shape verification
    expect(result.output_file).toMatch(/\.skill$/)
    expect(result.output_file).toContain(testStoryName)
    // Note: leading `__` stripped by kebab-case (only [a-z0-9 + CJK + hyphen] kept)
    expect(result.output_file).toContain(testWorldName.replace(/^_+/, ''))
    expect(result.output_file).not.toContain('soulkiller:')
    expect(result.file_count).toBeGreaterThan(0)
    expect(result.size_bytes).toBeGreaterThan(0)

    // .skill file exists on disk
    expect(fs.existsSync(result.output_file)).toBe(true)

    // No expanded directory should exist with the same base name
    const baseName = getSkillBaseName(testStoryName, testWorldName)
    const wouldBeDir = path.join(exportsDir, baseName)
    expect(fs.existsSync(wouldBeDir)).toBe(false)

    // Unzip and verify internal structure
    const zipBytes = fs.readFileSync(result.output_file)
    const unzipped = unzipSync(new Uint8Array(zipBytes))
    const entries = Object.keys(unzipped).sort()

    expect(entries).toContain('SKILL.md')
    expect(entries).toContain('story-spec.md')
    expect(entries).toContain(`souls/${testSoulName}/identity.md`)
    expect(entries).toContain(`souls/${testSoulName}/style.md`)
    expect(entries).toContain(`souls/${testSoulName}/capabilities.md`)
    expect(entries).toContain(`souls/${testSoulName}/milestones.md`)
    expect(entries).toContain(`souls/${testSoulName}/behaviors/b1.md`)
    expect(entries).toContain('world/world.json')
    expect(entries).toContain('world/geography/geography.md')
    // Chronicle: single timeline.md + events directory under history/
    expect(entries).toContain('world/history/timeline.md')
    expect(entries).toContain('world/history/events/208-chibi.md')
    // Runtime placeholder dirs ship empty so the skill can write scripts/saves at runtime
    expect(entries).toContain('runtime/scripts/.gitkeep')
    expect(entries).toContain('runtime/saves/.gitkeep')

    // file_count matches actual archive contents
    expect(result.file_count).toBe(entries.length)

    // Verify SKILL.md content
    const skillContent = strFromU8(unzipped['SKILL.md']!)
    expect(skillContent).toContain('Phase 0')
    expect(skillContent).toContain('Phase 1')
    expect(skillContent).toContain('Phase 2')

    // SKILL.md frontmatter `name` should NOT contain soulkiller: prefix
    expect(skillContent).toContain(`name: ${baseName}`)
    expect(skillContent).not.toContain('name: soulkiller:')

    // story-spec.md content sanity
    const storySpecContent = strFromU8(unzipped['story-spec.md']!)
    expect(storySpecContent).toContain(`story_name: "${testStoryName}"`)
  })
})
