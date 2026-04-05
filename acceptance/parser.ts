import fs from 'node:fs'
import { parse as parseYaml } from 'yaml'
import type { AcceptanceScenario, EnvironmentDeclaration, StepDefinition } from './types.js'

export class ParseError extends Error {
  constructor(
    public specFile: string,
    public line: number,
    message: string,
  ) {
    super(`PARSE_ERROR at ${specFile}:${line} — ${message}`)
    this.name = 'ParseError'
  }
}

/**
 * Parse timeout strings like "30s", "2m", or raw millisecond numbers.
 */
export function parseTimeout(value: string | number): number {
  if (typeof value === 'number') return value
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(s|ms|m)$/)
  if (!match) throw new Error(`Invalid timeout format: "${value}"`)
  const num = parseFloat(match[1]!)
  switch (match[2]) {
    case 'ms': return num
    case 's': return num * 1000
    case 'm': return num * 60_000
    default: return num
  }
}

/**
 * Parse a single YAML step object into a StepDefinition.
 */
function parseStep(raw: Record<string, unknown>): StepDefinition {
  const keys = Object.keys(raw).filter((k) => k !== 'timeout')
  if (keys.length === 0) throw new Error('Empty step')

  const type = keys[0]!
  const value = raw[type]
  const timeout = raw.timeout != null ? parseTimeout(raw.timeout as string | number) : undefined

  return { type, value: value as StepDefinition['value'], timeout, raw }
}

/**
 * Parse environment declaration from YAML top-level fields.
 */
function parseEnvironment(yaml: Record<string, unknown>): EnvironmentDeclaration {
  const fixture = (yaml.fixture as string) ?? 'void'
  if (!['void', 'bare-soul', 'distilled-soul', 'evolved-soul'].includes(fixture)) {
    throw new Error(`Unknown fixture: "${fixture}"`)
  }

  const soulName = (yaml['soul-name'] as string) ?? 'test-soul'

  let mockLlm: EnvironmentDeclaration['mockLlm'] = undefined
  if (yaml['mock-llm'] === true) {
    mockLlm = {}
  } else if (yaml['mock-llm'] && typeof yaml['mock-llm'] === 'object') {
    mockLlm = yaml['mock-llm'] as { response?: string }
  }

  const realConfig = yaml['real-config'] === true
  const timeout = yaml.timeout != null ? parseTimeout(yaml.timeout as string | number) : 30_000

  return {
    fixture: fixture as EnvironmentDeclaration['fixture'],
    soulName,
    persona: yaml.persona as EnvironmentDeclaration['persona'],
    mockLlm,
    realConfig,
    env: yaml.env as Record<string, string>,
    timeout,
  }
}

/**
 * Extract all acceptance scenarios from a spec.md file.
 */
export function parseSpecFile(filePath: string): AcceptanceScenario[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const scenarios: AcceptanceScenario[] = []

  let currentScenario: string | null = null
  let currentScenarioLine = 0
  let inAcceptanceBlock = false
  let blockStartLine = 0
  let blockLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1

    // Track #### Scenario: headings
    const scenarioMatch = line.match(/^####\s+Scenario:\s*(.+)/)
    if (scenarioMatch) {
      currentScenario = scenarioMatch[1]!.trim()
      currentScenarioLine = lineNum
      continue
    }

    // Start of acceptance block
    if (line.trim() === '```acceptance') {
      if (!currentScenario) {
        throw new ParseError(filePath, lineNum, '```acceptance block found without a preceding #### Scenario heading')
      }
      inAcceptanceBlock = true
      blockStartLine = lineNum
      blockLines = []
      continue
    }

    // End of acceptance block
    if (inAcceptanceBlock && line.trim() === '```') {
      inAcceptanceBlock = false
      const yamlContent = blockLines.join('\n')

      let parsed: Record<string, unknown>
      try {
        parsed = parseYaml(yamlContent) as Record<string, unknown>
      } catch (err) {
        throw new ParseError(filePath, blockStartLine, `Invalid YAML: ${(err as Error).message}`)
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new ParseError(filePath, blockStartLine, 'Acceptance block must be a YAML object')
      }

      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new ParseError(filePath, blockStartLine, 'Acceptance block must contain a "steps" array')
      }

      let environment: EnvironmentDeclaration
      try {
        environment = parseEnvironment(parsed)
      } catch (err) {
        throw new ParseError(filePath, blockStartLine, (err as Error).message)
      }

      let steps: StepDefinition[]
      try {
        steps = (parsed.steps as Record<string, unknown>[]).map(parseStep)
      } catch (err) {
        throw new ParseError(filePath, blockStartLine, `Invalid step: ${(err as Error).message}`)
      }

      scenarios.push({
        name: currentScenario!,
        specFile: filePath,
        line: currentScenarioLine,
        environment,
        steps,
      })

      continue
    }

    // Accumulate block content
    if (inAcceptanceBlock) {
      blockLines.push(line)
    }
  }

  // Unclosed block
  if (inAcceptanceBlock) {
    throw new ParseError(filePath, blockStartLine, 'Unclosed ```acceptance block')
  }

  return scenarios
}
