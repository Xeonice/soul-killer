/**
 * Soulkiller download worker.
 *
 * Routes:
 *   GET /download/:platform        → latest release binary for platform
 *   GET /download/:version/:asset  → specific version asset
 *   GET /install.sh                → Unix install script
 *   GET /install.ps1               → Windows install script
 *   GET /latest                    → JSON with latest version info
 *
 * Resolution order for binaries:
 *   1. R2 bucket (primary)
 *   2. GitHub Releases (fallback, result cached to R2)
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

async function getLatestVersion(): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: { 'User-Agent': 'soulkiller-dl-worker' } },
  )
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = (await res.json()) as { tag_name: string }
  return data.tag_name
}

async function serveAsset(
  env: Env,
  version: string,
  asset: string,
): Promise<Response> {
  const r2Key = `${version}/${asset}`

  // 1. Try R2
  const r2Obj = await env.RELEASES.get(r2Key)
  if (r2Obj) {
    return new Response(r2Obj.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename=${asset}`,
        'Content-Length': String(r2Obj.size),
        'Cache-Control': 'public, max-age=86400',
        'X-Source': 'r2',
      },
    })
  }

  // 2. Fallback to GitHub Release
  const ghUrl = `https://github.com/${GITHUB_REPO}/releases/download/${version}/${asset}`
  const ghRes = await fetch(ghUrl, {
    headers: { 'User-Agent': 'soulkiller-dl-worker' },
    redirect: 'follow',
  })
  if (!ghRes.ok) {
    return new Response(`Asset not found: ${version}/${asset}`, { status: 404 })
  }

  // Read full body, cache to R2, then return
  const body = await ghRes.arrayBuffer()
  try {
    await env.RELEASES.put(r2Key, body)
  } catch {
    // ignore cache failure
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=${asset}`,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=86400',
      'X-Source': 'github-fallback',
    },
  })
}

async function serveInstallScript(
  env: Env,
  filename: string,
): Promise<Response> {
  // Try R2 first
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

  // Fallback to GitHub raw
  const ghUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/${filename}`
  const ghRes = await fetch(ghUrl, {
    headers: { 'User-Agent': 'soulkiller-dl-worker' },
  })
  if (!ghRes.ok) {
    return new Response('Script not found', { status: 404 })
  }

  const text = await ghRes.text()

  // Cache to R2
  try {
    await env.RELEASES.put(`scripts/${filename}`, text)
  } catch { /* ignore */ }

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

    // GET /latest — version info
    if (path === '/latest') {
      try {
        const version = await getLatestVersion()
        return Response.json(
          { version, platforms: Object.keys(PLATFORM_MAP) },
          { headers: { 'Cache-Control': 'public, max-age=300' } },
        )
      } catch (err) {
        return Response.json({ error: 'Failed to fetch latest version' }, { status: 502 })
      }
    }

    // GET /install.sh or /install.ps1
    if (path === '/install.sh') {
      return serveInstallScript(env, 'install.sh')
    }
    if (path === '/install.ps1') {
      return serveInstallScript(env, 'install.ps1')
    }

    // GET /download/:platform — latest binary for platform shorthand
    const platformMatch = path.match(/^\/download\/([\w-]+)$/)
    if (platformMatch) {
      const platform = platformMatch[1]!
      const asset = PLATFORM_MAP[platform]
      if (!asset) {
        return Response.json(
          { error: `Unknown platform: ${platform}`, available: Object.keys(PLATFORM_MAP) },
          { status: 400 },
        )
      }
      try {
        const version = await getLatestVersion()
        return serveAsset(env, version, asset)
      } catch {
        return Response.json({ error: 'Failed to resolve latest version' }, { status: 502 })
      }
    }

    // GET /download/:version/:asset — specific version
    const versionMatch = path.match(/^\/download\/(v[\d.]+)\/([\w.-]+)$/)
    if (versionMatch) {
      const [, version, asset] = versionMatch
      return serveAsset(env, version!, asset!)
    }

    // Root — simple help
    if (path === '/' || path === '') {
      return Response.json({
        name: 'soulkiller-download',
        routes: {
          '/latest': 'Latest version info (JSON)',
          '/download/:platform': 'Download latest binary (darwin-arm64, linux-x64, windows-x64, ...)',
          '/download/:version/:asset': 'Download specific version asset',
          '/install.sh': 'Unix install script',
          '/install.ps1': 'Windows install script',
        },
        platforms: Object.keys(PLATFORM_MAP),
      })
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
