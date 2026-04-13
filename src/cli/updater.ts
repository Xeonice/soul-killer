/**
 * Self-update: query GitHub Releases, compare binary hash, download if changed.
 */

import { readFileSync, writeFileSync, renameSync, chmodSync, unlinkSync, existsSync, rmSync } from 'node:fs'
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

  // Replace binary
  const execPath = process.execPath
  const extractedBinary = isWindows
    ? join(extractDir, 'soulkiller-windows-x64.exe')
    : join(extractDir, 'soulkiller')

  if (!existsSync(extractedBinary)) {
    // Fallback: find any exe or binary
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(extractDir)
    const bin = isWindows ? files.find(f => f.endsWith('.exe')) : files.find(f => f === 'soulkiller')
    if (!bin) {
      console.error('  No binary found in archive')
      rmSync(extractDir, { recursive: true, force: true })
      process.exitCode = 1
      return
    }
  }

  try {
    chmodSync(extractedBinary, 0o755)
    renameSync(extractedBinary, execPath)
  } catch {
    try {
      const data = Bun.file(extractedBinary).arrayBuffer()
      writeFileSync(execPath, Buffer.from(await data))
      chmodSync(execPath, 0o755)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed to replace binary: ${msg}`)
      rmSync(extractDir, { recursive: true, force: true })
      process.exitCode = 1
      return
    }
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

  console.log(`  ✓ Updated to ${latestVersion}`)
}
