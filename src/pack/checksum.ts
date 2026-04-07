import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Recursively collect all file paths under a directory, sorted alphabetically.
 */
function collectFiles(dir: string, base: string = ''): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...collectFiles(path.join(dir, entry.name), rel))
    } else {
      results.push(rel)
    }
  }
  return results.sort()
}

/**
 * Compute SHA-256 checksum over all files in a directory, excluding pack-meta.json.
 * Files are processed in sorted path order with their contents concatenated.
 */
export function computeChecksum(dir: string): string {
  const files = collectFiles(dir).filter((f) => f !== 'pack-meta.json')
  const hash = crypto.createHash('sha256')
  for (const file of files) {
    hash.update(fs.readFileSync(path.join(dir, file)))
  }
  return `sha256:${hash.digest('hex')}`
}

/**
 * Verify that a directory's checksum matches the expected value.
 */
export function verifyChecksum(dir: string, expected: string): boolean {
  const actual = computeChecksum(dir)
  return actual === expected
}
