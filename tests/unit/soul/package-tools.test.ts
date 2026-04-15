import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { generateManifest, packageSoul } from '../../../src/soul/package.js'
import {
  getSkillFileName,
  getSkillBaseName,
  countMdFilesInMap,
  estimateMdTextSizeKb,
} from '../../../src/export/packager.js'
import { strToU8 } from 'fflate'

describe('getSkillFileName', () => {
  it('produces a strict ASCII slug compliant with Anthropic Skill spec', () => {
    // CJK story name → formatter falls back to deterministic hash slug
    // (CJK is not allowed in the Anthropic Skill `name` field). The output
    // must match `^[a-z0-9]+(-[a-z0-9]+)*\.skill$`.
    const name = getSkillFileName('暗巷追凶', 'cyberpunk 2077')
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.skill$/)
    // World half preserves the ASCII portion
    expect(name).toContain('cyberpunk-2077')
    // CJK story half falls back to a `skill-...` slug
    expect(name).toContain('skill-')
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

  it('output without .skill always passes the Anthropic Skill name regex', () => {
    // Various pathological inputs — CJK, mixed, special chars
    const cases: Array<[string, string]> = [
      ['暗巷追凶', 'cyberpunk 2077'],
      ['Mixed CASE Story!', 'world-name'],
      ['伊莉雅丝菲尔·冯·爱因兹贝伦', '命运长夜'],
      ['正常 story', 'a b c'],
    ]
    for (const [story, world] of cases) {
      const baseName = getSkillBaseName(story, world)
      expect(baseName).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(baseName.length).toBeLessThanOrEqual(64)
    }
  })
})

describe('getSkillBaseName', () => {
  it('returns name without .skill extension', () => {
    expect(getSkillBaseName('story', 'world')).toBe('story-in-world')
    expect(getSkillBaseName('story', 'world')).not.toContain('.skill')
  })
})

describe('countMdFilesInMap', () => {
  it('counts only md files, ignoring non-md entries', () => {
    const files: Record<string, Uint8Array> = {
      'souls/a/identity.md': strToU8('x'),
      'souls/a/style.md': strToU8('y'),
      'souls/a/behaviors/pattern-1.md': strToU8('z'),
      'world/world.json': strToU8('{}'),
      'world/geography/overview.md': strToU8('w'),
      'story-spec.md': strToU8('s'),
    }
    expect(countMdFilesInMap(files)).toBe(5)
  })

  it('returns 0 for an empty map', () => {
    expect(countMdFilesInMap({})).toBe(0)
  })

  it('returns 0 when the map has no md files', () => {
    expect(countMdFilesInMap({ 'world.json': strToU8('{}') })).toBe(0)
  })
})

describe('estimateMdTextSizeKb', () => {
  it('sums byte length of md files only and rounds to kilobytes', () => {
    const bytes4k = new Uint8Array(4 * 1024)
    bytes4k.fill(65)
    const bytes2k = new Uint8Array(2 * 1024)
    bytes2k.fill(66)
    const files: Record<string, Uint8Array> = {
      'souls/a/identity.md': bytes4k,
      'souls/a/style.md': bytes2k,
      'world/world.json': strToU8('{"ignored": true}'),
    }
    // 4 + 2 = 6 KB expected
    expect(estimateMdTextSizeKb(files)).toBe(6)
  })

  it('returns minimum 1 for non-empty md content smaller than 1 KB', () => {
    // Floor at 1 KB so we never claim "0 KB" in the prompt.
    expect(estimateMdTextSizeKb({ 'a.md': strToU8('tiny') })).toBe(1)
  })

  it('ignores non-md files when summing size', () => {
    const bigBinary = new Uint8Array(10 * 1024)
    expect(estimateMdTextSizeKb({ 'world.json': bigBinary })).toBe(1)
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
    const { packageSkill } = await import('../../../src/export/packager.js')

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
    // Note: leading `__` stripped by formatter (only [a-z0-9-] kept)
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

    // baseName must be a strict ASCII slug compliant with Anthropic Skill spec
    expect(baseName).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(baseName.length).toBeLessThanOrEqual(64)

    // Unzip and verify internal structure
    const zipBytes = fs.readFileSync(result.output_file)
    const unzipped = unzipSync(new Uint8Array(zipBytes))
    const entries = Object.keys(unzipped).sort()

    // Compute expected soul slug — formatter strips leading underscores
    // (anything outside [a-z0-9-]) so `__test-export-<ts>` → `test-export-<ts>`
    const soulSlug = testSoulName.replace(/^_+/, '')

    // Anthropic Skill spec compliance: every entry MUST be nested under
    // a single top-level directory matching the frontmatter `name` field
    const prefix = `${baseName}/`
    expect(entries.every((e) => e.startsWith(prefix))).toBe(true)
    // Every entry must be pure ASCII
    expect(entries.every((e) => /^[\x00-\x7f]+$/.test(e))).toBe(true)

    expect(entries).toContain(`${prefix}SKILL.md`)
    expect(entries).toContain(`${prefix}story-spec.md`)
    expect(entries).toContain(`${prefix}souls/${soulSlug}/identity.md`)
    expect(entries).toContain(`${prefix}souls/${soulSlug}/style.md`)
    expect(entries).toContain(`${prefix}souls/${soulSlug}/capabilities.md`)
    expect(entries).toContain(`${prefix}souls/${soulSlug}/milestones.md`)
    expect(entries).toContain(`${prefix}souls/${soulSlug}/behaviors/b1.md`)
    expect(entries).toContain(`${prefix}world/world.json`)
    expect(entries).toContain(`${prefix}world/geography/geography.md`)
    // Chronicle: single timeline.md + events directory under history/
    expect(entries).toContain(`${prefix}world/history/timeline.md`)
    expect(entries).toContain(`${prefix}world/history/events/208-chibi.md`)
    // Runtime placeholder dirs ship empty so the skill can write scripts/saves at runtime
    expect(entries).toContain(`${prefix}runtime/scripts/.gitkeep`)
    expect(entries).toContain(`${prefix}runtime/saves/.gitkeep`)
    // skill-binary-contract: NO runtime/lib/*.ts inside archive — binary owns runtime code
    for (const entry of entries) {
      expect(entry.startsWith(`${prefix}runtime/lib/`)).toBe(false)
    }
    // file_count matches actual archive contents
    expect(result.file_count).toBe(entries.length)

    // Verify SKILL.md content + frontmatter compliance
    const skillContent = strFromU8(unzipped[`${prefix}SKILL.md`]!)
    // frontmatter `name` must equal the baseName (compliant slug)
    expect(skillContent).toMatch(new RegExp(`^---\\nname: ${baseName}\\n`))
    // allowed-tools must be SPACE separated, not comma — Anthropic spec
    expect(skillContent).toContain('allowed-tools: AskUserQuestion Read Write Glob Edit Bash')
    expect(skillContent).not.toContain('allowed-tools: AskUserQuestion, Read')
    expect(skillContent).toContain('Phase 0')
    expect(skillContent).toContain('Phase 1')
    expect(skillContent).toContain('Phase 2')
    // The author-side template lint runs during packaging. The clean
    // generated template should produce zero schema-naming errors. We
    // assert this indirectly: lint output goes to stderr but does not
    // throw, so reaching this assertion at all proves the packager
    // completed without crashing on its own template.
    expect(skillContent).toContain('state_schema Creation Constraints')
    expect(skillContent).toContain('apply_consequences Standard Flow')

    // SKILL.md frontmatter `name` should NOT contain soulkiller: prefix
    expect(skillContent).toContain(`name: ${baseName}`)
    expect(skillContent).not.toContain('name: soulkiller:')

    // Phase 1 full-read enforcement: packager must inject concrete
    // expectedFileCount and expectedTextSizeKb into the SKILL.md budget
    // declaration. We don't assert on the exact numbers (they depend on
    // fixture file sizes), just that the template rendered the
    // "specific-numbers" branch rather than the fallback.
    expect(skillContent).toContain('Context Budget and Full-Read Enforcement')
    expect(skillContent).toContain('1,000,000 token')
    expect(skillContent).toMatch(/\*\*\d+ files \/ ~\d+ KB of text\*\*/)
    expect(skillContent).toContain('MUST NOT use `offset` or `limit` parameters')
    // Step 0 and data coverage self-check must be present
    expect(skillContent).toContain('Step 0')
    expect(skillContent).toContain('Data Loading Report')

    // story-spec.md content sanity
    const storySpecContent = strFromU8(unzipped[`${prefix}story-spec.md`]!)
    expect(storySpecContent).toContain(`story_name: "${testStoryName}"`)
  })

  it('packages a skill with CJK soul name and produces ASCII-only archive paths', async () => {
    // Reproduce the failing fsn case: a soul whose directory name contains
    // CJK. The packager must format it into an ASCII slug so the archive
    // upload doesn't get rejected by Anthropic Skill validation.
    const cjkSoulName = `远坂凛-${Date.now()}`
    const cjkSoulDir = path.join(soulsDir, cjkSoulName)
    packageSoul(cjkSoulDir)
    generateManifest(cjkSoulDir, cjkSoulName, '远坂凛', 'A test soul', 10)
    fs.writeFileSync(path.join(cjkSoulDir, 'soul', 'identity.md'), '# Identity')
    fs.writeFileSync(path.join(cjkSoulDir, 'soul', 'style.md'), '# Style')
    fs.writeFileSync(path.join(cjkSoulDir, 'soul', 'behaviors', 'core.md'), '# Core')

    try {
      const { packageSkill } = await import('../../../src/export/packager.js')
      const result = packageSkill({
        souls: [cjkSoulName],
        world_name: testWorldName,
        story_name: '伊莉雅线 story', // mixed CJK + ASCII
        output_base_dir: exportsDir,
        story_spec: {
          story_name: '伊莉雅线 story',
          genre: 'test',
          tone: 'test',
          acts_options: [
            { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
          ],
          default_acts: 3,
          constraints: [],
        },
      })

      // 1. Output filename is ASCII-only and spec-compliant
      const fileName = path.basename(result.output_file, '.skill')
      expect(fileName).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(fileName.length).toBeLessThanOrEqual(64)

      // 2. All archive entries are ASCII-only
      const zipBytes = fs.readFileSync(result.output_file)
      const unzipped = unzipSync(new Uint8Array(zipBytes))
      const entries = Object.keys(unzipped)
      for (const entry of entries) {
        expect(entry).toMatch(/^[\x00-\x7f]+$/)
      }

      // 3. All entries nested under <baseName>/
      const prefix = `${fileName}/`
      expect(entries.every((e) => e.startsWith(prefix))).toBe(true)

      // 4. Soul directory uses an ASCII slug, not the CJK name
      const soulEntries = entries.filter((e) => e.includes('/souls/'))
      expect(soulEntries.length).toBeGreaterThan(0)
      for (const entry of soulEntries) {
        expect(entry).not.toContain('远坂凛')
      }

      // 5. SKILL.md frontmatter `name` is the same compliant slug
      const skillContent = strFromU8(unzipped[`${prefix}SKILL.md`]!)
      expect(skillContent).toMatch(new RegExp(`^---\\nname: ${fileName}\\n`))

      // 6. allowed-tools is space-separated
      expect(skillContent).toContain('allowed-tools: AskUserQuestion Read Write Glob Edit')

      // Cleanup
      fs.rmSync(result.output_file, { force: true })
    } finally {
      if (fs.existsSync(cjkSoulDir)) fs.rmSync(cjkSoulDir, { recursive: true, force: true })
    }
  })
})
