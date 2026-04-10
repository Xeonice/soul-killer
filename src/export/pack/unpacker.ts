import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { parseMeta, validateVersion, type PackMeta } from './meta.js'
import { verifyChecksum } from './checksum.js'
import { worldExists } from '../../world/manifest.js'

export interface ConflictItem {
  type: 'soul' | 'world'
  name: string
  /** The source directory inside the extracted staging area */
  sourcePath: string
}

export type ConflictResolution = 'overwrite' | 'skip' | { rename: string }

export interface UnpackResult {
  meta: PackMeta
  installed: { type: string; name: string }[]
  skipped: { type: string; name: string }[]
  renamed: { type: string; from: string; to: string }[]
}

/**
 * Extract a pack file and return its metadata + conflicts to resolve.
 * The caller must handle conflicts and then call applyUnpack().
 */
export async function inspectPack(filePath: string): Promise<{
  meta: PackMeta
  stagingDir: string
  conflicts: ConflictItem[]
}> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-unpack-'))

  // Extract tar.gz
  await new Promise<void>((resolve, reject) => {
    execFile('tar', ['-xzf', filePath, '-C', stagingDir], (error, _stdout, stderr) => {
      if (error) {
        fs.rmSync(stagingDir, { recursive: true, force: true })
        reject(new Error(`tar extraction failed: ${stderr || error.message}`))
      } else {
        resolve()
      }
    })
  })

  // Read and validate pack-meta.json
  const metaPath = path.join(stagingDir, 'pack-meta.json')
  if (!fs.existsSync(metaPath)) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
    throw new Error('Invalid pack file: missing pack-meta.json')
  }

  const meta = parseMeta(fs.readFileSync(metaPath, 'utf-8'))

  // Validate format version
  const versionCheck = validateVersion(meta)
  if (!versionCheck.ok) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
    throw new Error(versionCheck.error!)
  }

  // Verify checksum
  const checksumValid = verifyChecksum(stagingDir, meta.checksum)
  if (!checksumValid) {
    // Don't auto-reject — return meta so caller can warn the user
    meta.checksum = `MISMATCH:${meta.checksum}`
  }

  // Detect conflicts
  const conflicts = detectConflicts(meta, stagingDir)

  return { meta, stagingDir, conflicts }
}

/**
 * Apply the unpack operation with conflict resolutions.
 */
export function applyUnpack(
  meta: PackMeta,
  stagingDir: string,
  resolutions: Map<string, ConflictResolution>,
): UnpackResult {
  const result: UnpackResult = {
    meta,
    installed: [],
    skipped: [],
    renamed: [],
  }

  const soulsBase = path.join(os.homedir(), '.soulkiller', 'souls')
  const worldsBase = path.join(os.homedir(), '.soulkiller', 'worlds')

  // World rename map: original name → new name (for binding updates)
  const worldRenameMap = new Map<string, string>()

  if (meta.type === 'soul') {
    // Unpack bundled worlds first
    const worldsStagingDir = path.join(stagingDir, 'worlds')
    if (fs.existsSync(worldsStagingDir)) {
      const worldDirs = fs.readdirSync(worldsStagingDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())

      for (const wd of worldDirs) {
        const worldName = wd.name
        const key = `world:${worldName}`
        const resolution = resolutions.get(key)
        const sourcePath = path.join(worldsStagingDir, worldName)

        if (resolution === 'skip') {
          result.skipped.push({ type: 'world', name: worldName })
          continue
        }

        let targetName = worldName
        if (resolution && typeof resolution === 'object' && 'rename' in resolution) {
          targetName = resolution.rename
          worldRenameMap.set(worldName, targetName)
          result.renamed.push({ type: 'world', from: worldName, to: targetName })
        }

        const targetDir = path.join(worldsBase, targetName)

        if (resolution === 'overwrite' && fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true })
        }

        fs.mkdirSync(path.dirname(targetDir), { recursive: true })
        fs.cpSync(sourcePath, targetDir, { recursive: true })

        // Update world.json name field if renamed
        if (targetName !== worldName) {
          updateWorldManifestName(targetDir, targetName)
        }

        result.installed.push({ type: 'world', name: targetName })
      }
    }

    // Unpack soul
    const soulStagingDir = path.join(stagingDir, 'soul')
    const soulKey = `soul:${meta.name}`
    const soulResolution = resolutions.get(soulKey)

    if (soulResolution === 'skip') {
      result.skipped.push({ type: 'soul', name: meta.name })
    } else {
      let targetName = meta.name
      if (soulResolution && typeof soulResolution === 'object' && 'rename' in soulResolution) {
        targetName = soulResolution.rename
        result.renamed.push({ type: 'soul', from: meta.name, to: targetName })
      }

      const targetDir = path.join(soulsBase, targetName)

      if (soulResolution === 'overwrite' && fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true })
      }

      fs.mkdirSync(targetDir, { recursive: true })
      fs.cpSync(soulStagingDir, targetDir, { recursive: true })

      // Update manifest name if renamed
      if (targetName !== meta.name) {
        updateSoulManifestName(targetDir, targetName)
      }

      // Update binding references for renamed worlds
      if (worldRenameMap.size > 0) {
        updateBindingReferences(targetDir, worldRenameMap)
      }

      // Ensure vectors/ and examples/ directories exist
      fs.mkdirSync(path.join(targetDir, 'vectors'), { recursive: true })
      fs.mkdirSync(path.join(targetDir, 'examples'), { recursive: true })

      result.installed.push({ type: 'soul', name: targetName })
    }
  } else {
    // World pack
    const worldStagingDir = path.join(stagingDir, 'world')
    const key = `world:${meta.name}`
    const resolution = resolutions.get(key)

    if (resolution === 'skip') {
      result.skipped.push({ type: 'world', name: meta.name })
    } else {
      let targetName = meta.name
      if (resolution && typeof resolution === 'object' && 'rename' in resolution) {
        targetName = resolution.rename
        result.renamed.push({ type: 'world', from: meta.name, to: targetName })
      }

      const targetDir = path.join(worldsBase, targetName)

      if (resolution === 'overwrite' && fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true })
      }

      fs.mkdirSync(path.dirname(targetDir), { recursive: true })
      fs.cpSync(worldStagingDir, targetDir, { recursive: true })

      if (targetName !== meta.name) {
        updateWorldManifestName(targetDir, targetName)
      }

      result.installed.push({ type: 'world', name: targetName })
    }
  }

  // Cleanup staging
  fs.rmSync(stagingDir, { recursive: true, force: true })

  return result
}

