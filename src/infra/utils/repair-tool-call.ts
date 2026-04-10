/**
 * Shared tool call repair function for ToolLoopAgent instances.
 *
 * LLMs sometimes serialize array parameters as JSON-encoded strings
 * instead of actual arrays. This repair function detects and fixes
 * such cases before zod validation, preventing circuit breaker trips.
 */

import { NoSuchToolError } from 'ai'

/**
 * Creates a repair function that fixes string-encoded array arguments.
 * Intended for use with `experimental_repairToolCall` on ToolLoopAgent.
 *
 * Repair strategy (local, no extra LLM call):
 * 1. Parse the raw tool call input JSON
 * 2. For each value that is a string starting with '[':
 *    a. Try JSON.parse (handles well-formed JSON arrays)
 *    b. Fall back to regex extraction (handles broken inner quotes)
 * 3. Return repaired tool call, or null if nothing to fix
 */
export function createArrayArgRepair() {
  return async ({ toolCall, error }: {
    toolCall: { toolCallId: string; toolName: string; input: string }
    error: Error
  }) => {
    if (NoSuchToolError.isInstance(error)) return null

    let args: Record<string, unknown>
    try {
      args = JSON.parse(toolCall.input)
    } catch {
      return null // input itself is malformed, can't fix
    }

    let modified = false

    for (const [key, val] of Object.entries(args)) {
      if (typeof val !== 'string') continue
      const trimmed = val.trim()
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) continue

      // Strategy A: JSON.parse
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          args[key] = parsed
          modified = true
          continue
        }
      } catch { /* fall through to regex */ }

      // Strategy B: regex extraction for broken JSON (unescaped inner quotes)
      const inner = trimmed.slice(1, -1).trim()
      if (!inner) continue

      const elements = inner
        .split(/",\s*"/)
        .map((s) => s.replace(/^[\s"]+|[\s"]+$/g, '').trim())
        .filter(Boolean)

      if (elements.length > 0) {
        args[key] = elements
        modified = true
      }
    }

    return modified
      ? { type: 'tool-call' as const, ...toolCall, input: JSON.stringify(args) }
      : null
  }
}
