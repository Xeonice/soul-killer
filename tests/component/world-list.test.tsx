import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { WorldListCommand, WorldShowCommand } from '../../src/cli/commands/world-list.js'
import { WorldCommand } from '../../src/cli/commands/world.js'
import { createWorld } from '../../src/world/manifest.js'
import { addEntry } from '../../src/world/entry.js'
import { setLocale } from '../../src/i18n/index.js'

let tmpDir: string
let origHome: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-comp-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
  setLocale('zh')
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('WorldCommand (interactive menu)', () => {
  it('renders menu with all options', () => {
    const { lastFrame } = render(<WorldCommand onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).toContain('世界管理')
    expect(frame).toContain('创建')
    expect(frame).toContain('列表')
    expect(frame).toContain('详情')
    expect(frame).toContain('条目')
    expect(frame).toContain('绑定')
    expect(frame).toContain('解绑')
    expect(frame).toContain('蒸馏')
    expect(frame).toContain('进化')
  })

  it('shows disabled hint for bind/unbind when no soul loaded', () => {
    const { lastFrame } = render(<WorldCommand onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).toContain('需先 /use 加载分身')
  })

  it('does not show disabled hint when soul is loaded', () => {
    const soulDir = path.join(tmpDir, '.soulkiller', 'souls', 'test')
    fs.mkdirSync(soulDir, { recursive: true })
    const { lastFrame } = render(<WorldCommand soulDir={soulDir} onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).not.toContain('需先 /use 加载分身')
  })
})

describe('WorldListCommand', () => {
  it('shows empty message when no worlds', () => {
    const { lastFrame } = render(<WorldListCommand />)
    expect(lastFrame()).toContain('没有已安装的世界')
  })

  it('lists installed worlds', () => {
    createWorld('night-city', '夜之城', 'A cyberpunk city')
    createWorld('fantasy', '幻想大陆', 'A fantasy realm')

    const { lastFrame } = render(<WorldListCommand />)
    const frame = lastFrame()!
    expect(frame).toContain('night-city')
    expect(frame).toContain('夜之城')
    expect(frame).toContain('fantasy')
    expect(frame).toContain('幻想大陆')
  })
})

describe('WorldShowCommand', () => {
  it('shows world details with entries', () => {
    createWorld('night-city', '夜之城', 'desc')
    addEntry('night-city', {
      name: 'core-rules',
      keywords: [],
      priority: 900,
      mode: 'always',
      scope: 'background',
    }, 'Core rules content')

    const { lastFrame } = render(<WorldShowCommand worldName="night-city" />)
    const frame = lastFrame()!
    expect(frame).toContain('夜之城')
    expect(frame).toContain('core-rules')
    expect(frame).toContain('always')
    expect(frame).toContain('background')
  })

  it('shows error for non-existent world', () => {
    const { lastFrame } = render(<WorldShowCommand worldName="nonexistent" />)
    expect(lastFrame()).toContain('不存在')
  })
})
