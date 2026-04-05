import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseSpecFile, parseTimeout, ParseError } from '../../acceptance/parser.js'

describe('parseTimeout', () => {
  it('parses milliseconds as number', () => {
    expect(parseTimeout(5000)).toBe(5000)
  })

  it('parses "30s"', () => {
    expect(parseTimeout('30s')).toBe(30_000)
  })

  it('parses "2m"', () => {
    expect(parseTimeout('2m')).toBe(120_000)
  })

  it('parses "500ms"', () => {
    expect(parseTimeout('500ms')).toBe(500)
  })

  it('throws on invalid format', () => {
    expect(() => parseTimeout('abc')).toThrow('Invalid timeout format')
  })
})

describe('parseSpecFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-parser-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeSpec(content: string): string {
    const filePath = path.join(tmpDir, 'spec.md')
    fs.writeFileSync(filePath, content)
    return filePath
  }

  it('extracts a single acceptance block', () => {
    const file = writeSpec(`
# Test Spec

### Requirement: Something

#### Scenario: Basic test

- WHEN something
- THEN something else

\`\`\`acceptance
fixture: void
steps:
  - send: "/help"
  - expect: "COMMANDS"
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]!.name).toBe('Basic test')
    expect(scenarios[0]!.environment.fixture).toBe('void')
    expect(scenarios[0]!.steps).toHaveLength(2)
    expect(scenarios[0]!.steps[0]!.type).toBe('send')
    expect(scenarios[0]!.steps[0]!.value).toBe('/help')
    expect(scenarios[0]!.steps[1]!.type).toBe('expect')
  })

  it('extracts multiple acceptance blocks', () => {
    const file = writeSpec(`
#### Scenario: First

\`\`\`acceptance
steps:
  - send: "hello"
\`\`\`

#### Scenario: Second

\`\`\`acceptance
fixture: distilled-soul
soul-name: alice
steps:
  - wait-prompt:
  - send: "/use alice"
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    expect(scenarios).toHaveLength(2)
    expect(scenarios[0]!.name).toBe('First')
    expect(scenarios[0]!.environment.fixture).toBe('void')
    expect(scenarios[1]!.name).toBe('Second')
    expect(scenarios[1]!.environment.fixture).toBe('distilled-soul')
    expect(scenarios[1]!.environment.soulName).toBe('alice')
  })

  it('returns empty for spec with no acceptance blocks', () => {
    const file = writeSpec(`
# Spec

#### Scenario: No acceptance here

- WHEN something
- THEN something else
`)

    const scenarios = parseSpecFile(file)
    expect(scenarios).toHaveLength(0)
  })

  it('throws ParseError for invalid YAML', () => {
    const file = writeSpec(`
#### Scenario: Bad yaml

\`\`\`acceptance
steps:
  - send: "hello
    broken yaml [[[
\`\`\`
`)

    expect(() => parseSpecFile(file)).toThrow(ParseError)
    expect(() => parseSpecFile(file)).toThrow('Invalid YAML')
  })

  it('throws ParseError when steps is missing', () => {
    const file = writeSpec(`
#### Scenario: Missing steps

\`\`\`acceptance
fixture: void
\`\`\`
`)

    expect(() => parseSpecFile(file)).toThrow(ParseError)
    expect(() => parseSpecFile(file)).toThrow('must contain a "steps" array')
  })

  it('throws ParseError for acceptance block without scenario heading', () => {
    const file = writeSpec(`
# Spec

\`\`\`acceptance
steps:
  - send: "hello"
\`\`\`
`)

    expect(() => parseSpecFile(file)).toThrow(ParseError)
    expect(() => parseSpecFile(file)).toThrow('without a preceding')
  })

  it('parses environment declarations correctly', () => {
    const file = writeSpec(`
#### Scenario: Full env

\`\`\`acceptance
fixture: evolved-soul
soul-name: johnny
mock-llm:
  response: "I am Johnny."
timeout: 60s
env:
  DEBUG: "true"
steps:
  - wait-prompt:
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    const env = scenarios[0]!.environment
    expect(env.fixture).toBe('evolved-soul')
    expect(env.soulName).toBe('johnny')
    expect(env.mockLlm).toEqual({ response: 'I am Johnny.' })
    expect(env.timeout).toBe(60_000)
    expect(env.env).toEqual({ DEBUG: 'true' })
  })

  it('parses mock-llm: true shorthand', () => {
    const file = writeSpec(`
#### Scenario: Mock shorthand

\`\`\`acceptance
mock-llm: true
steps:
  - send: "hello"
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    expect(scenarios[0]!.environment.mockLlm).toEqual({})
  })

  it('parses step-level timeout', () => {
    const file = writeSpec(`
#### Scenario: Step timeout

\`\`\`acceptance
steps:
  - expect: "slow thing"
    timeout: 60s
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    expect(scenarios[0]!.steps[0]!.timeout).toBe(60_000)
  })

  it('uses default values for omitted environment fields', () => {
    const file = writeSpec(`
#### Scenario: Defaults

\`\`\`acceptance
steps:
  - send: "hello"
\`\`\`
`)

    const scenarios = parseSpecFile(file)
    const env = scenarios[0]!.environment
    expect(env.fixture).toBe('void')
    expect(env.soulName).toBe('test-soul')
    expect(env.mockLlm).toBeUndefined()
    expect(env.timeout).toBe(30_000)
  })
})
