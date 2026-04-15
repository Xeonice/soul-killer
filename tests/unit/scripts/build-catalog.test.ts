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

  describe('catalog display fields (skill-catalog-autogen)', () => {
    it('prefers world_slug / world_name / summary over technical identifiers', () => {
      const skillPath = makeSkill(tmp, '2077-in-cyberpunk-2077', {
        engine_version: 2,
        version: '0.1.0',
        world_slug: 'cyberpunk-2077',
        world_name: '2077',
        summary: '赛博朋克 2077 的故事',
      })
      const entry = buildEntry(skillPath)
      expect(entry.slug).toBe('cyberpunk-2077')
      expect(entry.display_name).toBe('2077')
      expect(entry.description).toBe('赛博朋克 2077 的故事')
      // url stays keyed by archive filename (backwards-compat with R2 layout)
      expect(entry.url).toContain('2077-in-cyberpunk-2077.skill')
    })

    it('falls back to filename slug + SKILL.md frontmatter when manifest lacks catalog fields', () => {
      const skillPath = makeSkill(tmp, 'legacy-skill', {
        engine_version: 2,
        version: '0.1.0',
      })
      const entry = buildEntry(skillPath)
      expect(entry.slug).toBe('legacy-skill')
      expect(entry.display_name).toBe('legacy-skill') // fm.name
      expect(entry.description).toBe('test') // fm.description
    })

    it('uses manifest summary but falls back to fm.name when world_name is missing', () => {
      const skillPath = makeSkill(tmp, 'partial-skill', {
        engine_version: 2,
        version: '0.1.0',
        world_slug: 'partial',
        summary: 'only summary is set',
      })
      const entry = buildEntry(skillPath)
      expect(entry.slug).toBe('partial')
      expect(entry.display_name).toBe('partial-skill') // fm.name fallback
      expect(entry.description).toBe('only summary is set')
    })
  })
})
