import { describe, it, expect, afterEach, beforeEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { unzipSync } from 'fflate'

/**
 * Sanity check: every shipped example archive complies with the
 * Skill / Binary Contract whitelist. Mirrors the CI verify-skill-archive-purity
 * job at the e2e tier so a regression breaks the local test loop too.
 */

const SKILLS_DIR = path.resolve(import.meta.dir, '..', '..', 'examples', 'skills')

const ALLOWED_FILES = new Set(['SKILL.md', 'soulkiller.json', 'story-spec.md', 'runtime/engine.md'])
const ALLOWED_PREFIXES = ['souls/', 'world/', 'runtime/scripts/', 'runtime/saves/', 'runtime/tree/']
const FORBIDDEN_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.sh', '.bat', '.ps1', '.py', '.rb']

function checkArchive(file: string): string[] {
  const bytes = new Uint8Array(fs.readFileSync(file))
  const entries = unzipSync(bytes)
  const all = Object.keys(entries)
  const wrappers = new Set(all.map((p) => p.split('/')[0] ?? ''))
  if (wrappers.size !== 1) throw new Error(`multi-wrapper: ${[...wrappers].join(',')}`)
  const wrap = [...wrappers][0]!
  const violations: string[] = []
  for (const p of all) {
    const rel = p.slice(wrap.length + 1)
    if (rel.length === 0 || rel.endsWith('/')) continue
    if (ALLOWED_FILES.has(rel)) continue
    if (ALLOWED_PREFIXES.some((pre) => rel.startsWith(pre))) {
      if (FORBIDDEN_EXTENSIONS.some((ext) => rel.endsWith(ext))) {
        violations.push(`${rel} (executable extension under allowed dir)`)
      }
      continue
    }
    violations.push(`${rel} (not in whitelist)`)
  }
  return violations
}

describe('E2E: exported skill purity (Skill/Binary contract)', () => {
  it('every examples/skills/*.skill is contract-compliant', () => {
    const skills = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill'))
    expect(skills.length).toBeGreaterThan(0)
    for (const name of skills) {
      const violations = checkArchive(path.join(SKILLS_DIR, name))
      if (violations.length > 0) {
        throw new Error(`${name}:\n  ${violations.join('\n  ')}`)
      }
    }
  })
})
