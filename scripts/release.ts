#!/usr/bin/env bun
/**
 * Atomic release helper — keeps `package.json.version` and the `vX.Y.Z` git
 * tag strictly in sync.
 *
 * Usage:
 *   bun scripts/release.ts <version>   # e.g. 0.7.0
 *   bun scripts/release.ts patch        # semver bump: 0.6.2 → 0.6.3
 *   bun scripts/release.ts minor        # 0.6.2 → 0.7.0
 *   bun scripts/release.ts major        # 0.6.2 → 1.0.0
 *
 * Flow:
 *   1. Ensure working tree is clean
 *   2. Compute new version
 *   3. Update package.json
 *   4. Commit with message "chore(release): vX.Y.Z"
 *   5. Tag vX.Y.Z pointing at that commit
 *   6. Print instructions for push (not pushed automatically — operator review)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dir, '..')
const PKG = join(ROOT, 'package.json')

function sh(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function bumpSemver(current: string, kind: 'major' | 'minor' | 'patch'): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current)
  if (!m) throw new Error(`current version "${current}" is not plain semver — specify explicit version`)
  let [, maj, min, pat] = m
  if (kind === 'major') return `${Number(maj) + 1}.0.0`
  if (kind === 'minor') return `${maj}.${Number(min) + 1}.0`
  return `${maj}.${min}.${Number(pat) + 1}`
}

const arg = process.argv[2]
if (!arg) {
  console.error('usage: bun scripts/release.ts <version|patch|minor|major>')
  process.exit(2)
}

// 1. Clean working tree — only tracked files; untracked local artifacts ignored.
const status = sh('git status --porcelain -uno')
if (status.length > 0) {
  console.error('✗ tracked files have uncommitted changes; commit or stash first')
  console.error(status)
  process.exit(1)
}

// 2. Compute version
const pkg = JSON.parse(readFileSync(PKG, 'utf8')) as { version: string; [k: string]: unknown }
const current = pkg.version
let next: string
if (arg === 'patch' || arg === 'minor' || arg === 'major') {
  next = bumpSemver(current, arg)
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg
} else {
  console.error(`✗ invalid version "${arg}" — expected semver X.Y.Z or one of: patch / minor / major`)
  process.exit(2)
}
if (next === current) {
  console.error(`✗ new version "${next}" matches current — nothing to do`)
  process.exit(1)
}

// Ensure the tag doesn't exist yet
const existingTags = sh('git tag').split('\n')
if (existingTags.includes(`v${next}`)) {
  console.error(`✗ tag v${next} already exists`)
  process.exit(1)
}

console.log(`  releasing ${current} → ${next}`)

// 3. Rewrite package.json (preserve formatting: 2-space + trailing newline)
pkg.version = next
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n')
console.log('  ✓ package.json updated')

// 4. Commit
sh(`git add package.json`)
sh(`git commit -m "chore(release): v${next}"`)
console.log(`  ✓ committed`)

// 5. Tag
sh(`git tag -a v${next} -m "v${next}"`)
console.log(`  ✓ tagged v${next}`)

// 6. Next steps
console.log('')
console.log('  Next:')
console.log(`    git push origin main && git push origin v${next}`)