/**
 * Generate a non-conflicting name by appending -2, -3, etc.
 */
export function suggestRename(name: string, existsCheck: (n: string) => boolean): string {
  let counter = 2
  let candidate = `${name}-${counter}`
  while (existsCheck(candidate)) {
    counter++
    candidate = `${name}-${counter}`
  }
  return candidate
}

function detectConflicts(meta: PackMeta, stagingDir: string): ConflictItem[] {
  const conflicts: ConflictItem[] = []
  const soulsBase = path.join(os.homedir(), '.soulkiller', 'souls')

  if (meta.type === 'soul') {
    // Check soul conflict
    if (fs.existsSync(path.join(soulsBase, meta.name, 'manifest.json'))) {
      conflicts.push({
        type: 'soul',
        name: meta.name,
        sourcePath: path.join(stagingDir, 'soul'),
      })
    }

    // Check world conflicts
    const worldsStagingDir = path.join(stagingDir, 'worlds')
    if (fs.existsSync(worldsStagingDir)) {
      const worldDirs = fs.readdirSync(worldsStagingDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
      for (const wd of worldDirs) {
        if (worldExists(wd.name)) {
          conflicts.push({
            type: 'world',
            name: wd.name,
            sourcePath: path.join(worldsStagingDir, wd.name),
          })
        }
      }
    }
  } else {
    // World pack conflict
    if (worldExists(meta.name)) {
      conflicts.push({
        type: 'world',
        name: meta.name,
        sourcePath: path.join(stagingDir, 'world'),
      })
    }
  }

  return conflicts
}

function updateWorldManifestName(worldDir: string, newName: string): void {
  const manifestPath = path.join(worldDir, 'world.json')
  if (!fs.existsSync(manifestPath)) return
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  manifest.name = newName
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

function updateSoulManifestName(soulDir: string, newName: string): void {
  const manifestPath = path.join(soulDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  manifest.name = newName
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

function updateBindingReferences(soulDir: string, renameMap: Map<string, string>): void {
  const bindingsDir = path.join(soulDir, 'bindings')
  if (!fs.existsSync(bindingsDir)) return

  for (const [oldName, newName] of renameMap) {
    const oldPath = path.join(bindingsDir, `${oldName}.json`)
    if (!fs.existsSync(oldPath)) continue

    const binding = JSON.parse(fs.readFileSync(oldPath, 'utf-8'))
    binding.world = newName
    const newPath = path.join(bindingsDir, `${newName}.json`)
    fs.writeFileSync(newPath, JSON.stringify(binding, null, 2))
    fs.unlinkSync(oldPath)
  }
}
