import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { WorldCreateWizard } from '../../src/cli/commands/world/world-create-wizard.js'
import { setLocale } from '../../src/infra/i18n/index.js'

let tmpDir: string
let origHome: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-wizard-'))
  origHome = process.env.HOME!
  process.env.HOME = tmpDir
  setLocale('zh')
})

afterEach(() => {
  process.env.HOME = origHome
  fs.rmSync(tmpDir, { recursive: true })
})

describe('WorldCreateWizard', () => {
  it('renders initial type-select step with title and world types', () => {
    const { lastFrame } = render(
      <WorldCreateWizard onComplete={() => {}} onCancel={() => {}} />,
    )
    const frame = lastFrame()!
    expect(frame).toContain('创建新世界')
    expect(frame).toContain('ESC')
    expect(frame).toContain('已有作品')
    expect(frame).toContain('原创世界')
    expect(frame).toContain('真实世界')
  })
})
