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
  it('generates valid SKILL.md with frontmatter', () => {
    const result = generateSkillMd({
      skillName: 'v-in-cyberpunk-2077',
      soulDisplayName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: '视觉小说 — 在赛博朋克 2077的世界中与V的一次相遇。',
    })

    expect(result).toContain('---')
    expect(result).toContain('name: v-in-cyberpunk-2077')
    expect(result).toContain('allowed-tools: Read')
    expect(result).toContain('Phase 0')
    expect(result).toContain('Phase 1')
    expect(result).toContain('Phase 2')
    expect(result).toContain('AskUserQuestion')
    expect(result).toContain('V')
    expect(result).toContain('赛博朋克 2077')
  })

  it('includes state tracking rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      soulDisplayName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
    })

    expect(result).toContain('状态追踪规则')
    expect(result).toContain('axes')
    expect(result).toContain('flags')
  })

  it('includes capabilities and milestones references', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:test',
      soulDisplayName: 'Test',
      worldDisplayName: 'TestWorld',
      description: 'test',
    })

    expect(result).toContain('capabilities.md')
    expect(result).toContain('milestones.md')
    expect(result).toContain('能力引用规则')
    expect(result).toContain('时间线引用规则')
  })

  it('includes ending display and replay rules', () => {
    const result = generateSkillMd({
      skillName: 'soulkiller:v-in-cyberpunk-2077',
      soulDisplayName: 'V',
      worldDisplayName: '赛博朋克 2077',
      description: 'test',
    })

    expect(result).toContain('结局判定规则')
    expect(result).toContain('结局展示规则')
    expect(result).toContain('旅程回顾')
    expect(result).toContain('其他可能的结局')
    expect(result).toContain('从头再来')
    expect(result).toContain('重玩规则')
  })
})

// --- generateStorySpec ---

describe('generateStorySpec', () => {
  it('generates story-spec.md with config values', () => {
    const result = generateStorySpec({
      genre: '赛博朋克黑色电影',
      tone: '暗巷与阴谋',
      acts: 3,
      endings_min: 3,
      rounds: '8-12',
      constraints: ['不要出现超自然元素'],
    })

    expect(result).toContain('genre: 赛博朋克黑色电影')
    expect(result).toContain('tone: 暗巷与阴谋')
    expect(result).toContain('acts: 3')
    expect(result).toContain('endings_min: 3')
    expect(result).toContain('rounds: 8-12')
    expect(result).toContain('3 幕结构')
    expect(result).toContain('至少 3 个不同结局')
    expect(result).toContain('不要出现超自然元素')
  })

  it('includes state system and ending rules', () => {
    const result = generateStorySpec({
      genre: 'test',
      tone: 'test',
      acts: 3,
      endings_min: 3,
      rounds: '8-12',
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
      genre: 'test',
      tone: 'test',
      acts: 2,
      endings_min: 2,
      rounds: '5-8',
      constraints: [],
    })

    expect(result).not.toContain('额外约束')
  })
})
