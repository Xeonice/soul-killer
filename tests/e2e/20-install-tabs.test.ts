import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { TestTerminal } from './harness/test-terminal.js'
import { createTestHome, type TestHome } from './fixtures/test-home.js'
import { MockCatalogServer } from './harness/mock-catalog-server.js'
import { PROMPT_RE, WIZARD_STEP_TIMEOUT, DEBUG } from './harness/helpers.js'

describe('E2E: /install dual-tab UI', () => {
  let home: TestHome
  let term: TestTerminal | undefined
  let server: MockCatalogServer
  let catalogUrl: string

  beforeEach(async () => {
    home = createTestHome()
    server = new MockCatalogServer()
    server.addSkill({ slug: 'alpha-skill', displayName: 'Alpha', version: '1.0.0' })
    server.addSkill({ slug: 'beta-skill',  displayName: 'Beta',  version: '2.0.0' })
    catalogUrl = await server.start()
  })

  afterEach(async () => {
    if (DEBUG) term?.printTimeline()
    term?.kill()
    home?.cleanup()
    await server.stop()
  })

  function seedInstalled(slug: string, version: string): void {
    const dir = path.join(home.homeDir, '.claude', 'skills', slug)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${slug}\n---\n`)
    fs.writeFileSync(
      path.join(dir, 'soulkiller.json'),
      JSON.stringify({ skill_id: slug, version, engine_version: 2 }),
    )
  }

  async function startRepl(): Promise<TestTerminal> {
    const t = new TestTerminal({
      homeDir: home.homeDir,
      label: 'install-tabs',
      env: { SOULKILLER_CATALOG_URL: catalogUrl },
    })
    await t.waitFor(PROMPT_RE, { timeout: 30000 })
    return t
  }

  it('defaults to Available tab; Tab switches to Installed', async () => {
    term = await startRepl()
    term.send('/install')

    // Wait for the Available tab header to render (both tab labels are visible)
    await term.waitFor(/Available/, { timeout: WIZARD_STEP_TIMEOUT })
    // Pick-skills step renders alpha-skill and beta-skill from the catalog
    await term.waitFor(/alpha-skill/, { timeout: WIZARD_STEP_TIMEOUT })

    // Tab → Installed tab
    await term.sendKeyAfter('tab')
    await term.waitFor(/已安装|Installed/, { timeout: WIZARD_STEP_TIMEOUT })
    // No soulkiller skills installed → empty message
    await term.waitFor(/还没有已装|No skills installed/, { timeout: WIZARD_STEP_TIMEOUT })

    // Tab → back to Available
    await term.sendKeyAfter('tab')
    await term.waitFor(/alpha-skill/, { timeout: WIZARD_STEP_TIMEOUT })
  }, 60000)

  it('Installed tab lists seeded soulkiller skills only', async () => {
    // Seed two installed skills + one generic Claude Code skill (should be filtered out)
    seedInstalled('alpha-skill', '1.0.0')
    seedInstalled('beta-skill',  '1.5.0')
    // Generic Claude Code skill (no soulkiller.json) — scanner must skip
    const generic = path.join(home.homeDir, '.claude', 'skills', 'ai-sdk')
    fs.mkdirSync(generic, { recursive: true })
    fs.writeFileSync(path.join(generic, 'SKILL.md'), '---\nname: ai-sdk\n---\n')

    term = await startRepl()
    term.send('/install')
    await term.waitFor(/Available/, { timeout: WIZARD_STEP_TIMEOUT })

    await term.sendKeyAfter('tab')
    await term.waitFor(/已安装|Installed/, { timeout: WIZARD_STEP_TIMEOUT })
    // Both soulkiller skills listed
    await term.waitFor(/alpha-skill/, { timeout: WIZARD_STEP_TIMEOUT })
    await term.waitFor(/beta-skill/, { timeout: WIZARD_STEP_TIMEOUT })
    // Generic skill must NOT be listed
    const snapshot = term.getBuffer()
    expect(snapshot.includes('ai-sdk')).toBe(false)
  }, 60000)

  it('Installed → Enter opens action menu; Esc returns to list', async () => {
    seedInstalled('alpha-skill', '1.0.0')
    term = await startRepl()
    term.send('/install')
    await term.waitFor(/Available/, { timeout: WIZARD_STEP_TIMEOUT })

    await term.sendKeyAfter('tab')
    await term.waitFor(/alpha-skill/, { timeout: WIZARD_STEP_TIMEOUT })

    // Enter opens action menu
    await term.sendKeyAfter('enter')
    await term.waitFor(/卸载|Uninstall/, { timeout: WIZARD_STEP_TIMEOUT })
    await term.waitFor(/查看详情|Details/, { timeout: WIZARD_STEP_TIMEOUT })

    // Esc → back to Installed list
    await term.sendKeyAfter('escape')
    await term.waitFor(/alpha-skill/, { timeout: WIZARD_STEP_TIMEOUT })
  }, 60000)
})
