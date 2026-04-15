import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest, shouldInclude } from '../../../../scripts/gen-state-manifest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_DIR = path.resolve(__dirname, '../../../../src/export/state')
const MANIFEST_PATH = path.join(STATE_DIR, 'manifest.ts')

function scanStateFiles(): string[] {
  return fs.readdirSync(STATE_DIR).filter(shouldInclude).sort()
}

describe('state manifest parity', () => {
  it('committed manifest matches current state/ directory', () => {
    const files = scanStateFiles()
    const expected = buildManifest(files, STATE_DIR)
    const actual = fs.readFileSync(MANIFEST_PATH, 'utf8')
    if (actual !== expected) {
      const fail =
        `\nsrc/export/state/manifest.ts is OUT OF DATE.\n` +
        `Run: bun scripts/gen-state-manifest.ts\n\n` +
        `(The compiled binary relies on this manifest being bundler-visible; ` +
        `leaving it stale breaks \`injectRuntimeFiles\` in release builds.)\n`
      expect(actual, fail).toBe(expected)
    }
  })

  it('every state/*.ts file is referenced in RUNTIME_FILES', async () => {
    const { RUNTIME_FILES } = await import('../../../../src/export/state/manifest.js')
    const files = scanStateFiles()
    for (const f of files) {
      if (!(f in RUNTIME_FILES)) {
        throw new Error(
          `${f} is in src/export/state/ but not in manifest — ` +
            `run 'bun scripts/gen-state-manifest.ts'`,
        )
      }
    }
  })

  it('RUNTIME_FILES has no ghost entries', async () => {
    const { RUNTIME_FILES } = await import('../../../../src/export/state/manifest.js')
    const onDisk = new Set(scanStateFiles())
    for (const name of Object.keys(RUNTIME_FILES)) {
      if (!onDisk.has(name)) {
        throw new Error(
          `${name} is in manifest but not in src/export/state/ — ` +
            `run 'bun scripts/gen-state-manifest.ts'`,
        )
      }
    }
  })
})
