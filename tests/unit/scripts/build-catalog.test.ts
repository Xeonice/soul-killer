import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zipSync, strToU8 } from 'fflate'
import { buildEntry } from '../../../scripts/build-catalog.js'

function makeSkill(tmp: string, name: string, jsonBody: Record<string, unknown>): string {
  const bytes = zipSync({
    [`${name}/SKILL.md`]: strToU8(`---\nname: ${name}\ndescription: test\n---\nbody`),
    [`${name}/soulkiller.json`]: strToU8(JSON.stringify(jsonBody)),
  })
  const skillPath = path.join(tmp, `${name}.skill`)
  fs.writeFileSync(skillPath, bytes)
  return skillPath
}

describe('build-catalog buildEntry', () => {
  let tmp: string
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'))
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
    stderrSpy.mockRestore()
  })

  it('uses soulkiller.json.version as the catalog version', () => {
    const skillPath = makeSkill(tmp, 'alpha', {
      engine_version: 2,
      soulkiller_version: '0.5.0',  // build metadata, should NOT be used
      version: '1.2.0',              // author version — should be used
    })
    const entry = buildEntry(skillPath)
    expect(entry.version).toBe('1.2.0')
    expect(entry.engine_version).toBe(2)
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('falls back to 0.0.0 and warns when version field is missing', () => {
    const skillPath = makeSkill(tmp, 'beta', {
      engine_version: 2,
      soulkiller_version: '0.5.0',
      // no `version` field
    })
    const entry = buildEntry(skillPath)
    expect(entry.version).toBe('0.0.0')
    const warnings = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(warnings).toContain("lacks 'version'")
  })

  it('falls back when version field is empty string', () => {
    const skillPath = makeSkill(tmp, 'gamma', {
      engine_version: 2,
      version: '',
    })
    const entry = buildEntry(skillPath)
    expect(entry.version).toBe('0.0.0')
  })

  it('accepts freeform version strings', () => {
    const skillPath = makeSkill(tmp, 'delta', {
      engine_version: 2,
      version: '2026.04.15',
    })
    const entry = buildEntry(skillPath)
    expect(entry.version).toBe('2026.04.15')
  })
})
