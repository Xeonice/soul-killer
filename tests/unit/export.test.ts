import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readSoulFiles } from '../../src/soul/package.js'
import { generateSkillMd } from '../../src/export/skill-template.js'
import { generateStorySpec } from '../../src/export/story-spec.js'

// --- readSoulFiles ---

describe('readSoulFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-test-'))
    const soulDir = path.join(tmpDir, 'soul')
    const behaviorsDir = path.join(soulDir, 'behaviors')
    fs.mkdirSync(behaviorsDir, { recursive: true })

    fs.writeFileSync(path.join(soulDir, 'identity.md'), '# Identity\nI am V.')
    fs.writeFileSync(path.join(soulDir, 'style.md'), '# Style\nDirect and terse.')
    fs.writeFileSync(path.join(behaviorsDir, 'combat.md'), '# Combat\nFight first, talk later.')
    fs.writeFileSync(path.join(behaviorsDir, 'social.md'), '# Social\nTrust is earned.')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads identity, style, behaviors, capabilities, and milestones', () => {
    // Add capabilities and milestones files
    fs.writeFileSync(path.join(tmpDir, 'soul', 'capabilities.md'), '# Capabilities\nExcalibur A++')
    fs.writeFileSync(path.join(tmpDir, 'soul', 'milestones.md'), '# Milestones\n## [15] Drew the sword')

    const result = readSoulFiles(tmpDir)
    expect(result.identity).toContain('I am V.')
    expect(result.style).toContain('Direct and terse.')
    expect(result.behaviors).toHaveLength(2)
    expect(result.behaviors[0]).toContain('Combat')
    expect(result.behaviors[1]).toContain('Social')
    expect(result.capabilities).toContain('Excalibur')
    expect(result.milestones).toContain('Drew the sword')
  })

  it('returns empty strings for missing files (backward compat)', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-empty-'))
    const result = readSoulFiles(emptyDir)
    expect(result.identity).toBe('')
    expect(result.style).toBe('')
    expect(result.behaviors).toHaveLength(0)
    expect(result.capabilities).toBe('')
    expect(result.milestones).toBe('')
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })
})

// --- generateSkillMd ---

describe('generateSkillMd', () => {
  const sampleActOptions = [
    { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
    { acts: 5, label_zh: '中篇', rounds_total: '40-60', endings_count: 5 },
  ]

  it('generates valid SKILL.md with frontmatter', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: '视觉小说 — 在赛博朋克 2077的世界中与V的一次相遇。',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('---')
    expect(result).toContain('name: v-in-cyberpunk-2077')
    // allowed-tools must include the four tools required by Phase -1/1 persistence
    expect(result).toMatch(/allowed-tools:.*AskUserQuestion/)
    expect(result).toMatch(/allowed-tools:.*Read/)
    expect(result).toMatch(/allowed-tools:.*Write/)
    expect(result).toMatch(/allowed-tools:.*Glob/)
    expect(result).toContain('Phase 0')
    expect(result).toContain('Phase 1')
    expect(result).toContain('Phase 2')
    expect(result).toContain('AskUserQuestion')
    expect(result).toContain('V')
    expect(result).toContain('赛博朋克 2077')
    // Phase 0 must include length selection
    expect(result).toContain('选择故事长度')
    expect(result).toContain('短篇')
    expect(result).toContain('state.chosen_acts')
  })

  it('includes state tracking rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('状态追踪规则')
    expect(result).toContain('axes')
    expect(result).toContain('flags')
  })

  it('includes capabilities and milestones references', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:test',
      storyName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('capabilities.md')
    expect(result).toContain('milestones.md')
    expect(result).toContain('能力引用规则')
    expect(result).toContain('时间线引用规则')
  })

  it('includes Phase -1 script library menu with five top-level options', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('Phase -1: 剧本库菜单')
    expect(result).toContain('runtime/scripts/*.yaml')
    expect(result).toContain('继续游戏')
    expect(result).toContain('重玩某个剧本')
    expect(result).toContain('重命名剧本')
    expect(result).toContain('删除剧本')
    expect(result).toContain('生成新剧本')
    // Frontmatter parsing instructions
    expect(result).toContain('user_direction')
    expect(result).toContain('generated_at')
    // Damaged script handling
    expect(result).toContain('损坏')
  })

  it('includes Phase 1 script persistence with Write instructions', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Phase 1 must instruct Write tool usage
    expect(result).toContain('剧本持久化')
    expect(result).toContain('Write 工具')
    expect(result).toContain('runtime/scripts/script-')
    expect(result).toContain('script-<id>.yaml')
    // Frontmatter fields enumerated
    expect(result).toContain('id:')
    expect(result).toContain('title:')
    expect(result).toContain('generated_at:')
    expect(result).toContain('user_direction:')
    expect(result).toContain('acts:')
    // Old "save in internal context" wording must be gone
    expect(result).not.toContain('剧本在你的内部上下文中保存，不要输出给用户')
    // Failure tolerance
    expect(result).toContain('未能持久化')
  })

  it('includes rename and delete script flows in Phase -1', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // Rename flow: ask new title, modify frontmatter, write back
    expect(result).toContain('「重命名剧本」')
    expect(result).toContain('frontmatter 的 \`title\` 字段')
    // Delete flow: confirmation + cascade delete saves
    expect(result).toContain('「删除剧本」')
    expect(result).toContain('二次确认')
    expect(result).toContain('已删除剧本')
    // Corruption tolerance
    expect(result).toContain('损坏剧本')
    expect(result).toContain('继续解析其他文件')
  })

  it('includes save system with three fixed slots', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('存档机制')
    expect(result).toContain('slot-1')
    expect(result).toContain('slot-2')
    expect(result).toContain('slot-3')
    expect(result).toContain('runtime/saves/')
    expect(result).toContain('script_ref')
    expect(result).toContain('last_played_at')
    // Phase 2 must reference slot writes
    expect(result).toContain('立即写入当前 slot')
  })

  it('includes ending display and replay rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('结局判定规则')
    expect(result).toContain('结局展示规则')
    expect(result).toContain('旅程回顾')
    expect(result).toContain('结局图鉴')
    expect(result).toContain('从头再来')
    expect(result).toContain('重玩规则')
  })

  it('Phase 1 instructions reference chronicle timeline and events directories', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    expect(result).toContain('world/history/timeline.md')
    expect(result).toContain('world/history/events/')
    expect(result).toContain('编年史一致性要求')
    expect(result).toContain('display_time')
  })

  it('replay rule reuses current script (no Phase 0 / no regeneration)', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      storyName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
    })

    // The new replay rule must reference initial_state, not Phase 0 / regeneration
    expect(result).toContain('复用')
    expect(result).toContain('当前正在玩的 script')
    expect(result).toContain('initial_state')
    expect(result).toContain('第一个场景')
    expect(result).toContain('生成新剧本')
    // Old behaviour must be gone
    expect(result).not.toContain('回到 Phase 0（重新询问 story seeds）')
    expect(result).not.toContain('重新生成全新剧本')
  })
})

