/**
 * Soulkiller download worker.
 *
 * Routes:
 *   GET /download/:platform        → latest release binary (R2 releases/latest/)
 *   GET /download/:version/:asset  → specific version asset (R2 releases/<ver>/, fallback GitHub)
 *   GET /install.sh                → Unix install script
 *   GET /install.ps1               → Windows install script
 *   GET /latest                    → JSON with latest version info
 *   GET /examples/:file            → example pack/skill files (R2 examples/)
 *   GET /examples/skills/:file     → example skill files (R2 examples/skills/)
 *
 * R2 layout (managed by CI):
 *   releases/latest/<asset>         — always the newest version
 *   releases/latest/version.txt     — plain text version tag (e.g. "v0.2.1")
 *   releases/v0.2.1/<asset>         — versioned archive
 *   scripts/install.sh|install.ps1  — install scripts
 *   examples/<file>                 — example pack files (all-souls.soul.pack, all-worlds.world.pack)
 *   examples/skills/<file>          — example skill files
 */

interface Env {
  RELEASES: R2Bucket
}

const GITHUB_REPO = 'Xeonice/soul-killer'

const PLATFORM_MAP: Record<string, string> = {
  'darwin-arm64': 'soulkiller-darwin-arm64.tar.gz',
  'darwin-x64': 'soulkiller-darwin-x64.tar.gz',
  'linux-x64': 'soulkiller-linux-x64.tar.gz',
  'linux-arm64': 'soulkiller-linux-arm64.tar.gz',
  'windows-x64': 'soulkiller-windows-x64.zip',
}

function assetResponse(body: ReadableStream | ArrayBuffer, asset: string, size: number, source: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=${asset}`,
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=86400',
      'X-Source': source,
    },
  })
}

/**
 * Serve latest binary for a platform. Reads directly from R2 releases/latest/.
 * No GitHub API call needed.
 */
async function serveLatestPlatform(env: Env, platform: string): Promise<Response> {
  const asset = PLATFORM_MAP[platform]
  if (!asset) {
    return Response.json(
      { error: `Unknown platform: ${platform}`, available: Object.keys(PLATFORM_MAP) },
      { status: 400 },
    )
  }

  const r2Obj = await env.RELEASES.get(`releases/latest/${asset}`)
  if (r2Obj) {
    return assetResponse(r2Obj.body, asset, r2Obj.size, 'r2')
  }

  // Fallback: resolve version from GitHub, fetch, cache
  try {
    const version = await getLatestVersionFromGitHub()
    return serveVersionedAsset(env, version, asset)
  } catch {
    return Response.json({ error: 'Binary not available. Release may still be in progress.' }, { status: 404 })
  }
}

/**
 * Serve a specific versioned asset. R2 first, GitHub fallback with cache-through.
 */
async function serveVersionedAsset(env: Env, version: string, asset: string): Promise<Response> {
  const r2Key = `releases/${version}/${asset}`

  const r2Obj = await env.RELEASES.get(r2Key)
  if (r2Obj) {
    return assetResponse(r2Obj.body, asset, r2Obj.size, 'r2')
  }

  // Fallback to GitHub Release
  const ghUrl = `https://github.com/${GITHUB_REPO}/releases/download/${version}/${asset}`
  const ghRes = await fetch(ghUrl, {
    headers: { 'User-Agent': 'soulkiller-dl-worker' },
    redirect: 'follow',
  })
  if (!ghRes.ok) {
    return new Response(`Asset not found: ${version}/${asset}`, { status: 404 })
  }

  const body = await ghRes.arrayBuffer()
  try {
    await env.RELEASES.put(r2Key, body)
  } catch { /* ignore cache failure */ }

  return assetResponse(body, asset, body.byteLength, 'github-fallback')
}

/**
 * Get latest version. R2 version.txt first, GitHub API fallback.
 */
async function getLatestVersion(env: Env): Promise<string> {
  const r2Obj = await env.RELEASES.get('releases/latest/version.txt')
  if (r2Obj) {
    return (await r2Obj.text()).trim()
  }
  return getLatestVersionFromGitHub()
}

async function getLatestVersionFromGitHub(): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: { 'User-Agent': 'soulkiller-dl-worker' } },
  )
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = (await res.json()) as { tag_name: string }
  return data.tag_name
}

async function serveExample(env: Env, r2Path: string, filename: string): Promise<Response> {
  const r2Obj = await env.RELEASES.get(r2Path)
  if (!r2Obj) {
    return new Response(`Example not found: ${filename}`, { status: 404 })
  }
  return new Response(r2Obj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': String(r2Obj.size),
      'Cache-Control': 'public, max-age=86400',
      'X-Source': 'r2',
    },
  })
}

async function serveInstallScript(env: Env, filename: string): Promise<Response> {
  const r2Obj = await env.RELEASES.get(`scripts/${filename}`)
  if (r2Obj) {
    return new Response(r2Obj.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Source': 'r2',
      },
    })
  }

  const ghUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/${filename}`
  const ghRes = await fetch(ghUrl, { headers: { 'User-Agent': 'soulkiller-dl-worker' } })
  if (!ghRes.ok) return new Response('Script not found', { status: 404 })

  const text = await ghRes.text()
  try { await env.RELEASES.put(`scripts/${filename}`, text) } catch { /* ignore */ }

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Source': 'github-fallback',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // GET /latest
    if (path === '/latest') {
      try {
        const version = await getLatestVersion(env)
        return Response.json(
          { version, platforms: Object.keys(PLATFORM_MAP) },
          { headers: { 'Cache-Control': 'public, max-age=300' } },
        )
      } catch {
        return Response.json({ error: 'Failed to fetch latest version' }, { status: 502 })
      }
    }

    // GET /install.sh or /install.ps1
    if (path === '/install.sh') return serveInstallScript(env, 'install.sh')
    if (path === '/install.ps1') return serveInstallScript(env, 'install.ps1')

    // GET /download/:platform — latest binary
    const platformMatch = path.match(/^\/download\/([\w-]+)$/)
    if (platformMatch) {
      return serveLatestPlatform(env, platformMatch[1]!)
    }

    // GET /download/:version/:asset — specific version
    const versionMatch = path.match(/^\/download\/(v[\d.]+)\/([\w.-]+)$/)
    if (versionMatch) {
      return serveVersionedAsset(env, versionMatch[1]!, versionMatch[2]!)
    }

    // GET /examples/skills/:file — example skill files
    const exampleSkillMatch = path.match(/^\/examples\/skills\/([\w.-]+)$/)
    if (exampleSkillMatch) {
      return serveExample(env, `examples/skills/${exampleSkillMatch[1]}`, exampleSkillMatch[1]!)
    }

    // GET /examples/:file — example pack files
    const exampleMatch = path.match(/^\/examples\/([\w.-]+)$/)
    if (exampleMatch) {
      return serveExample(env, `examples/${exampleMatch[1]}`, exampleMatch[1]!)
    }

    // Root
    if (path === '/' || path === '') {
      return Response.json({
        name: 'soulkiller-download',
        routes: {
          '/latest': 'Latest version info (JSON)',
          '/download/:platform': 'Download latest binary (darwin-arm64, linux-x64, windows-x64, ...)',
          '/download/:version/:asset': 'Download specific version asset',
          '/install.sh': 'Unix install script',
          '/install.ps1': 'Windows install script',
          '/examples/:file': 'Example pack files (all-souls.soul.pack, all-worlds.world.pack)',
          '/examples/skills/:file': 'Example skill files (fate-zero.skill, three-kingdoms.skill, ...)',
        },
        platforms: Object.keys(PLATFORM_MAP),
      })
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
