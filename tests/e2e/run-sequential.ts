#!/usr/bin/env bun
/**
 * Sequential E2E test runner.
 * PTY-based tests cannot run in parallel — multiple Bun.spawn terminal
 * processes compete for resources and cause flaky timeouts.
 * This runner executes each test file one at a time.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'

const dir = import.meta.dirname
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()

let passed = 0
let failed = 0
const failures: string[] = []

for (const file of files) {
  const filePath = path.join(dir, file)
  const proc = Bun.spawn(['bun', 'test', filePath, '--timeout', '60000'], {
    cwd: path.resolve(dir, '..', '..'),
    env: { ...process.env },
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const code = await proc.exited

  if (code === 0) {
    passed++
    console.log(`✓ ${file}`)
  } else {
    failed++
    failures.push(file)
    console.log(`✗ ${file}`)
  }
}

console.log(`\n${passed} pass, ${failed} fail (${files.length} files)`)
if (failures.length > 0) {
  console.log(`Failed: ${failures.join(', ')}`)
  process.exit(1)
}

