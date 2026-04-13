/**
 * Viewer HTTP server — standalone service.
 *
 * Production: runs as a detached process, serves static files from
 *   ~/.soulkiller/viewer/ + API endpoints. Spawned by main.ts viewer command.
 *
 * Development: `bun run dev:viewer tree <script-id>` starts vite dev + API.
 *
 * Environment variables (production mode):
 *   SKILL_ROOT — path to the skill directory
 *   VIEWER_VIEW — view name (e.g., "tree")
 *   VIEWER_SCRIPT_ID — script id
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { loadTreeData, watchSaveDir } from './viewer-data.js'

const DEFAULT_PORT = 6677
const MAX_PORT_TRIES = 10
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000
const VIEWER_DIR = join(homedir(), '.soulkiller', 'viewer')

// ── SSE client management ────────────────────────────────────────
const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>()
let idleTimer: ReturnType<typeof setTimeout> | null = null

function resetIdleTimer(skillRoot: string): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (sseClients.size === 0) cleanupAndExit(skillRoot)
  }, IDLE_TIMEOUT_MS)
}

function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(payload)
  for (const ctrl of sseClients) {
    try { ctrl.enqueue(encoded) } catch { sseClients.delete(ctrl) }
  }
}

// ── Server JSON management ───────────────────────────────────────
function serverJsonPath(skillRoot: string): string {
  return join(skillRoot, 'runtime', 'tree', 'server.json')
}

function writeServerJson(skillRoot: string, port: number, pid: number, scriptId: string): void {
  const path = serverJsonPath(skillRoot)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify({ port, pid, scriptId }, null, 2), 'utf8')
}

function cleanupAndExit(skillRoot: string): void {
  try { unlinkSync(serverJsonPath(skillRoot)) } catch { /* ignore */ }
  process.exit(0)
}

// ── Data loaders per view ────────────────────────────────────────
type DataLoader = (skillRoot: string, scriptId: string) => Record<string, unknown>

const DATA_LOADERS: Record<string, DataLoader> = {
  tree: loadTreeData,
}

export const AVAILABLE_VIEWS = Object.keys(DATA_LOADERS)

