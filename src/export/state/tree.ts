/**
 * `state tree <script-id>` / `state tree --stop`
 *
 * Manages the branch tree visualization server lifecycle:
 * - Start: spawn detached tree-server process, write server.json
 * - Reuse: if server already running, reuse (switch script if needed)
 * - Stop: kill server process, clean server.json
 */

import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawn, execSync } from 'node:child_process'

interface ServerInfo {
  port: number
  pid: number
  scriptId: string
}

function serverJsonPath(skillRoot: string): string {
  return join(skillRoot, 'runtime', 'tree', 'server.json')
}

function readServerInfo(skillRoot: string): ServerInfo | null {
  const path = serverJsonPath(skillRoot)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export interface TreeResult {
  action: 'started' | 'reused' | 'switched'
  url: string
  port: number
  pid: number
}

export interface TreeStopResult {
  action: 'stopped' | 'not_running'
}

export async function runTree(skillRoot: string, scriptId: string): Promise<TreeResult> {
  const info = readServerInfo(skillRoot)

  // Reuse existing server
  if (info && isProcessAlive(info.pid)) {
    if (info.scriptId === scriptId) {
      return { action: 'reused', url: `http://localhost:${info.port}`, port: info.port, pid: info.pid }
    }
    // Switch script
    try {
      const res = await fetch(`http://localhost:${info.port}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId }),
      })
      if (res.ok) {
        return { action: 'switched', url: `http://localhost:${info.port}`, port: info.port, pid: info.pid }
      }
    } catch {
      // Server not responding, clean up and restart
    }
    // Clean stale server.json
    try { unlinkSync(serverJsonPath(skillRoot)) } catch { /* ignore */ }
  } else if (info) {
    // PID dead, clean up
    try { unlinkSync(serverJsonPath(skillRoot)) } catch { /* ignore */ }
  }

  // Start new server
  const treeDir = join(skillRoot, 'runtime', 'tree')
  if (!existsSync(treeDir)) mkdirSync(treeDir, { recursive: true })

  // Use viewer-server via main.ts 'viewer' subcommand path
  // Spawns soulkiller runtime viewer tree <script-id> as a detached process
  const mainScript = join(dirname(new URL(import.meta.url).pathname), 'main.ts')

  return new Promise<TreeResult>((resolve, reject) => {
    const child = spawn(process.execPath, [mainScript, 'viewer', 'tree', scriptId], {
      env: { ...process.env, BUN_BE_BUN: '1', SKILL_ROOT: skillRoot },
      stdio: ['ignore', 'pipe', 'ignore'],
      detached: true,
    })

    let output = ''
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString()
      const match = output.match(/VIEWER_URL (http:\/\/localhost:\d+)/)
      if (match) {
        child.unref()
        const url = match[1]!
        const port = parseInt(new URL(url).port, 10)
        resolve({ action: 'started', url, port, pid: child.pid! })
      }
    })

    child.on('error', (err) => reject(err))
    child.on('exit', (code) => {
      if (!output.includes('VIEWER_URL')) {
        reject(new Error(`viewer-server exited with code ${code}`))
      }
    })

    // Timeout after 10s
    setTimeout(() => {
      if (!output.includes('VIEWER_URL')) {
        child.kill()
        reject(new Error('viewer-server startup timed out'))
      }
    }, 10000)
  })
}

export function runTreeStop(skillRoot: string): TreeStopResult {
  const info = readServerInfo(skillRoot)
  if (!info) return { action: 'not_running' }

  if (isProcessAlive(info.pid)) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${info.pid} /f /t`, { stdio: 'ignore' })
      } else {
        process.kill(info.pid, 'SIGTERM')
      }
    } catch { /* ignore */ }
  }

  try { unlinkSync(serverJsonPath(skillRoot)) } catch { /* ignore */ }
  return { action: 'stopped' }
}
