import { describe, it, expect } from 'vitest'
import { lintAuthorVersion } from '../../../src/export/support/lint-index.js'

describe('lintAuthorVersion', () => {
  it('passes silently for a real author version', () => {
    const json = JSON.stringify({
      engine_version: 2,
      soulkiller_version: '0.5.0',
      skill_id: 'alpha',
      version: '0.1.0',
    })
    const report = lintAuthorVersion(json)
    expect(report.warnings).toHaveLength(0)
    expect(report.errors).toHaveLength(0)
  })

  it('warns when version field is missing', () => {
    const json = JSON.stringify({
      engine_version: 2,
      soulkiller_version: '0.5.0',
      skill_id: 'alpha',
    })
    const report = lintAuthorVersion(json)
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.rule).toBe('AUTHOR_VERSION_PRESENT')
    expect(report.warnings[0]!.message).toContain("lacks 'version'")
  })

  it('warns when version is 0.0.0 (reserved for back-fill)', () => {
    const json = JSON.stringify({
      engine_version: 2,
      version: '0.0.0',
    })
    const report = lintAuthorVersion(json)
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.message).toContain('0.0.0')
  })

  it('warns when version is empty string', () => {
    const json = JSON.stringify({ engine_version: 2, version: '' })
    const report = lintAuthorVersion(json)
    expect(report.warnings).toHaveLength(1)
  })

  it('warns when soulkiller.json is malformed', () => {
    const report = lintAuthorVersion('not-json')
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.message).toContain('malformed')
  })

  it('accepts freeform version strings above 0.0.0', () => {
    const report = lintAuthorVersion(JSON.stringify({ version: '2026.04.15' }))
    expect(report.warnings).toHaveLength(0)
  })
})
