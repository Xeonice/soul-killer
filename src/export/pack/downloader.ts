import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Download a remote pack file to a local temp file.
 * Returns the local temp file path (caller is responsible for cleanup).
 */
export async function downloadPack(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const urlPath = new URL(url).pathname
  const basename = path.basename(urlPath) || 'download.pack'
  const tmpFile = path.join(os.tmpdir(), `soulkiller-dl-${Date.now()}-${basename}`)

  const buf = await response.arrayBuffer()
  fs.writeFileSync(tmpFile, Buffer.from(buf))

  return tmpFile
}
