import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { WorldListCommand, WorldShowCommand } from '../../src/cli/commands/world/world-list.js'
import { WorldCommand } from '../../src/cli/commands/world/world.js'
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
  it('renders top-level menu with create and manage', () => {
    const { lastFrame } = render(<WorldCommand onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).toContain('世界管理')
    expect(frame).toContain('创建')
    expect(frame).toContain('管理')
  })

  it('shows manage as disabled when no worlds exist', () => {
    const { lastFrame } = render(<WorldCommand onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).toContain('暂无世界')
  })

  it('manage is enabled when worlds exist', () => {
    createWorld('test-world', 'Test World', 'A test')
    const { lastFrame } = render(<WorldCommand onClose={() => {}} />)
    const frame = lastFrame()!
    expect(frame).toContain('管理')
    expect(frame).not.toContain('暂无世界')
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
