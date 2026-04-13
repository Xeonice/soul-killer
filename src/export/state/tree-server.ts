/**
 * Branch tree HTTP server.
 *
 * Serves the interactive branch tree visualization HTML, provides a /data
 * JSON endpoint, and pushes real-time updates via SSE when save files change.
 *
 * This file is the entry point for the detached child process spawned by
 * `state tree`. It reads SKILL_ROOT and SCRIPT_ID from environment variables.
 */

import { existsSync, readFileSync, writeFileSync, watch, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { generateTreeHtml } from './tree-html.js'
import { readHistory, type HistoryEntry } from './history.js'
import { loadScriptFile, type ParsedScript } from './script.js'
import { resolveScriptPath, resolveSavePaths, readMetaFile } from './io.js'

const DEFAULT_PORT = 6677
const MAX_PORT_TRIES = 10
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours

interface ServerState {
  skillRoot: string
  scriptId: string
  port: number
}

// ── SSE client management ────────────────────────────────────────
const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>()
let idleTimer: ReturnType<typeof setTimeout> | null = null

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (sseClients.size === 0) {
      cleanupAndExit()
    }
  }, IDLE_TIMEOUT_MS)
}

function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const encoded = new TextEncoder().encode(payload)
  for (const ctrl of sseClients) {
    try { ctrl.enqueue(encoded) } catch { sseClients.delete(ctrl) }
  }
}

// ── Data loading ─────────────────────────────────────────────────
function loadTreeData(skillRoot: string, scriptId: string): Record<string, unknown> {
  const scriptPath = resolveScriptPath(skillRoot, scriptId)
  const script = loadScriptFile(scriptPath)
  const paths = resolveSavePaths(skillRoot, scriptId, 'auto')

  let currentScene = script.firstSceneId
  let history: string[] = []

  if (existsSync(paths.metaYamlPath)) {
    try {
      const meta = readMetaFile(paths.metaYamlPath)
      currentScene = meta.currentScene
    } catch { /* use default */ }
  }

  const historyLogPath = join(dirname(paths.stateYamlPath), 'history.log')
  if (existsSync(historyLogPath)) {
    const entries = readHistory(historyLogPath)
    history = entries.map((e) => `${e.sceneId}:${e.choiceId}`)
  }

  // Convert scenes Map to plain object, preserving route/type metadata from raw script
  const rawScenes = (script.raw as Record<string, unknown>).scenes as Record<string, Record<string, unknown>> | undefined
  const scenes: Record<string, unknown> = {}
  for (const [id, scene] of script.scenes) {
    const rawScene = rawScenes?.[id]
    scenes[id] = {
      text: scene.text,
      choices: scene.choices,
      route: rawScene?.route ?? scene.route,
      type: rawScene?.type ?? scene.type,
      routing: rawScene?.routing ?? scene.routing,
    }
  }

  // Extract gate scenes (type: "affinity_gate")
  const gateScenes: string[] = []
  for (const [id] of script.scenes) {
    const rawScene = rawScenes?.[id]
    if (rawScene?.type === 'affinity_gate') {
      gateScenes.push(id)
    }
  }

  // Extract routes: collect unique route values from scenes + gate routing
  const routeSet = new Set<string>()
  for (const [_id, scene] of script.scenes) {
    const rawScene = rawScenes?.[_id]
    const route = rawScene?.route ?? scene.route
    if (typeof route === 'string') {
      routeSet.add(route)
    }
    // Collect route_ids from gate routing
    const routing = rawScene?.routing ?? scene.routing
    if (Array.isArray(routing)) {
      for (const r of routing as Array<{ route_id?: string }>) {
        if (typeof r.route_id === 'string') routeSet.add(r.route_id)
      }
    }
  }
  // Also check top-level routes array if present
  const rawRoutes = (script.raw as Record<string, unknown>).routes as string[] | undefined
  if (Array.isArray(rawRoutes)) {
    for (const r of rawRoutes) routeSet.add(r)
  }
  const routes = [...routeSet]

  // Extract endings from raw script data
  const endings: Record<string, { text: string; type: string }> = {}
  // Find scene IDs referenced as `next` but not in scenes (they are endings)
  for (const scene of script.scenes.values()) {
    for (const choice of scene.choices) {
      if (choice.next && !script.scenes.has(choice.next)) {
        endings[choice.next] = { text: choice.next, type: 'ending' }
      }
    }
  }

  return { scenes, history, currentScene, endings, scriptId, routes, gateScenes }
}

