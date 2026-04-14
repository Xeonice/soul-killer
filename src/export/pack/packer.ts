import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { createMeta, type BundleItem } from './meta.js'
import { computeChecksum } from './checksum.js'
import { readManifest, getBoundWorlds } from '../../soul/package.js'
import { loadWorld, getWorldDir } from '../../world/manifest.js'

export interface PackOptions {
  output?: string
  withSnapshots?: boolean
}

interface PackResult {
  outputPath: string
  size: number
}

export interface PackAllOptions {
  output?: string
  withSnapshots?: boolean
  onProgress?: (event: PackAllProgress) => void
}

export interface PackAllProgress {
  type: 'souls-bundle' | 'worlds-bundle'
  status: 'packing' | 'done' | 'error'
  count: number
  outputPath?: string
  size?: number
  error?: string
}

export interface PackAllResult {
  souls: { outputPath: string; size: number; count: number } | null
  worlds: { outputPath: string; size: number; count: number } | null
  errors: { type: 'souls-bundle' | 'worlds-bundle'; error: string }[]
}

const SOUL_EXCLUDE_DIRS = ['vectors', 'examples']

/**
 * Pack a soul and all its bound worlds into a .soul.pack file.
 */
export async function packSoul(soulName: string, options: PackOptions = {}): Promise<PackResult> {
  const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', soulName)
  if (!fs.existsSync(soulDir)) {
    throw new Error(`Soul "${soulName}" does not exist`)
  }

  const manifest = readManifest(soulDir)
  if (!manifest) {
    throw new Error(`Soul "${soulName}" has no valid manifest`)
  }

  // Create staging directory
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-pack-'))

  try {
    // Copy soul files (excluding vectors/, examples/, and optionally snapshots/)
    const excludeDirs = options.withSnapshots
      ? [...SOUL_EXCLUDE_DIRS]
      : [...SOUL_EXCLUDE_DIRS, 'snapshots']
    copySoulToStaging(soulDir, path.join(stagingDir, 'soul'), excludeDirs)

    // Collect bound worlds
    const boundWorlds = getBoundWorlds(soulDir)
    const worldNames = boundWorlds.map((bw) => bw.manifest.name)

    if (worldNames.length > 0) {
      const worldsStaging = path.join(stagingDir, 'worlds')
      fs.mkdirSync(worldsStaging, { recursive: true })
      for (const bw of boundWorlds) {
        const worldDir = getWorldDir(bw.manifest.name)
        fs.cpSync(worldDir, path.join(worldsStaging, bw.manifest.name), { recursive: true })
      }
    }

    // Create pack-meta.json (without checksum first)
    const meta = createMeta('soul', soulName, manifest.display_name, worldNames)

    // Compute checksum over all staged files
    meta.checksum = computeChecksum(stagingDir)

    // Write pack-meta.json
    fs.writeFileSync(path.join(stagingDir, 'pack-meta.json'), JSON.stringify(meta, null, 2))

    // Create tar.gz
    const outputDir = options.output ?? process.cwd()
    const outputPath = path.join(outputDir, `${soulName}.soul.pack`)
    await createTarGz(stagingDir, outputPath)

    const stat = fs.statSync(outputPath)
    return { outputPath, size: stat.size }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

/**
 * Pack a world into a .world.pack file.
 */
export async function packWorld(worldName: string, options: PackOptions = {}): Promise<PackResult> {
  const worldDir = getWorldDir(worldName)
  if (!fs.existsSync(worldDir)) {
    throw new Error(`World "${worldName}" does not exist`)
  }

  const worldManifest = loadWorld(worldName)
  if (!worldManifest) {
    throw new Error(`World "${worldName}" has no valid manifest`)
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-pack-'))

  try {
    // Copy world files
    fs.cpSync(worldDir, path.join(stagingDir, 'world'), { recursive: true })

    // Create pack-meta.json
    const meta = createMeta('world', worldName, worldManifest.display_name)
    meta.checksum = computeChecksum(stagingDir)
    fs.writeFileSync(path.join(stagingDir, 'pack-meta.json'), JSON.stringify(meta, null, 2))

    // Create tar.gz
    const outputDir = options.output ?? process.cwd()
    const outputPath = path.join(outputDir, `${worldName}.world.pack`)
    await createTarGz(stagingDir, outputPath)

    const stat = fs.statSync(outputPath)
    return { outputPath, size: stat.size }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

/**
 * Pack ALL souls into a single all-souls.soul.pack bundle,
 * and ALL worlds into a single all-worlds.world.pack bundle.
 */
export async function packAll(options: PackAllOptions = {}): Promise<PackAllResult> {
  const soulsBase = path.join(os.homedir(), '.soulkiller', 'souls')
  const worldsBase = path.join(os.homedir(), '.soulkiller', 'worlds')

  const soulNames = fs.existsSync(soulsBase)
    ? fs.readdirSync(soulsBase, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : []

  const worldNames = fs.existsSync(worldsBase)
    ? fs.readdirSync(worldsBase, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : []

  const result: PackAllResult = { souls: null, worlds: null, errors: [] }

  // ── Pack all souls into one bundle ───────────────────────────────────────────
  options.onProgress?.({ type: 'souls-bundle', status: 'packing', count: soulNames.length })
  try {
    const r = await packSoulsBundle(soulNames, options)
    result.souls = { outputPath: r.outputPath, size: r.size, count: soulNames.length }
    options.onProgress?.({
      type: 'souls-bundle',
      status: 'done',
      count: soulNames.length,
      outputPath: r.outputPath,
      size: r.size,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    result.errors.push({ type: 'souls-bundle', error })
    options.onProgress?.({ type: 'souls-bundle', status: 'error', count: soulNames.length, error })
  }

  // ── Pack all worlds into one bundle ──────────────────────────────────────────
  options.onProgress?.({ type: 'worlds-bundle', status: 'packing', count: worldNames.length })
  try {
    const r = await packWorldsBundle(worldNames, options)
    result.worlds = { outputPath: r.outputPath, size: r.size, count: worldNames.length }
    options.onProgress?.({
      type: 'worlds-bundle',
      status: 'done',
      count: worldNames.length,
      outputPath: r.outputPath,
      size: r.size,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    result.errors.push({ type: 'worlds-bundle', error })
    options.onProgress?.({ type: 'worlds-bundle', status: 'error', count: worldNames.length, error })
  }

  return result
}

// ── Private bundle helpers ────────────────────────────────────────────────────

async function packSoulsBundle(soulNames: string[], options: PackAllOptions): Promise<PackResult> {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-pack-'))

  try {
    const soulsStaging = path.join(stagingDir, 'souls')
    const worldsStaging = path.join(stagingDir, 'worlds')
    fs.mkdirSync(soulsStaging, { recursive: true })

    const bundleItems: BundleItem[] = []
    const packedWorlds = new Set<string>()

    const excludeDirs = options.withSnapshots
      ? [...SOUL_EXCLUDE_DIRS]
      : [...SOUL_EXCLUDE_DIRS, 'snapshots']

    for (const soulName of soulNames) {
      const soulDir = path.join(os.homedir(), '.soulkiller', 'souls', soulName)
      if (!fs.existsSync(soulDir)) continue

      const manifest = readManifest(soulDir)
      if (!manifest) continue

      copySoulToStaging(soulDir, path.join(soulsStaging, soulName), excludeDirs)

      const boundWorlds = getBoundWorlds(soulDir)
      const worldNames = boundWorlds.map((bw) => bw.manifest.name)
      bundleItems.push({
        name: soulName,
        display_name: manifest.display_name ?? soulName,
        worlds: worldNames,
      })

      for (const bw of boundWorlds) {
        if (!packedWorlds.has(bw.manifest.name)) {
          packedWorlds.add(bw.manifest.name)
          fs.mkdirSync(worldsStaging, { recursive: true })
          const worldDir = getWorldDir(bw.manifest.name)
          if (fs.existsSync(worldDir)) {
            fs.cpSync(worldDir, path.join(worldsStaging, bw.manifest.name), { recursive: true })
          }
        }
      }
    }

    const meta = createMeta('souls-bundle', 'all-souls', 'All Souls', [], bundleItems)
    meta.checksum = computeChecksum(stagingDir)
    fs.writeFileSync(path.join(stagingDir, 'pack-meta.json'), JSON.stringify(meta, null, 2))

    const outputDir = options.output ?? process.cwd()
    const outputPath = path.join(outputDir, 'all-souls.soul.pack')
    await createTarGz(stagingDir, outputPath)

    const stat = fs.statSync(outputPath)
    return { outputPath, size: stat.size }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

async function packWorldsBundle(worldNames: string[], options: PackAllOptions): Promise<PackResult> {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soulkiller-pack-'))

  try {
    const worldsStaging = path.join(stagingDir, 'worlds')
    fs.mkdirSync(worldsStaging, { recursive: true })

    const bundleItems: BundleItem[] = []

    for (const worldName of worldNames) {
      const worldDir = getWorldDir(worldName)
      if (!fs.existsSync(worldDir)) continue

      const worldManifest = loadWorld(worldName)
      if (!worldManifest) continue

      fs.cpSync(worldDir, path.join(worldsStaging, worldName), { recursive: true })
      bundleItems.push({ name: worldName, display_name: worldManifest.display_name ?? worldName })
    }

    const meta = createMeta('worlds-bundle', 'all-worlds', 'All Worlds', [], bundleItems)
    meta.checksum = computeChecksum(stagingDir)
    fs.writeFileSync(path.join(stagingDir, 'pack-meta.json'), JSON.stringify(meta, null, 2))

    const outputDir = options.output ?? process.cwd()
    const outputPath = path.join(outputDir, 'all-worlds.world.pack')
    await createTarGz(stagingDir, outputPath)

    const stat = fs.statSync(outputPath)
    return { outputPath, size: stat.size }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

// ── Shared utilities ──────────────────────────────────────────────────────────

function copySoulToStaging(soulDir: string, destDir: string, excludeDirs: string[]): void {
  fs.mkdirSync(destDir, { recursive: true })
  const entries = fs.readdirSync(soulDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue
    const src = path.join(soulDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true })
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

function createTarGz(sourceDir: string, outputPath: string): Promise<void> {
  const outputDir = path.dirname(outputPath)
  fs.mkdirSync(outputDir, { recursive: true })

  return new Promise((resolve, reject) => {
    execFile('tar', ['-czf', outputPath, '-C', sourceDir, '.'], (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`tar failed: ${stderr || error.message}`))
      } else {
        resolve()
      }
    })
  })
}
