/**
 * Self-update: query GitHub Releases, compare binary hash, download if changed.
 */

import { readFileSync, writeFileSync, renameSync, chmodSync, unlinkSync, existsSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const REPO = 'Xeonice/soul-killer'
const CDN_BASE = 'https://soulkiller-download.ad546971975.workers.dev'

function detectPlatform(): string {
  const os = process.platform === 'darwin' ? 'darwin'
    : process.platform === 'win32' ? 'windows'
    : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${os}-${arch}`
}

interface GitHubRelease {
  tag_name: string
  assets: Array<{ name: string; browser_download_url: string }>
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'soulkiller-updater' },
  })
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<GitHubRelease>
}

function parseVersion(tag: string): string {
  return tag.replace(/^v/, '')
}

// ── Hash utilities ──────────────────────────────────────────────

async function hashFile(path: string): Promise<string> {
  const data = readFileSync(path)
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(data)
  return hasher.digest('hex')
}

function hashBuffer(data: ArrayBuffer | Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(data instanceof Uint8Array ? data : new Uint8Array(data))
  return hasher.digest('hex')
}

type ChecksumMap = Record<string, string>

async function fetchChecksums(): Promise<ChecksumMap | null> {
  // Try CDN first, then GitHub Release asset
  const urls = [
    `${CDN_BASE}/releases/latest/checksums.txt`,
    `https://github.com/${REPO}/releases/latest/download/checksums.txt`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'soulkiller-updater' },
        redirect: 'follow',
      })
      if (!res.ok) continue
      const text = await res.text()
      return parseChecksums(text)
    } catch {
      continue
    }
  }

  return null
}

function parseChecksums(text: string): ChecksumMap {
  const map: ChecksumMap = {}
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/)
    if (match) {
      map[match[2]] = match[1]
    }
  }
  return map
}

// ── Unified replace primitive ───────────────────────────────────
//
// All platform-specific replace logic is consolidated here. runUpdate()
// calls atomicReplaceBinary() once; it does not branch on platform.
// Errors are classified into typed ReplaceFailure codes so the caller
// can drive user-facing messages off a switch instead of string matching.

export type ReplaceFailure =
  | { code: 'LOCKED';     message: string }
  | { code: 'PERMISSION'; message: string }
  | { code: 'DISK_FULL';  message: string }
  | { code: 'UNKNOWN';    message: string; cause?: Error }

export type ReplaceResult = { ok: true } | { ok: false; reason: ReplaceFailure }

/**
 * Resolve a path through any symlinks / junctions. Falls back to the
 * input unchanged if realpath fails (e.g. permission-restricted parent).
 *
 * Fixes Bun issue #15279: symlinked install dirs on Windows caused rename
 * to fail across volumes. Canonicalizing first makes replace atomic.
 */
export function resolveTargetPath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/**
 * Minimal fs-op surface consumed by atomicReplaceBinary. Factoring this out
 * lets tests inject synthetic failures without trying to vi.spyOn the ESM
 * node:fs namespace (which is non-configurable).
 */
export interface ReplaceOps {
  rename(from: string, to: string): void
  writeFile(target: string, data: Uint8Array): void
  readFile(src: string): Uint8Array
  chmod(target: string, mode: number): void
  exists(target: string): boolean
  unlink(target: string): void
}

const realOps: ReplaceOps = {
  rename: (from, to) => renameSync(from, to),
  writeFile: (target, data) => writeFileSync(target, data),
  readFile: (src) => readFileSync(src),
  chmod: (target, mode) => chmodSync(target, mode),
  exists: (target) => existsSync(target),
  unlink: (target) => unlinkSync(target),
}

/**
 * Map a raw fs error to a typed ReplaceFailure. The `defaultCode` is used
 * when the errno doesn't match any known bucket.
 */
function mapError(err: unknown, defaultCode: ReplaceFailure['code'] = 'UNKNOWN'): ReplaceFailure {
  const e = err as NodeJS.ErrnoException
  const code = e.code
  const errMsg = e.message ?? String(err)
  if (code === 'EBUSY' || code === 'ETXTBSY' || code === 'EPERM' || code === 'ERROR_SHARING_VIOLATION') {
    return { code: 'LOCKED', message: `executable is locked (${code}): ${errMsg}` }
  }
  if (code === 'EACCES') {
    return { code: 'PERMISSION', message: `permission denied: ${errMsg}` }
  }
  if (code === 'ENOSPC') {
    return { code: 'DISK_FULL', message: `disk full: ${errMsg}` }
  }
  return {
    code: defaultCode,
    message: errMsg,
    ...(err instanceof Error ? { cause: err } : {}),
  }
}

