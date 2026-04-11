#!/usr/bin/env bun
/**
 * Soulkiller release build script.
 *
 * Phase 1: Bundle src/index.tsx into a single JS file (stub react-devtools-core).
 * Phase 2: Cross-compile the bundle to native binaries for 5 platforms.
 * Phase 3: Compress binaries (.tar.gz for Unix, .zip for Windows).
 */

import { readFileSync, mkdirSync, rmSync, existsSync, renameSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'

const DIST = join(import.meta.dir, '..', 'dist')
const ROOT = join(import.meta.dir, '..')

const TARGETS = [
  { platform: 'darwin-arm64', bunTarget: 'bun-darwin-arm64' },
  { platform: 'darwin-x64', bunTarget: 'bun-darwin-x64' },
  { platform: 'linux-x64', bunTarget: 'bun-linux-x64' },
  { platform: 'linux-arm64', bunTarget: 'bun-linux-arm64' },
  { platform: 'windows-x64', bunTarget: 'bun-windows-x64' },
] as const

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const version: string = pkg.version

console.log(`\n  Building soulkiller v${version}\n`)

// Clean dist/
if (existsSync(DIST)) rmSync(DIST, { recursive: true })
mkdirSync(DIST, { recursive: true })

// ── Phase 1: Bundle ─────────────────────────────────────────────
console.log('  Phase 1: Bundling...')

const bundlePath = join(DIST, 'bundle.js')

const bundleResult = await Bun.build({
  entrypoints: [join(ROOT, 'src/index.tsx')],
  outdir: DIST,
  target: 'bun',
  minify: true,
  define: {
    'process.env.SOULKILLER_VERSION': JSON.stringify(version),
  },
  plugins: [
    {
      name: 'stub-react-devtools',
      setup(build) {
        build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
          path: 'react-devtools-core',
          namespace: 'devtools-stub',
        }))
        build.onLoad({ filter: /.*/, namespace: 'devtools-stub' }, () => ({
          contents: 'export default undefined;',
          loader: 'js',
        }))
      },
    },
  ],
})

if (!bundleResult.success) {
  console.error('  Bundle failed:')
  for (const log of bundleResult.logs) console.error(' ', log)
  process.exit(1)
}

// Rename output to bundle.js (Bun names it index.js by default)
const bundleOutput = bundleResult.outputs[0]!.path
if (basename(bundleOutput) !== 'bundle.js') {
  renameSync(bundleOutput, bundlePath)
}

const bundleSize = (Bun.file(bundlePath).size / 1e6).toFixed(1)
console.log(`  ✓ Bundle: ${bundleSize} MB\n`)

// ── Phase 2: Cross-compile ──────────────────────────────────────
console.log('  Phase 2: Cross-compiling...')

for (const { platform, bunTarget } of TARGETS) {
  const isWindows = platform.startsWith('windows')
  const outName = `soulkiller-${platform}${isWindows ? '.exe' : ''}`
  const outPath = join(DIST, outName)

  process.stdout.write(`    ${platform}... `)

  const result = execSync(
    `bun build "${bundlePath}" --compile --target=${bunTarget} --outfile="${outPath}"`,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  const size = (Bun.file(outPath).size / 1e6).toFixed(0)
  console.log(`${size} MB`)
}

console.log('  ✓ All platforms compiled\n')

// ── Phase 3: Compress ───────────────────────────────────────────
console.log('  Phase 3: Compressing...')

for (const { platform } of TARGETS) {
  const isWindows = platform.startsWith('windows')
  const binaryName = `soulkiller-${platform}${isWindows ? '.exe' : ''}`
  const archiveName = `soulkiller-${platform}${isWindows ? '.zip' : '.tar.gz'}`

  process.stdout.write(`    ${archiveName}... `)

  if (isWindows) {
    // zip for Windows
    execSync(`zip -j "${join(DIST, archiveName)}" "${join(DIST, binaryName)}"`, {
      cwd: DIST,
      stdio: 'pipe',
    })
  } else {
    // tar.gz for Unix — hardlink to 'soulkiller' then tar (works on both macOS and GNU tar)
    const tmpLink = join(DIST, 'soulkiller')
    execSync(`ln -f "${join(DIST, binaryName)}" "${tmpLink}"`, { stdio: 'pipe' })
    execSync(`tar -czf "${archiveName}" -C "${DIST}" soulkiller`, { cwd: DIST, stdio: 'pipe' })
    rmSync(tmpLink)
  }

  const archiveSize = (Bun.file(join(DIST, archiveName)).size / 1e6).toFixed(0)
  console.log(`${archiveSize} MB`)
}

// Clean up raw binaries (keep only archives + bundle)
for (const { platform } of TARGETS) {
  const isWindows = platform.startsWith('windows')
  const binaryName = `soulkiller-${platform}${isWindows ? '.exe' : ''}`
  rmSync(join(DIST, binaryName), { force: true })
}
rmSync(bundlePath, { force: true })

console.log('  ✓ All archives ready\n')

// Summary
console.log('  dist/')
const files = new Bun.Glob('*').scanSync({ cwd: DIST })
for (const f of files) {
  const size = (Bun.file(join(DIST, f)).size / 1e6).toFixed(1)
  console.log(`    ${f}  (${size} MB)`)
}
console.log()
