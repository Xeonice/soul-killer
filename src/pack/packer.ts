import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { createMeta } from './meta.js'
import { computeChecksum } from './checksum.js'
import { readManifest, getBoundWorlds } from '../soul/package.js'
import { loadWorld, getWorldDir } from '../world/manifest.js'

export interface PackOptions {
  output?: string
  withSnapshots?: boolean
}

interface PackResult {
  outputPath: string
  size: number
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
    const excludeDirs = [...SOUL_EXCLUDE_DIRS]
    if (!options.withSnapshots) {
      excludeDirs.push('snapshots')
    }
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
