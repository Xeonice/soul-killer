/**
 * Viewer HTTP server — dual-mode entry.
 *
 * Production: startProductionServer() — serves embedded static files + API.
 * Development: startDevServer() — launches vite dev + API in same process.
 *
 * Dev entry: `bun src/export/state/viewer-server.ts tree <script-id>`
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { loadTreeData, watchSaveDir, type FileWatcher } from './viewer-data.js'

const DEFAULT_PORT = 6677
const MAX_PORT_TRIES = 10
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000

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

// ── API request handler ──────────────────────────────────────────
function handleApiRequest(
  url: URL,
  req: Request,
  skillRoot: string,
  viewName: string,
  scriptId: string,
  boundPort: number,
): Response | null {
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
    return new Response(
      req.text().then((body) => {
        const { scriptId: newId } = JSON.parse(body)
        const data = loader(skillRoot, newId)
        broadcastSSE('switch', data)
        writeServerJson(skillRoot, boundPort, process.pid, newId)
        return JSON.stringify({ ok: true })
      }),
    )
  }

  return null
}

// ── Production server ────────────────────────────────────────────
export interface ViewerServerResult {
  action: 'started'
  url: string
  port: number
  pid: number
}

export async function startProductionServer(
  skillRoot: string,
  viewName: string,
  scriptId: string,
): Promise<ViewerServerResult> {
  // Dynamic import — only resolves at build time when barrel exists
  let files: Record<string, { content: string; mime: string }>
  try {
    const bundle = await import('./viewer-bundle.js')
    files = bundle.files
  } catch {
    throw new Error('viewer-bundle.ts not found. Run "bun run build:release" first.')
  }

  let boundPort = DEFAULT_PORT

  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const tryPort = DEFAULT_PORT + i
    try {
      Bun.serve({
        port: tryPort,
        idleTimeout: 0,
        fetch(req) {
          const url = new URL(req.url)

          // API routes
          const apiResponse = handleApiRequest(url, req, skillRoot, viewName, scriptId, tryPort)
          if (apiResponse) return apiResponse

          // Static files from barrel
          const pathname = url.pathname === '/' ? '/' : url.pathname
          const file = files[pathname]
          if (file) {
            return new Response(file.content, { headers: { 'Content-Type': file.mime } })
          }

          // SPA fallback — serve index.html for client-side routing
          const index = files['/']
          if (index) {
            return new Response(index.content, { headers: { 'Content-Type': index.mime } })
          }

          return new Response('Not Found', { status: 404 })
        },
      })
      boundPort = tryPort
      break
    } catch {
      if (i === MAX_PORT_TRIES - 1) {
        throw new Error(`Failed to bind any port in range ${DEFAULT_PORT}-${DEFAULT_PORT + MAX_PORT_TRIES - 1}`)
      }
    }
  }

  const treeDir = join(skillRoot, 'runtime', 'tree')
  if (!existsSync(treeDir)) mkdirSync(treeDir, { recursive: true })
  writeServerJson(skillRoot, boundPort, process.pid, scriptId)

  // Watch for file changes
  watchSaveDir(skillRoot, scriptId, (data) => broadcastSSE('update', data))
  resetIdleTimer(skillRoot)

  return { action: 'started', url: `http://localhost:${boundPort}`, port: boundPort, pid: process.pid }
}

// ── Dev server ───────────────────────────────────────────────────
async function startDevServer(
  skillRoot: string,
  viewName: string,
  scriptId: string,
): Promise<void> {
  const { createServer } = await import('vite')

  const viewerRoot = resolve(process.cwd(), 'packages', 'viewer')

  // Start API server on default port
  let apiPort = DEFAULT_PORT
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const tryPort = DEFAULT_PORT + i
    try {
      Bun.serve({
        port: tryPort,
        idleTimeout: 0,
        fetch(req) {
          const url = new URL(req.url)
          const apiResponse = handleApiRequest(url, req, skillRoot, viewName, scriptId, tryPort)
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

  // Watch for file changes
  watchSaveDir(skillRoot, scriptId, (data) => broadcastSSE('update', data))

  // Start vite dev server with proxy to API
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

// ── Direct-execution entry (dev mode) ────────────────────────────
if (import.meta.main) {
  const args = process.argv.slice(2)
  const viewName = args[0]
  const scriptId = args[1]

  if (!viewName || !scriptId) {
    process.stderr.write(`usage: bun viewer-server.ts <view-name> <script-id>\n`)
    process.stderr.write(`available views: ${AVAILABLE_VIEWS.join(', ')}\n`)
    process.exit(2)
  }

  if (!AVAILABLE_VIEWS.includes(viewName)) {
    process.stderr.write(`error: unknown view "${viewName}"\navailable views: ${AVAILABLE_VIEWS.join(', ')}\n`)
    process.exit(2)
  }

  // Resolve skill root from SKILL_ROOT env or CLAUDE_SKILL_DIR
  const skillRoot = process.env.SKILL_ROOT ?? process.env.CLAUDE_SKILL_DIR
  if (!skillRoot) {
    process.stderr.write('error: SKILL_ROOT or CLAUDE_SKILL_DIR env var required\n')
    process.exit(1)
  }

  await startDevServer(skillRoot, viewName, scriptId)
}
