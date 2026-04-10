/**
 * Mini YAML parser/serializer for skill runtime state files.
 *
 * Handles exactly two shapes:
 *   1. Flat top-level: `key: value` entries (used by meta.yaml)
 *   2. One-level block: `key:` followed by 2-space-indented `"quoted-key": value`
 *      entries (used by state.yaml's `state:` block)
 *
 * Explicitly rejects:
 *   - Nesting deeper than one level
 *   - Tabs (spaces only)
 *   - Block scalars, anchors, tags, flow style
 *
 * Zero dependencies. Designed to be shipped inside skill archives and run by
 * bun without any npm install step.
 */

export type MiniPrimitive = number | boolean | string
export type MiniBlock = Record<string, MiniPrimitive>
export type MiniValue = MiniPrimitive | MiniBlock
export type MiniDocument = Record<string, MiniValue>

export class MiniYamlError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(line !== undefined ? `[line ${line}] ${message}` : message)
    this.name = 'MiniYamlError'
  }
}

interface ParsedLine {
  indent: number
  key: string
  value: string
  isBlockStart: boolean
}

function parseLine(raw: string, lineNo: number): ParsedLine | null {
  // Detect tabs first
  if (raw.includes('\t')) {
    throw new MiniYamlError('tabs not allowed (use spaces)', lineNo)
  }

  // Measure indentation
  let i = 0
  while (i < raw.length && raw[i] === ' ') i++
  const indent = i

  // Blank line or comment-only line
  const rest = raw.slice(i)
  if (rest === '' || rest.startsWith('#')) return null

  // Parse key: possibly double-quoted
  let key: string
  if (rest[0] === '"') {
    const end = rest.indexOf('"', 1)
    if (end === -1) {
      throw new MiniYamlError('unterminated quoted key', lineNo)
    }
    key = rest.slice(1, end)
    i += end + 1
  } else {
    // Bare key: read until colon
    const colonRel = rest.indexOf(':')
    if (colonRel === -1) {
      throw new MiniYamlError(`no colon found in line: "${raw}"`, lineNo)
    }
    key = rest.slice(0, colonRel).trimEnd()
    if (key === '') {
      throw new MiniYamlError('empty key', lineNo)
    }
    i += colonRel
  }

  // Expect colon after key
  if (raw[i] !== ':') {
    throw new MiniYamlError(`expected ':' after key "${key}"`, lineNo)
  }
  i++

  // Skip spaces between colon and value
  while (i < raw.length && raw[i] === ' ') i++

  // Value is the remainder, trimmed of trailing whitespace
  const valueRaw = raw.slice(i).replace(/\s+$/, '')
  const isBlockStart = valueRaw === ''

  return { indent, key, value: valueRaw, isBlockStart }
}

function parseScalar(raw: string, lineNo: number): MiniPrimitive {
  // Double-quoted string
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw.slice(1, -1).replace(/\\"/g, '"')
  }
  // Boolean
  if (raw === 'true') return true
  if (raw === 'false') return false
  // Integer
  if (/^-?\d+$/.test(raw)) {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n)) {
      throw new MiniYamlError(`invalid integer: ${raw}`, lineNo)
    }
    return n
  }
  // Reject floats explicitly to keep the value space tight
  if (/^-?\d+\.\d+$/.test(raw)) {
    throw new MiniYamlError(`float values not supported: ${raw}`, lineNo)
  }
  // Bare string (enum value, etc.)
  return raw
}

export function parseMiniYaml(text: string): MiniDocument {
  const lines = text.split('\n')
  const result: MiniDocument = {}
  let currentBlockKey: string | null = null
  let currentBlock: MiniBlock | null = null

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1
    const parsed = parseLine(lines[idx]!, lineNo)
    if (parsed === null) continue

    if (parsed.indent === 0) {
      // Top-level entry: closes any open block
      currentBlockKey = null
      currentBlock = null

      if (parsed.key in result) {
        throw new MiniYamlError(`duplicate key "${parsed.key}"`, lineNo)
      }

      if (parsed.isBlockStart) {
        currentBlockKey = parsed.key
        currentBlock = {}
        result[parsed.key] = currentBlock
      } else {
        result[parsed.key] = parseScalar(parsed.value, lineNo)
      }
    } else if (parsed.indent === 2) {
      if (currentBlock === null) {
        throw new MiniYamlError(
          'indented entry without parent block',
          lineNo
        )
      }
      if (parsed.isBlockStart) {
        throw new MiniYamlError(
          `nested block not supported at key "${parsed.key}"`,
          lineNo
        )
      }
      if (parsed.key in currentBlock) {
        throw new MiniYamlError(
          `duplicate key "${parsed.key}" in block "${currentBlockKey}"`,
          lineNo
        )
      }
      currentBlock[parsed.key] = parseScalar(parsed.value, lineNo)
    } else {
      throw new MiniYamlError(
        `unexpected indentation (${parsed.indent}) at key "${parsed.key}"`,
        lineNo
      )
    }
  }

  return result
}

function needsQuoting(value: string): boolean {
  if (value === '') return true
  if (value === 'true' || value === 'false') return true
  if (/^-?\d+$/.test(value)) return true
  if (/^-?\d+\.\d+$/.test(value)) return true
  // Characters that would confuse the parser or break YAML ergonomics
  if (/[:#"\s\[\]{},]/.test(value)) return true
  return false
}

function serializeScalar(value: MiniPrimitive): string {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new MiniYamlError(`non-integer number: ${value}`)
    }
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (needsQuoting(value)) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

function isBlock(value: MiniValue): value is MiniBlock {
  return typeof value === 'object' && value !== null
}

export function serializeMiniYaml(doc: MiniDocument): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(doc)) {
    if (isBlock(value)) {
      lines.push(`${key}:`)
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  "${subKey}": ${serializeScalar(subValue)}`)
      }
    } else {
      lines.push(`${key}: ${serializeScalar(value)}`)
    }
  }
  return lines.join('\n') + '\n'
}