/**
 * Replace the binary at `dst` with the file at `src` atomically.
 *
 * Unix: rename(src, dst). If EXDEV (cross-device), fall back to read+write.
 * Windows: rename(dst, dst+'.old') to free the path (running exes can be
 * renamed but not written/deleted), then writeFileSync(dst, read(src)).
 * On write failure, rename(dst+'.old', dst) rolls back so the user keeps
 * a working binary.
 *
 * @param platform  Override process.platform for testing. In production
 *                  callers omit this.
 */
export async function atomicReplaceBinary(
  src: string,
  dst: string,
  platform: NodeJS.Platform = process.platform,
  ops: ReplaceOps = realOps,
): Promise<ReplaceResult> {
  const target = resolveTargetPath(dst)

  if (platform === 'win32') {
    const oldPath = target + '.old'
    // Clear any stale .old left by a prior aborted run before we claim the name.
    try { if (ops.exists(oldPath)) ops.unlink(oldPath) } catch { /* best-effort */ }

    // Step 1: rename target → .old. Windows allows rename on a running
    // exe even though it blocks write/delete. If this fails, another
    // soulkiller process is likely holding the lock.
    try {
      ops.rename(target, oldPath)
    } catch (err) {
      return { ok: false, reason: mapError(err, 'LOCKED') }
    }

    // Step 2: write the new binary to the now-empty target path.
    try {
      const data = ops.readFile(src)
      ops.writeFile(target, data)
      // Best-effort cleanup; the startup hook in index.tsx will retry if this fails.
      try { ops.unlink(oldPath) } catch { /* ignore */ }
      return { ok: true }
    } catch (err) {
      // Rollback: move .old back into place so the user keeps a working binary.
      try { ops.rename(oldPath, target) } catch { /* rollback itself failed */ }
      return { ok: false, reason: mapError(err) }
    }
  }

  // Unix path: rename is atomic on the same filesystem, falls back to
  // read+write on EXDEV (cross-device link error).
  try {
    ops.chmod(src, 0o755)
    ops.rename(src, target)
    return { ok: true }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EXDEV') {
      try {
        const data = ops.readFile(src)
        ops.writeFile(target, data)
        ops.chmod(target, 0o755)
        try { ops.unlink(src) } catch { /* best-effort cleanup */ }
        return { ok: true }
      } catch (err2) {
        return { ok: false, reason: mapError(err2) }
      }
    }
    return { ok: false, reason: mapError(err) }
  }
}

/**
 * Print a user-facing message for a ReplaceFailure. One helper instead of
 * scattering console.error calls through runUpdate.
 */
export function reportReplaceFailure(reason: ReplaceFailure): void {
  switch (reason.code) {
    case 'LOCKED':
      console.error('  ✗ another soulkiller process may be holding the executable lock.')
      console.error('    Close any open REPL sessions and retry `soulkiller --update`.')
      break
    case 'PERMISSION':
      console.error('  ✗ permission denied when writing the new binary.')
      console.error(`    Ensure you have write access to: ${process.execPath}`)
      break
    case 'DISK_FULL':
      console.error('  ✗ disk full — free some space and retry `soulkiller --update`.')
      break
    case 'UNKNOWN':
      console.error(`  ✗ update failed: ${reason.message}`)
      break
  }
}

// ── Main ────────────────────────────────────────────────────────