// ── MIME type helper ─────────────────────────────────────────────
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function getMime(path: string): string {
  const ext = '.' + path.split('.').pop()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

// ── API request handler ──────────────────────────────────────────
async function handleApiRequest(
  url: URL,
  req: Request,
  skillRoot: string,
  viewName: string,
  scriptId: string,
  boundPort: number,
): Promise<Response | null> {
  const loader = DATA_LOADERS[viewName]
  if (!loader) return null

  if (url.pathname === '/api/data') {
    const data = loader(skillRoot, scriptId)
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }

  if (url.pathname === '/api/events') {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        sseClients.add(controller)
        resetIdleTimer(skillRoot)
      },
      cancel(controller) {
        sseClients.delete(controller)
        if (sseClients.size === 0) resetIdleTimer(skillRoot)
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  }

  if (url.pathname === '/api/switch' && req.method === 'POST') {
    const body = await req.json() as { scriptId: string }
    const data = loader(skillRoot, body.scriptId)
    broadcastSSE('switch', data)
    writeServerJson(skillRoot, boundPort, process.pid, body.scriptId)
    return Response.json({ ok: true })
  }

  return null
}

// ── Production server (runs as detached process) ─────────────────

export function startServer(skillRoot: string, viewName: string, scriptId: string): void {
  if (!existsSync(join(VIEWER_DIR, 'index.html'))) {
    process.stderr.write(`error: ${VIEWER_DIR}/index.html not found.\nRun "soulkiller --update" or reinstall to restore viewer files.\n`)
    process.exit(1)
  }

  let boundPort = DEFAULT_PORT

  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const tryPort = DEFAULT_PORT + i
    try {
      Bun.serve({
        port: tryPort,
        idleTimeout: 0,
        async fetch(req) {
          const url = new URL(req.url)

          // API routes
          const apiResponse = await handleApiRequest(url, req, skillRoot, viewName, scriptId, tryPort)
          if (apiResponse) return apiResponse

          // Static files from ~/.soulkiller/viewer/
          const pathname = url.pathname === '/' ? '/index.html' : url.pathname
          const filePath = join(VIEWER_DIR, pathname)
          const file = Bun.file(filePath)
          if (await file.exists()) {
            return new Response(file, { headers: { 'Content-Type': getMime(pathname) } })
          }

          // SPA fallback
          return new Response(Bun.file(join(VIEWER_DIR, 'index.html')), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        },
      })
      boundPort = tryPort
      break
    } catch {
      if (i === MAX_PORT_TRIES - 1) {
        process.stderr.write(`error: failed to bind any port in range ${DEFAULT_PORT}-${DEFAULT_PORT + MAX_PORT_TRIES - 1}\n`)
        process.exit(1)
      }
    }
  }

  const treeDir = join(skillRoot, 'runtime', 'tree')
  if (!existsSync(treeDir)) mkdirSync(treeDir, { recursive: true })
  writeServerJson(skillRoot, boundPort, process.pid, scriptId)

  watchSaveDir(skillRoot, scriptId, (data) => broadcastSSE('update', data))
  resetIdleTimer(skillRoot)

  // Signal to parent that we're ready
  process.stdout.write(`VIEWER_URL http://localhost:${boundPort}\n`)
}

// ── Dev server ───────────────────────────────────────────────────
async function startDevServer(
  skillRoot: string,
  viewName: string,
  scriptId: string,
): Promise<void> {
  const { createServer } = await import('vite')

  const viewerRoot = resolve(process.cwd(), 'packages', 'viewer')

  let apiPort = DEFAULT_PORT
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const tryPort = DEFAULT_PORT + i
    try {
      Bun.serve({
        port: tryPort,
        idleTimeout: 0,
        async fetch(req) {
          const url = new URL(req.url)
          const apiResponse = await handleApiRequest(url, req, skillRoot, viewName, scriptId, tryPort)
          if (apiResponse) return apiResponse
          return new Response('Not Found', { status: 404 })
        },
      })
      apiPort = tryPort
      break
    } catch {
      if (i === MAX_PORT_TRIES - 1) throw new Error('Failed to bind API port')
    }
  }

  watchSaveDir(skillRoot, scriptId, (data) => broadcastSSE('update', data))

  const server = await createServer({
    root: viewerRoot,
    server: {
      proxy: {
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
  })

  await server.listen()
  const viteUrl = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}`

  process.stdout.write(`VIEWER_URL ${viteUrl}\n`)
  process.stdout.write(`API_PORT ${apiPort}\n`)
  process.stdout.write(`MODE dev\n`)
}

// ── Entry point ──────────────────────────────────────────────────
if (import.meta.main) {
  const args = process.argv.slice(2)
  const mode = process.env.VIEWER_MODE ?? 'dev'
  const viewName = process.env.VIEWER_VIEW ?? args[0]
  const scriptId = process.env.VIEWER_SCRIPT_ID ?? args[1]

  if (!viewName || !scriptId) {
    process.stderr.write(`usage: bun viewer-server.ts <view-name> <script-id>\navailable views: ${AVAILABLE_VIEWS.join(', ')}\n`)
    process.exit(2)
  }

  if (!AVAILABLE_VIEWS.includes(viewName)) {
    process.stderr.write(`error: unknown view "${viewName}"\navailable views: ${AVAILABLE_VIEWS.join(', ')}\n`)
    process.exit(2)
  }

  const skillRoot = process.env.SKILL_ROOT ?? process.env.CLAUDE_SKILL_DIR
  if (!skillRoot) {
    process.stderr.write('error: SKILL_ROOT or CLAUDE_SKILL_DIR env var required\n')
    process.exit(1)
  }

  if (mode === 'production') {
    startServer(skillRoot, viewName, scriptId)
  } else {
    await startDevServer(skillRoot, viewName, scriptId)
  }
}
