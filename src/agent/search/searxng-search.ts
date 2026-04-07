import { execSync } from 'node:child_process'
import path from 'node:path'
import { logger } from '../../utils/logger.js'
import type { SearchResult } from './tavily-search.js'

const CONTAINER_NAME = 'soulkiller-searxng'
const SEARXNG_IMAGE = 'searxng/searxng:latest'
const SEARXNG_PORT = 8080
const SEARXNG_URL = `http://localhost:${SEARXNG_PORT}`
const HEALTH_CHECK_MAX_SECONDS = 15

// ========== Docker Detection ==========

export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

// ========== Container Status ==========

type ContainerStatus = 'running' | 'stopped' | 'absent'

function getContainerStatus(): ContainerStatus {
  try {
    const output = execSync(
      `docker ps -a --filter name=^/${CONTAINER_NAME}$ --format "{{.Status}}"`,
      { encoding: 'utf-8', timeout: 3000 },
    ).trim()

    if (!output) return 'absent'
    if (output.startsWith('Up')) return 'running'
    return 'stopped'
  } catch {
    return 'absent'
  }
}

// ========== Health Check ==========

async function waitForHealthy(): Promise<boolean> {
  for (let i = 0; i < HEALTH_CHECK_MAX_SECONDS; i++) {
    try {
      const res = await fetch(`${SEARXNG_URL}/search?q=test&format=json`)
      if (res.ok) return true
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

// ========== Container Lifecycle ==========

function getSettingsPath(): string {
  // Resolve from project root: engine/searxng/settings.yml
  // In development: relative to cwd. In production: alongside the binary.
  const candidates = [
    path.resolve(process.cwd(), 'engine/searxng/settings.yml'),
    path.resolve(import.meta.dirname, '../../engine/searxng/settings.yml'),
  ]

  for (const p of candidates) {
    try {
      const fs = require('node:fs')
      if (fs.existsSync(p)) return p
    } catch {
      // continue
    }
  }

  return candidates[0]!
}

function startContainer(): void {
  logger.info('[searxng] Starting existing container')
  execSync(`docker start ${CONTAINER_NAME}`, { stdio: 'ignore', timeout: 10000 })
}

function createContainer(): void {
  const settingsPath = getSettingsPath()
  logger.info('[searxng] Creating new container, settings:', settingsPath)

  execSync(
    `docker run -d --name ${CONTAINER_NAME} -p ${SEARXNG_PORT}:8080 -v "${settingsPath}:/etc/searxng/settings.yml:ro" ${SEARXNG_IMAGE}`,
    { stdio: 'ignore', timeout: 60000 },
  )
}

// ========== Public API ==========

/**
 * Ensure SearXNG is running. Returns true if available.
 * Handles: Docker detection → container status → start/create → health check.
 */
export async function ensureSearxng(): Promise<boolean> {
  if (!isDockerAvailable()) {
    logger.info('[searxng] Docker not available, skipping')
    return false
  }

  const status = getContainerStatus()
  logger.info('[searxng] Container status:', status)

  try {
    if (status === 'running') {
      const healthy = await waitForHealthy()
      if (healthy) {
        logger.info('[searxng] Already running and healthy')
        return true
      }
      logger.warn('[searxng] Running but not healthy')
      return false
    }

    if (status === 'stopped') {
      startContainer()
    } else {
      createContainer()
    }

    const healthy = await waitForHealthy()
    if (healthy) {
      logger.info('[searxng] Started successfully')
      return true
    }

    logger.warn('[searxng] Started but health check failed')
    return false
  } catch (err) {
    logger.warn('[searxng] Failed to ensure container:', err)
    return false
  }
}

/**
 * Search using local SearXNG instance.
 */
export async function searxngSearch(query: string): Promise<SearchResult[]> {
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,reddit,wikipedia`

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })

  if (!res.ok) {
    throw new Error(`SearXNG search failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    results: { title: string; url: string; content: string }[]
  }

  return data.results.slice(0, 10).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }))
}
