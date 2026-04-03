import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface PathItem {
  name: string
  fullPath: string
  isDirectory: boolean
}

const MAX_ENTRIES = 100

export function expandTilde(inputPath: string): string {
  if (inputPath === '~' || inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(1))
  }
  return inputPath
}

export function parsePath(input: string): { parentDir: string; prefix: string } {
  const expanded = expandTilde(input)
  const lastSlash = expanded.lastIndexOf('/')

  if (lastSlash === -1) {
    return { parentDir: '.', prefix: expanded }
  }

  if (expanded.endsWith('/')) {
    return { parentDir: expanded, prefix: '' }
  }

  return {
    parentDir: expanded.slice(0, lastSlash + 1),
    prefix: expanded.slice(lastSlash + 1),
  }
}

export function listEntries(input: string): PathItem[] {
  const { parentDir, prefix } = parsePath(input)

  try {
    const entries = fs.readdirSync(parentDir, { withFileTypes: true })
    const filtered = entries
      .filter((e) => !e.name.startsWith('.'))
      .filter((e) => prefix === '' || e.name.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, MAX_ENTRIES)
      .map((e) => ({
        name: e.name,
        fullPath: path.join(parentDir, e.name),
        isDirectory: e.isDirectory(),
      }))

    // Sort: directories first, then alphabetically
    filtered.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return filtered
  } catch {
    return []
  }
}

/**
 * Build the display path for a selected item.
 * Preserves ~ prefix if the original input used it.
 */
export function buildDisplayPath(item: PathItem, originalInput: string): string {
  const home = os.homedir()
  let result = item.fullPath

  if (originalInput.startsWith('~') && result.startsWith(home)) {
    result = '~' + result.slice(home.length)
  }

  if (item.isDirectory && !result.endsWith('/')) {
    result += '/'
  }

  return result
}