export async function runUpdate(): Promise<void> {
  const currentVersion = process.env.SOULKILLER_VERSION ?? 'dev'
  const platform = detectPlatform()

  console.log(`  soulkiller ${currentVersion}`)
  console.log(`  Platform: ${platform}`)
  console.log()

  if (currentVersion === 'dev') {
    console.log('  Running in dev mode — update is only available for compiled binaries.')
    console.log('  Use git pull to update the source.')
    return
  }

  console.log('  Checking for updates...')

  let release: GitHubRelease
  try {
    release = await fetchLatestRelease()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed to check for updates: ${msg}`)
    process.exitCode = 1
    return
  }

  const latestVersion = parseVersion(release.tag_name)
  const isWindows = platform.startsWith('windows')
  const binaryName = `soulkiller-${platform}${isWindows ? '.exe' : ''}`

  // Hash-based comparison
  const checksums = await fetchChecksums()
  let needsUpdate = false

  if (latestVersion !== currentVersion) {
    needsUpdate = true
    console.log(`  New version available: ${currentVersion} → ${latestVersion}`)
  } else if (checksums) {
    const remoteHash = checksums[binaryName]
    if (remoteHash) {
      const localHash = await hashFile(process.execPath)
      if (localHash !== remoteHash) {
        needsUpdate = true
        console.log(`  Same version (${currentVersion}) but binary updated on remote.`)
        console.log(`    Local:  ${localHash.slice(0, 16)}...`)
        console.log(`    Remote: ${remoteHash.slice(0, 16)}...`)
      } else {
        console.log(`  Already up to date (${currentVersion}).`)
        return
      }
    } else {
      console.log(`  Already up to date (${currentVersion}).`)
      return
    }
  } else {
    // No checksums available — fallback to version-only check
    console.log(`  Already up to date (${currentVersion}).`)
    return
  }

  if (!needsUpdate) return

  // Find asset for current platform
  const ext = isWindows ? '.zip' : '.tar.gz'
  const assetName = `soulkiller-${platform}${ext}`
  const asset = release.assets.find(a => a.name === assetName)

  if (!asset) {
    console.error(`  No binary found for ${platform} in release ${release.tag_name}`)
    console.error(`  Available: ${release.assets.map(a => a.name).join(', ')}`)
    process.exitCode = 1
    return
  }

  console.log(`  Downloading ${assetName}...`)

  let archiveData: ArrayBuffer
  try {
    const res = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'soulkiller-updater' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    archiveData = await res.arrayBuffer()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Download failed: ${msg}`)
    process.exitCode = 1
    return
  }

  // Integrity check: verify the archive bytes against the remote checksum
  // *before* extracting or replacing anything. If the remote server is
  // missing a checksum for this asset we warn but continue (preserves the
  // pre-existing "no checksums → version-only check" fallback behavior).
  if (checksums) {
    const archiveHash = checksums[assetName]
    if (archiveHash) {
      const localArchiveHash = hashBuffer(archiveData)
      if (localArchiveHash !== archiveHash) {
        console.error(`  ✗ checksum mismatch for ${assetName} — aborting update.`)
        console.error(`    Local:  ${localArchiveHash.slice(0, 16)}...`)
        console.error(`    Remote: ${archiveHash.slice(0, 16)}...`)
        process.exitCode = 1
        return
      }
    } else {
      console.warn(`  ⚠ no remote checksum for ${assetName}; skipping integrity check.`)
    }
  }

  // Extract archive to temp directory
  const extractDir = join(tmpdir(), `soulkiller-update-${Date.now()}`)
  const { execSync } = await import('node:child_process')

  try {
    if (isWindows) {
      const zipPath = extractDir + '.zip'
      writeFileSync(zipPath, Buffer.from(archiveData))
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, { stdio: 'pipe' })
      unlinkSync(zipPath)
    } else {
      const tarPath = extractDir + '.tar.gz'
      writeFileSync(tarPath, Buffer.from(archiveData))
      const { mkdirSync } = await import('node:fs')
      mkdirSync(extractDir, { recursive: true })
      execSync(`tar -xzf "${tarPath}" -C "${extractDir}"`, { stdio: 'pipe' })
      unlinkSync(tarPath)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Extraction failed: ${msg}`)
    process.exitCode = 1
    return
  }

  // Locate the extracted binary
  let extractedBinary = isWindows
    ? join(extractDir, 'soulkiller-windows-x64.exe')
    : join(extractDir, 'soulkiller')

  if (!existsSync(extractedBinary)) {
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(extractDir)
    const bin = isWindows ? files.find(f => f.endsWith('.exe')) : files.find(f => f === 'soulkiller')
    if (!bin) {
      console.error('  No binary found in archive')
      rmSync(extractDir, { recursive: true, force: true })
      process.exitCode = 1
      return
    }
    extractedBinary = join(extractDir, bin)
  }

  // One-call replace — all platform logic lives in atomicReplaceBinary.
  const replaceResult = await atomicReplaceBinary(extractedBinary, process.execPath)
  if (!replaceResult.ok) {
    reportReplaceFailure(replaceResult.reason)
    rmSync(extractDir, { recursive: true, force: true })
    process.exitCode = 1
    return
  }

  // Replace viewer static files (if present in archive)
  const extractedViewer = join(extractDir, 'viewer')
  if (existsSync(extractedViewer)) {
    const viewerDst = join(homedir(), '.soulkiller', 'viewer')
    rmSync(viewerDst, { recursive: true, force: true })
    renameSync(extractedViewer, viewerDst)
    console.log('  ✓ Viewer files updated')
  }

  // Cleanup
  rmSync(extractDir, { recursive: true, force: true })

  console.log(`  ✓ Updated to ${latestVersion} — please run \`soulkiller\` again to start the new version.`)
}
