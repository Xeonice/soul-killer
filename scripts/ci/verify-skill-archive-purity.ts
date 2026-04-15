#!/usr/bin/env bun
/**
 * CI enforcement for the Skill / Binary Contract invariant.
 *
 * Unpacks every `.skill` archive under examples/skills/ and asserts every
 * entry matches the whitelist in `checkArchiveContract`. Any violation
 * fails the job so a PR reintroducing runtime/lib/, foreign top-level
 * dirs, or executable code inside archives is rejected.
 *
 * See CLAUDE.md "Skill / Binary Contract (Invariant)".
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { checkArchiveContract } from '../../src/export/packager.js'

const SKILLS_DIR = resolve(import.meta.dir, '..', '..', 'examples', 'skills')

function stripWrapper(paths: string[]): string[] {
  // Every shipped archive wraps files under a single top-level dir (skill_id/).
  // Strip it so the whitelist applies to the semantic path.
  const wrappers = new Set<string>()
  for (const p of paths) {
    const seg = p.split('/')[0] ?? ''
    wrappers.add(seg)
  }
  if (wrappers.size !== 1) {
    throw new Error(`archive has multiple top-level dirs: ${Array.from(wrappers).join(', ')}`)
  }
  const [wrap] = wrappers
  return paths
    .map((p) => p.slice(wrap!.length + 1))
    .filter((p) => p.length > 0 && !p.endsWith('/'))
}

function checkArchive(file: string): { file: string; violations: ReturnType<typeof checkArchiveContract> } {
  const bytes = new Uint8Array(readFileSync(file))
  const entries = unzipSync(bytes)
  const paths = Object.keys(entries)
  const stripped = stripWrapper(paths)
  return { file, violations: checkArchiveContract(stripped) }
}

function main(): number {
  const skills = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill'))
  if (skills.length === 0) {
    console.log('no .skill files to check')
    return 0
  }
  let failed = 0
  for (const name of skills) {
    const { violations } = checkArchive(join(SKILLS_DIR, name))
    if (violations.length > 0) {
      console.error(`✗ ${name}`)
      for (const v of violations) console.error(`    - ${v.path}  (${v.reason})`)
      failed++
    } else {
      console.log(`✓ ${name}`)
    }
  }
  if (failed > 0) {
    console.error('')
    console.error(`${failed}/${skills.length} archive(s) violate the Skill/Binary contract.`)
    console.error('See CLAUDE.md "Skill / Binary Contract (Invariant)" for allowed layouts.')
    return 1
  }
  console.log('')
  console.log(`✓ all ${skills.length} archive(s) are contract-compliant`)
  return 0
}

process.exit(main())
