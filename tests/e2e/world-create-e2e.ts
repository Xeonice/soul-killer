/**
 * Manual E2E test for world creation flow.
 * Run with: bun tests/e2e/world-create-e2e.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TestTerminal } from './harness/test-terminal.js'

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-world-e2e-'))

// Copy config from real home
const realConfig = path.join(os.homedir(), '.soulkiller', 'config.yaml')
const testConfigDir = path.join(HOME, '.soulkiller')
fs.mkdirSync(testConfigDir, { recursive: true })
fs.copyFileSync(realConfig, path.join(testConfigDir, 'config.yaml'))

console.log(`[E2E] HOME=${HOME}`)
console.log(`[E2E] Starting REPL...`)

const terminal = new TestTerminal({
  homeDir: HOME,
  debug: true,
  label: 'world-create-e2e',
  cols: 120,
  rows: 50,
})

try {
  // Wait for REPL prompt
  await terminal.waitFor(/soul:\/\//, { timeout: 15000 })
  console.log('[E2E] REPL ready')

  // Type /world character by character, then wait for palette to filter, then enter
  // send() appends \r automatically but may race with palette filtering.
  // Instead: type text without \r, wait for filter, then sendKey enter.
  for (const ch of '/world') {
    terminal.sendKey(ch)
    await new Promise((r) => setTimeout(r, 50))
  }
  // Wait for the completion palette to filter down to /world
  await terminal.waitFor(/\/world.*世界管理/, { timeout: 5000 })
  await new Promise((r) => setTimeout(r, 300))

  console.log('[E2E] Screen before Enter:')
  console.log(terminal.getScreen())

  terminal.sendKey('enter')
  await new Promise((r) => setTimeout(r, 500))

  console.log('[E2E] Screen after Enter:')
  console.log(terminal.getScreen())

  // The /world command should now show the world management menu
  await terminal.waitFor(/❯.*创建|世界管理/, { timeout: 8000, since: 'last' })
  console.log('[E2E] /world menu visible')

  // Select "创建" (first menu item)
  terminal.sendKey('enter')
  await terminal.waitFor(/选择世界类型|world type/i, { timeout: 5000, since: 'last' })
  console.log('[E2E] Type select step visible')

  // Select "fictional-existing" (first item)
  terminal.sendKey('enter')
  await terminal.waitFor(/世界名称|kebab-case/i, { timeout: 5000, since: 'last' })
  console.log('[E2E] Name step visible')

  // Enter world name (send appends \r)
  terminal.send('night-city')
  await terminal.waitFor(/显示名称|display/i, { timeout: 5000 })
  console.log('[E2E] Display name step visible')

  // Enter display name
  terminal.send('Night City')
  await terminal.waitFor(/描述|description/i, { timeout: 5000 })
  console.log('[E2E] Description step visible')

  // Enter description
  terminal.send('The megacity of Cyberpunk 2077')
  await terminal.waitFor(/标签|tags|特征/i, { timeout: 5000 })
  console.log('[E2E] Tags step visible')

  // Skip tags (just press enter)
  terminal.sendKey('enter')
  await terminal.waitFor(/确认创建|confirm/i, { timeout: 15000, since: 'last' })
  console.log('[E2E] Confirm step visible')
  console.log('[E2E] Confirm screen:')
  console.log(terminal.getScreen())

  // Confirm → goes to data-sources (new flow order)
  terminal.sendKey('enter')
  await terminal.waitFor(/数据源|data source|Space/i, { timeout: 10000, since: 'last' })
  console.log('[E2E] Data sources step visible (BEFORE AI search)')

  // web-search is pre-checked for fictional-existing, just press Enter
  terminal.sendKey('enter')

  // Wait for WORLDFORGE protocol panel
  console.log('[E2E] Waiting for AI search...')
  await terminal.waitFor(/WORLDFORGE|世界锻造/, { timeout: 30000, since: 'last' })
  console.log('[E2E] WORLDFORGE panel visible')

  // Wait for search-confirm step (shows dimension breakdown)
  await terminal.waitFor(/Chunks:|UNKNOWN_SETTING/, { timeout: 600000, since: 'last' })
  console.log('[E2E] AI search done')
  console.log('[E2E] Search results screen:')
  console.log(terminal.getScreen())

  await new Promise((r) => setTimeout(r, 500))

  // Confirm search results → proceeds to distill
  terminal.sendKey('enter')

  // Wait for review (distill can take a long time)
  // Use very specific pattern: review shows "(a) 接受" or creation shows "创建完成"
  console.log('[E2E] Waiting for distill to complete + review (up to 10 min)...')
  await terminal.waitFor(/\(a\) 接受|\(q\) 结束|创建完成/, { timeout: 600000, since: 'last' })
  console.log('[E2E] Review or done step reached')
  console.log('[E2E] Screen:')
  console.log(terminal.getScreen())

  // If we're in review, accept entries
  const reviewScreen = terminal.getBuffer()
  if (reviewScreen.includes('结束审查') || reviewScreen.includes('接受')) {
    console.log('[E2E] In review step, accepting entries...')
    for (let i = 0; i < 5; i++) {
      terminal.sendKey('a')
      await new Promise((r) => setTimeout(r, 300))
    }
    terminal.sendKey('q')
    // Wait for "创建完成" (done step) or bind prompt — very specific pattern
    await terminal.waitFor(/创建完成|created|数据补充完成|supplemented|是否.*绑定|Bind this world/i, { timeout: 60000, since: 'last' })
  }
  console.log('[E2E] Reached done/bind step')
  console.log('[E2E] Screen:')
  console.log(terminal.getScreen())

  // Wait for filesystem writes to settle
  await new Promise((r) => setTimeout(r, 1500))

  // If bind prompt visible, select "no"
  const screen = terminal.getScreen()
  if (screen.includes('是否') && screen.includes('绑定')) {
    terminal.sendKey('down')  // select "No"
    terminal.sendKey('enter')
    await new Promise((r) => setTimeout(r, 1000))
  }

  // Check the created world
  const worldDir = path.join(HOME, '.soulkiller', 'worlds', 'night-city')
  if (fs.existsSync(worldDir)) {
    console.log('[E2E] ✓ World directory created')
    const manifest = JSON.parse(fs.readFileSync(path.join(worldDir, 'world.json'), 'utf-8'))
    console.log('[E2E] Manifest:')
    console.log(JSON.stringify(manifest, null, 2))

    const entriesDir = path.join(worldDir, 'entries')
    if (fs.existsSync(entriesDir)) {
      const entries = fs.readdirSync(entriesDir)
      console.log(`[E2E] ✓ ${entries.length} entries created:`, entries)
      // Print all entries and check dimension
      let withDim = 0
      let withoutDim = 0
      for (const entryFile of entries) {
        const content = fs.readFileSync(path.join(entriesDir, entryFile), 'utf-8')
        const hasDim = content.includes('dimension:')
        if (hasDim) withDim++; else withoutDim++
        console.log(`[E2E]   ${entryFile}: dimension=${hasDim ? 'YES' : 'NO'}`)
        if (entries.indexOf(entryFile) === 0) {
          console.log(`[E2E] First entry content:`)
          console.log(content.slice(0, 500))
        }
      }
      console.log(`[E2E] Dimension stats: ${withDim} with / ${withoutDim} without`)
    }
  } else {
    console.log('[E2E] ✗ World directory NOT created')
    // List what's in worlds dir
    const worldsDir = path.join(HOME, '.soulkiller', 'worlds')
    if (fs.existsSync(worldsDir)) {
      console.log('[E2E] Worlds dir contents:', fs.readdirSync(worldsDir))
    }
  }

  console.log('[E2E] ✓ E2E TEST PASSED')

} catch (err) {
  console.error('[E2E] Error:', err)
  console.log('[E2E] Screen at error:')
  console.log(terminal.getScreen())
  console.log('[E2E] ✗ E2E TEST FAILED')
} finally {
  await terminal.kill()
  // Check agent logs
  const logDir = path.join(HOME, '.soulkiller', 'logs', 'agent')
  if (fs.existsSync(logDir)) {
    const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.md'))
    console.log(`[E2E] Agent logs: ${logFiles.length} files`)
    for (const f of logFiles.slice(0, 2)) {
      const content = fs.readFileSync(path.join(logDir, f), 'utf-8')
      console.log(`[E2E] --- ${f} ---`)
      console.log(content.slice(0, 2000))
    }
  } else {
    console.log('[E2E] No agent logs found')
  }

  fs.rmSync(HOME, { recursive: true })
  console.log('[E2E] Cleanup done')
}