// --- generateStorySpec ---

describe('generateStorySpec', () => {
  const sampleActOptions = [
    { acts: 3, label_zh: '短篇', rounds_total: '24-36', endings_count: 4 },
    { acts: 5, label_zh: '中篇', rounds_total: '40-60', endings_count: 5 },
  ]

  it('generates story-spec.md with config values', () => {
    const result = generateStorySpec({
      story_name: '暗巷追凶',
      genre: '赛博朋克黑色电影',
      tone: '暗巷与阴谋',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: ['不要出现超自然元素'],
    })

    expect(result).toContain('story_name: "暗巷追凶"')
    expect(result).toContain('genre: 赛博朋克黑色电影')
    expect(result).toContain('tone: 暗巷与阴谋')
    expect(result).toContain('acts_options:')
    expect(result).toContain('default_acts: 3')
    expect(result).toContain('短篇')
    expect(result).toContain('中篇')
    expect(result).toContain('state.chosen_acts')
    expect(result).toContain('不要出现超自然元素')
  })

  it('includes state system and ending rules', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('状态系统')
    expect(result).toContain('数值轴')
    expect(result).toContain('关键事件标记')
    expect(result).toContain('结局判定')
    expect(result).toContain('默认结局')
    expect(result).toContain('结局展示')
    expect(result).toContain('旅程回顾')
  })

  it('omits constraints block when empty', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).not.toContain('额外约束')
  })

  it('replay option reuses current script', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 3,
      constraints: [],
    })

    expect(result).toContain('复用当前剧本')
    expect(result).toContain('initial_state')
    expect(result).toContain('Phase 2 第一场景')
    expect(result).toContain('生成新剧本')
    expect(result).not.toMatch(/回到 Phase 0/)
  })

  it('marks default acts option in summary', () => {
    const result = generateStorySpec({
      story_name: 'test-story',
      genre: 'test',
      tone: 'test',
      acts_options: sampleActOptions,
      default_acts: 5,
      constraints: [],
    })

    // Default option should be marked as recommended
    expect(result).toContain('**中篇** (5 幕，40-60 轮，5 结局) [推荐]')
    // Non-default should NOT have the marker
    expect(result).toContain('**短篇** (3 幕，24-36 轮，4 结局)')
    expect(result).not.toContain('**短篇** (3 幕，24-36 轮，4 结局) [推荐]')
  })
})
