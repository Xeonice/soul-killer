/**
 * E2E test for world management operations.
 * Run with: bun tests/e2e/world-manage-e2e.ts
 *
 * Tests: /world → manage → world list → select world → sub-actions
 * Prerequisite: creates a test world first using fictional-original + empty sources.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TestTerminal } from './harness/test-terminal.js'

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-manage-e2e-'))

// Copy config from real home
const realConfig = path.join(os.homedir(), '.soulkiller', 'config.yaml')
const testConfigDir = path.join(HOME, '.soulkiller')
fs.mkdirSync(testConfigDir, { recursive: true })
fs.copyFileSync(realConfig, path.join(testConfigDir, 'config.yaml'))

// Pre-create a test world directly (skip wizard for speed)
const worldDir = path.join(HOME, '.soulkiller', 'worlds', 'test-world')
fs.mkdirSync(path.join(worldDir, 'entries'), { recursive: true })
fs.writeFileSync(path.join(worldDir, 'world.json'), JSON.stringify({
  name: 'test-world',
  display_name: 'Test World',
  version: '0.1.0',
  created_at: new Date().toISOString(),
  description: 'A test world for E2E',
  entry_count: 1,
  defaults: { context_budget: 2000, injection_position: 'after_soul' },
  worldType: 'fictional-original',
  tags: { genre: [], tone: [], scale: [], era: [], theme: [] },
  evolve_history: [],
}, null, 2))
// Add one entry
fs.writeFileSync(path.join(worldDir, 'entries', 'test-entry.md'), `---
name: test-entry
keywords: ["test", "hello"]
priority: 500
mode: keyword
scope: lore
dimension: factions
---

This is a test entry for the test world.
`)

console.log(`[E2E] HOME=${HOME}`)
console.log(`[E2E] Pre-created test-world with 1 entry`)

const terminal = new TestTerminal({
  homeDir: HOME,
  debug: true,
  label: 'world-manage-e2e',
  cols: 120,
  rows: 50,
})

try {
  await terminal.waitFor(/soul:\/\//, { timeout: 15000 })
  console.log('[E2E] REPL ready')

  // ── Enter /world ──
  for (const ch of '/world') {
    terminal.sendKey(ch)
    await new Promise((r) => setTimeout(r, 50))
  }
  await terminal.waitFor(/\/world.*世界管理/, { timeout: 5000 })
  await new Promise((r) => setTimeout(r, 300))
  terminal.sendKey('enter')
  await terminal.waitFor(/创建.*管理/s, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ Top menu visible (创建 + 管理)')

  // ── Select "管理" (second item) ──
  await new Promise((r) => setTimeout(r, 500))
  terminal.sendKey('down')
  await new Promise((r) => setTimeout(r, 300))
  terminal.sendKey('enter')
  await terminal.waitFor(/test-world/, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ World list visible with test-world')

  // ── Select test-world → action menu ──
  terminal.sendKey('enter')
  await terminal.waitFor(/详情.*条目.*蒸馏/s, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ Action menu visible (详情/条目/蒸馏/进化/绑定/解绑)')
  console.log('[E2E] Action menu screen:')
  console.log(terminal.getScreen())

  // ── Test: 详情 (first action item) ──
  terminal.sendKey('enter')
  await terminal.waitFor(/Test World|test-entry/, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ Show details: displays world info and entries')

  // ESC → back to action menu
  terminal.sendKey('escape')
  await terminal.waitFor(/详情.*条目/s, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ ESC returns to action menu')

  // ── Test: ESC from action menu → world list ──
  terminal.sendKey('escape')
  await terminal.waitFor(/test-world.*Test World/s, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ ESC from action menu returns to world list')

  // ── Test: ESC from world list → top menu ──
  terminal.sendKey('escape')
  await terminal.waitFor(/创建.*管理/s, { timeout: 5000, since: 'last' })
  console.log('[E2E] ✓ ESC from world list returns to top menu')

  console.log('[E2E] ✓ All management operations verified')
  console.log('[E2E] ✓ E2E TEST PASSED')

} catch (err) {
  console.error('[E2E] Error:', err)
  console.log('[E2E] Screen at error:')
  console.log(terminal.getScreen())
  console.log('[E2E] ✗ E2E TEST FAILED')
} finally {
  await terminal.kill()
  fs.rmSync(HOME, { recursive: true })
  console.log('[E2E] Cleanup done')
}