// ── Server JSON management ───────────────────────────────────────
function serverJsonPath(skillRoot: string): string {
  return join(skillRoot, 'runtime', 'tree', 'server.json')
}

function writeServerJson(skillRoot: string, port: number, pid: number, scriptId: string): void {
  const path = serverJsonPath(skillRoot)
  const dir = dirname(path)
  const { mkdirSync } = require('node:fs') as typeof import('node:fs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify({ port, pid, scriptId }, null, 2), 'utf8')
}

function cleanupAndExit(): void {
  const skillRoot = process.env.SKILL_ROOT ?? ''
  const path = serverJsonPath(skillRoot)
  try { unlinkSync(path) } catch { /* ignore */ }
  process.exit(0)
}

// ── File watcher ─────────────────────────────────────────────────
let currentWatcher: ReturnType<typeof watch> | null = null

function watchSaveDir(skillRoot: string, scriptId: string): void {
  if (currentWatcher) currentWatcher.close()

  const paths = resolveSavePaths(skillRoot, scriptId, 'auto')
  const saveDir = dirname(paths.stateYamlPath)

  if (!existsSync(saveDir)) return

  currentWatcher = watch(saveDir, (_eventType, filename) => {
    if (filename === 'history.log' || filename === 'meta.yaml') {
      // Debounce: wait 100ms for atomic writes to settle
      setTimeout(() => {
        const data = loadTreeData(skillRoot, scriptId)
        broadcastSSE('update', data)
      }, 100)
    }
  })
}

// ── Main server entry ────────────────────────────────────────────
if (import.meta.main) {
  const skillRoot = process.env.SKILL_ROOT
  const scriptId = process.env.SCRIPT_ID

  if (!skillRoot || !scriptId) {
    process.stderr.write('tree-server: SKILL_ROOT and SCRIPT_ID env vars required\n')
    process.exit(1)
  }

  const html = generateTreeHtml()
  let boundPort = DEFAULT_PORT

  // Try to bind port
  let server: ReturnType<typeof Bun.serve> | null = null
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const tryPort = DEFAULT_PORT + i
    try {
      server = Bun.serve({
        port: tryPort,
        fetch(req) {
          const url = new URL(req.url)

          if (url.pathname === '/') {
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          }

          if (url.pathname === '/data') {
            const data = loadTreeData(skillRoot, scriptId)
            return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
          }

          if (url.pathname === '/events') {
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                sseClients.add(controller)
                resetIdleTimer()
              },
              cancel(controller) {
                sseClients.delete(controller)
                if (sseClients.size === 0) resetIdleTimer()
              },
            })
            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            })
          }

          if (url.pathname === '/switch' && req.method === 'POST') {
            return req.json().then((body: { scriptId: string }) => {
              process.env.SCRIPT_ID = body.scriptId
              watchSaveDir(skillRoot, body.scriptId)
              const data = loadTreeData(skillRoot, body.scriptId)
              broadcastSSE('switch', data)
              // Update server.json
              writeServerJson(skillRoot, boundPort, process.pid, body.scriptId)
              return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
            })
          }

          return new Response('Not Found', { status: 404 })
        },
      })
      boundPort = tryPort
      break
    } catch (err) {
      if (i === MAX_PORT_TRIES - 1) {
        process.stderr.write(`tree-server: failed to bind any port in range ${DEFAULT_PORT}-${DEFAULT_PORT + MAX_PORT_TRIES - 1}\n`)
        process.exit(1)
      }
      // EADDRINUSE — try next port
    }
  }

  writeServerJson(skillRoot, boundPort, process.pid, scriptId)
  watchSaveDir(skillRoot, scriptId)
  resetIdleTimer()

  // Signal to parent that we're ready
  process.stdout.write(`TREE_URL http://localhost:${boundPort}\n`)
}
