/**
 * Self-update: query GitHub Releases, download newer binary, atomically replace.
 */

import { writeFileSync, renameSync, chmodSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = 'Xeonice/soul-killer'

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

export async function runUpdate(): Promise<void> {
  const currentVersion = process.env.SOULKILLER_VERSION ?? 'dev'
  const platform = detectPlatform()

  console.log(`  soulkiller ${currentVersion}`)
  console.log(`  Platform: ${platform}`)
  console.log()

  // Dev mode check
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

  if (latestVersion === currentVersion) {
    console.log(`  Already up to date (${currentVersion}).`)
    return
  }

  console.log(`  New version available: ${currentVersion} → ${latestVersion}`)

  // Find asset for current platform
  const isWindows = platform.startsWith('windows')
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

  // Extract binary from archive
  const tmpPath = join(tmpdir(), `soulkiller-update-${Date.now()}`)

  try {
    if (isWindows) {
      // For Windows: write zip, extract with bun/node
      const zipPath = tmpPath + '.zip'
      writeFileSync(zipPath, Buffer.from(archiveData))
      const { execSync } = await import('node:child_process')
      const extractDir = tmpPath + '-extract'
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, { stdio: 'pipe' })
      // Move extracted exe
      const { readdirSync } = await import('node:fs')
      const files = readdirSync(extractDir)
      const exe = files.find(f => f.endsWith('.exe'))
      if (!exe) throw new Error('No .exe found in archive')
      renameSync(join(extractDir, exe), tmpPath)
    } else {
      // For Unix: write tar.gz, extract with tar
      const tarPath = tmpPath + '.tar.gz'
      writeFileSync(tarPath, Buffer.from(archiveData))
      const { execSync } = await import('node:child_process')
      execSync(`tar -xzf "${tarPath}" -C "${tmpdir()}"`, { stdio: 'pipe' })
      const extractedPath = join(tmpdir(), 'soulkiller')
      renameSync(extractedPath, tmpPath)
      unlinkSync(tarPath)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Extraction failed: ${msg}`)
    process.exitCode = 1
    return
  }

  // Atomic replace
  const execPath = process.execPath
  try {
    chmodSync(tmpPath, 0o755)
    renameSync(tmpPath, execPath)
  } catch {
    // rename across filesystems fails — fall back to copy
    try {
      const data = Bun.file(tmpPath).arrayBuffer()
      writeFileSync(execPath, Buffer.from(await data))
      chmodSync(execPath, 0o755)
      unlinkSync(tmpPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed to replace binary: ${msg}`)
      console.error(`  New binary is at: ${tmpPath}`)
      console.error(`  You can manually copy it to: ${execPath}`)
      process.exitCode = 1
      return
    }
  }

  console.log(`  ✓ Updated to ${latestVersion}`)
}
