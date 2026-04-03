import { execSync } from 'node:child_process'
import type { EngineAdapter } from './adapter.js'
import { LocalEngine } from './local-engine.js'
import { DockerEngine } from './docker-engine.js'

const CONTAINER_NAME = 'soulkiller-engine'
const ENGINE_IMAGE = 'soulkiller/engine:latest'

export async function detectEngine(soulDir: string): Promise<EngineAdapter> {
  if (isDockerAvailable()) {
    const containerRunning = isContainerRunning()
    if (containerRunning) {
      return new DockerEngine()
    }

    // Try to start container silently
    try {
      await startContainer()
      return new DockerEngine()
    } catch {
      // Fallback to local
    }
  }

  return new LocalEngine(soulDir)
}

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function isContainerRunning(): boolean {
  try {
    const output = execSync(
      `docker ps --filter name=${CONTAINER_NAME} --format "{{.Status}}"`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim()
    return output.includes('Up')
  } catch {
    return false
  }
}

async function startContainer(): Promise<void> {
  execSync(
    `docker run -d --name ${CONTAINER_NAME} -p 6600:6600 ${ENGINE_IMAGE}`,
    { stdio: 'ignore', timeout: 30000 }
  )

  // Wait for health check
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://localhost:6600/status')
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  throw new Error('Engine container failed to start')
}
