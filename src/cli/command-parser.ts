export interface ParsedCommand {
  type: 'slash'
  name: string
  args: string
}

export interface NaturalInput {
  type: 'natural'
  text: string
}

export type ParsedInput = ParsedCommand | NaturalInput

import { getCommandNames } from './command-registry.js'

export function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim()
  if (trimmed.startsWith('/')) {
    const rest = trimmed.slice(1)
    const spaceIdx = rest.indexOf(' ')
    const name = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
    const args = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim()
    return { type: 'slash', name, args }
  }
  return { type: 'natural', text: trimmed }
}

export function suggestCommand(name: string): string | null {
  // Simple Levenshtein-ish matching
  let best: string | null = null
  let bestScore = Infinity

  for (const cmd of getCommandNames()) {
    const dist = levenshtein(name.toLowerCase(), cmd)
    if (dist < bestScore && dist <= 2) {
      bestScore = dist
      best = cmd
    }
  }

  return best
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])

  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }

  return dp[m]![n]!
}
