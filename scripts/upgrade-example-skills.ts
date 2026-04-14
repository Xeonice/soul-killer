#!/usr/bin/env bun
/**
 * One-off upgrader for `examples/skills/*.skill`.
 *
 * For each archive:
 *   1. Unzip to a temp dir (preserving the inner wrapper directory)
 *   2. Rewrite `<wrapper>/runtime/engine.md` + `<wrapper>/soulkiller.json`
 *      by calling upgradeEngine()
 *   3. Repackage into a zip with the same inner wrapper name
 *
 * No soul/world source data is needed — we only bump the engine template,
 * which is story-independent.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Zip, AsyncZipDeflate, unzipSync, strToU8 } from 'fflate'
import { upgradeEngine } from '../src/cli/skill-manager.js'

const SKILLS_DIR = resolve(import.meta.dir, '..', 'examples', 'skills')

async function repackDir(dir: string, outFile: string): Promise<void> {
  const chunks: Uint8Array[] = []
  await new Promise<void>((res, rej) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) return rej(err)
      if (chunk) chunks.push(chunk)
      if (final) res()
    })

    const walk = (absDir: string, relDir: string): void => {
      for (const entry of readdirSync(absDir)) {
        const absPath = join(absDir, entry)
        const relPath = relDir === '' ? entry : `${relDir}/${entry}`
        const st = statSync(absPath)
        if (st.isDirectory()) {
          walk(absPath, relPath)
        } else {
          const file = new AsyncZipDeflate(relPath, { level: 6 })
          zip.add(file)
          file.push(readFileSync(absPath), true)
        }
      }
    }

    walk(dir, '')
    zip.end()
  })

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.length
  }
  writeFileSync(outFile, buf)
}

function unzipToDir(archive: string, destDir: string): string {
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })

  const data = readFileSync(archive)
  const entries = unzipSync(new Uint8Array(data))
  let wrapperName: string | null = null

  for (const [entryPath, entryData] of Object.entries(entries)) {
    // Detect top-level wrapper name (first segment)
    const topSeg = entryPath.split('/')[0] ?? ''
    if (wrapperName === null) wrapperName = topSeg
    else if (topSeg !== wrapperName) {
      throw new Error(
        `archive has multiple top-level dirs: ${wrapperName} vs ${topSeg}`
      )
    }

    const outPath = join(destDir, entryPath)
    const parent = outPath.slice(0, outPath.lastIndexOf('/'))
    if (parent && !existsSync(parent)) mkdirSync(parent, { recursive: true })
    // Directories in zip often end with '/' with empty data
    if (!entryPath.endsWith('/')) writeFileSync(outPath, entryData)
  }

  if (wrapperName === null) throw new Error('empty archive')
  return wrapperName
}

async function upgradeOne(archivePath: string): Promise<void> {
  const name = archivePath.split('/').pop() ?? ''
  console.log(`\n⟳ ${name}`)

  const tmpBase = join(tmpdir(), `soulkiller-upgrade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  try {
    const wrapperName = unzipToDir(archivePath, tmpBase)
    const wrapperDir = join(tmpBase, wrapperName)
    console.log(`  wrapper: ${wrapperName}`)

    // Read existing soulkiller.json for engine_version reporting
    const metaPath = join(wrapperDir, 'soulkiller.json')
    let oldVersion: number | null = null
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        oldVersion = meta.engine_version ?? null
      } catch { /* ignore */ }
    }

    // Actual upgrade: rewrites runtime/engine.md + soulkiller.json
    upgradeEngine(wrapperDir)

    const newMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
    console.log(`  engine_version: ${oldVersion ?? '(legacy)'} → ${newMeta.engine_version}`)

    // Repack
    await repackDir(tmpBase, archivePath)
    console.log(`  ✓ repacked → ${archivePath}`)
  } finally {
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  if (!existsSync(SKILLS_DIR)) {
    console.error(`examples/skills/ not found at ${SKILLS_DIR}`)
    process.exit(1)
  }

  const skills = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill'))
  if (skills.length === 0) {
    console.log('No .skill files in examples/skills/')
    return
  }

  console.log(`Found ${skills.length} skill archive(s) to upgrade`)
  for (const name of skills) {
    await upgradeOne(join(SKILLS_DIR, name))
  }
  console.log('\nAll done.')
}

await main()
