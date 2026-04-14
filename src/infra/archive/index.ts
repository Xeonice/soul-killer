import fs from 'node:fs'
import path from 'node:path'
import { unzipSync, gunzipSync } from 'fflate'
import { parseTar } from 'nanotar'

export interface ExtractOptions {
  /**
   * If true and the archive root contains exactly one directory whose content
   * holds the real files, strip that wrapper directory when writing. The caller
   * can opt out (e.g., for release tarballs that already have the expected
   * top-level layout).
   */
  stripSingleRootDir?: boolean
}

interface ArchiveEntry {
  /** POSIX-style relative path inside the archive */
  path: string
  /** File bytes; undefined for directory entries */
  data?: Uint8Array
  /** true if this entry represents a directory */
  isDirectory: boolean
}

// ── Archive readers ────────────────────────────────────────────────

function readZip(buf: Uint8Array): ArchiveEntry[] {
  const files = unzipSync(buf)
  const entries: ArchiveEntry[] = []
  for (const [name, data] of Object.entries(files)) {
    const isDirectory = name.endsWith('/')
    entries.push({
      path: normalizePosix(name),
      data: isDirectory ? undefined : data,
      isDirectory,
    })
  }
  return entries
}

function readTarGz(buf: Uint8Array): ArchiveEntry[] {
  const tarBytes = gunzipSync(buf)
  const items = parseTar(tarBytes)
  const entries: ArchiveEntry[] = []
  for (const item of items) {
    const isDirectory = item.type === 'directory' || item.name.endsWith('/')
    entries.push({
      path: normalizePosix(item.name),
      data: isDirectory ? undefined : item.data,
      isDirectory,
    })
  }
  return entries
}

// ── Root-dir stripping ─────────────────────────────────────────────

/**
 * If every entry shares the same top-level directory, return that prefix.
 * Otherwise return null. The prefix includes the trailing slash for easy
 * removal via `.slice(prefix.length)`.
 */
function detectCommonRoot(entries: ArchiveEntry[]): string | null {
  let candidate: string | null = null
  for (const e of entries) {
    // Ignore empty paths that sometimes slip through
    if (!e.path) continue
    const slash = e.path.indexOf('/')
    // Top-level files (no slash) disqualify stripping
    if (slash === -1 && !e.isDirectory) return null
    const top = slash === -1 ? e.path : e.path.slice(0, slash)
    if (!top) return null
    if (candidate === null) candidate = top
    else if (candidate !== top) return null
  }
  return candidate ? candidate + '/' : null
}

// ── Writers ────────────────────────────────────────────────────────

function writeEntries(entries: ArchiveEntry[], outDir: string, opts: ExtractOptions): void {
  const prefix = opts.stripSingleRootDir ? detectCommonRoot(entries) : null

  fs.mkdirSync(outDir, { recursive: true })

  for (const entry of entries) {
    let rel = entry.path
    if (prefix && rel.startsWith(prefix)) rel = rel.slice(prefix.length)
    if (!rel) continue

    const dest = safeJoin(outDir, rel)

    if (entry.isDirectory) {
      fs.mkdirSync(dest, { recursive: true })
      continue
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true })
    if (entry.data) fs.writeFileSync(dest, entry.data)
  }
}

/** Reject any relative path that would escape outDir. */
function safeJoin(outDir: string, rel: string): string {
  const resolved = path.resolve(outDir, rel)
  const base = path.resolve(outDir)
  // Require that resolved is inside base (handles Windows paths too)
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`archive entry escapes output directory: ${rel}`)
  }
  return resolved
}

function normalizePosix(p: string): string {
  // Tar/zip paths should already be POSIX; drop any leading `./`
  return p.replace(/^\.\//, '')
}

// ── Public API ─────────────────────────────────────────────────────

/** Extract a `.zip` archive (bytes or Uint8Array) to outDir. */
export function extractZip(buf: Uint8Array | ArrayBuffer, outDir: string, opts: ExtractOptions = {}): void {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  writeEntries(readZip(bytes), outDir, opts)
}

/** Extract a `.tar.gz` archive to outDir. */
export function extractTarGz(buf: Uint8Array | ArrayBuffer, outDir: string, opts: ExtractOptions = {}): void {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  writeEntries(readTarGz(bytes), outDir, opts)
}

/** Expose the common-root detector for tests and callers that need to preview. */
export { detectCommonRoot }
