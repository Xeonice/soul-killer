#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import { AcceptanceRunner } from './runner.js'
import { ConsoleReporter } from './reporter.js'
import type { SuiteResult } from './types.js'

const OPENSPEC_SPECS = 'openspec/specs'

function findSpecFiles(target: string): string[] {
  const resolved = path.resolve(target)
  const stat = fs.statSync(resolved, { throwIfNoEntry: false })

  if (!stat) {
    console.error(`Path not found: ${resolved}`)
    process.exit(1)
  }

  if (stat.isFile()) {
    return [resolved]
  }

  // Recursively find all spec.md files
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name === 'spec.md') {
        files.push(fullPath)
      }
    }
  }
  walk(resolved)
  return files
}

function resolveChangeSpecs(changeName: string): string[] {
  const changeSpecsDir = path.resolve(`openspec/changes/${changeName}/specs`)
  if (!fs.existsSync(changeSpecsDir)) {
    console.error(`Change specs directory not found: ${changeSpecsDir}`)
    process.exit(1)
  }

  const capabilities: string[] = []
  for (const entry of fs.readdirSync(changeSpecsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      capabilities.push(entry.name)
    }
  }

  const specFiles: string[] = []
  for (const cap of capabilities) {
    const specFile = path.resolve(OPENSPEC_SPECS, cap, 'spec.md')
    if (fs.existsSync(specFile)) {
      specFiles.push(specFile)
    }
  }
  return specFiles
}

async function runHealthCheck(verbose: boolean): Promise<boolean> {
  const { parseSpecFile } = await import('./parser.js')

  // Create an in-memory health check spec
  const healthCheckYaml = `
#### Scenario: Health check - boot and exit

\`\`\`acceptance
fixture: void
timeout: 30s
steps:
  - wait-prompt:
  - send: "/help"
  - expect: "COMMANDS|commands|help"
  - wait-prompt:
  - send: "/exit"
  - wait-exit: 0
\`\`\`
`

  const tmpFile = path.join(import.meta.dirname, '.health-check-tmp.md')
  fs.writeFileSync(tmpFile, healthCheckYaml)

  try {
    const reporter = new ConsoleReporter({ verbose })
    const runner = new AcceptanceRunner(reporter)
    const result = await runner.runSpecFile(tmpFile)
    return result.failed === 0
  } finally {
    fs.rmSync(tmpFile, { force: true })
  }
}

// ── Main ──

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help') {
  console.log(`
Usage:
  bun src/acceptance/cli.ts verify <spec-file-or-dir>   Run acceptance scenarios
  bun src/acceptance/cli.ts verify --change <name>      Run scenarios for a change
  bun src/acceptance/cli.ts diagnose                    Health check (boot + /help + /exit)
  bun src/acceptance/cli.ts diagnose --spec <name>      Run spec scenarios (verbose)
  bun src/acceptance/cli.ts diagnose --verbose           All scenarios verbose
`)
  process.exit(0)
}

if (command === 'verify') {
  const changeIndex = args.indexOf('--change')
  let specFiles: string[]

  if (changeIndex !== -1) {
    const changeName = args[changeIndex + 1]
    if (!changeName) {
      console.error('Missing change name after --change')
      process.exit(1)
    }
    specFiles = resolveChangeSpecs(changeName)
  } else {
    const target = args[1]
    if (!target) {
      console.error('Missing spec file or directory path')
      process.exit(1)
    }
    specFiles = findSpecFiles(target)
  }

  if (specFiles.length === 0) {
    console.log('No spec files found.')
    process.exit(0)
  }

  const reporter = new ConsoleReporter({ verbose: args.includes('--verbose') })
  const runner = new AcceptanceRunner(reporter)
  const results: SuiteResult[] = []

  for (const file of specFiles) {
    const result = await runner.runSpecFile(file)
    results.push(result)
  }

  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0)
  const totalScenarios = results.reduce((sum, r) => sum + r.total, 0)

  if (totalScenarios === 0) {
    console.log('No acceptance scenarios found in the specified spec files.')
    process.exit(0)
  }

  console.log(`\nTotal: ${totalPassed}/${totalScenarios} passed across ${results.length} spec file(s)`)
  process.exit(totalFailed > 0 ? 1 : 0)
}

if (command === 'diagnose') {
  const verbose = args.includes('--verbose')
  const specIndex = args.indexOf('--spec')

  if (specIndex !== -1) {
    const specName = args[specIndex + 1]
    if (!specName) {
      console.error('Missing spec name after --spec')
      process.exit(1)
    }
    const specFile = path.resolve(OPENSPEC_SPECS, specName, 'spec.md')
    if (!fs.existsSync(specFile)) {
      console.error(`Spec not found: ${specFile}`)
      process.exit(1)
    }

    const reporter = new ConsoleReporter({ verbose: true })
    const runner = new AcceptanceRunner(reporter)
    const result = await runner.runSpecFile(specFile)
    process.exit(result.failed > 0 ? 1 : 0)
  }

  // Default: health check
  const passed = await runHealthCheck(verbose || true)
  process.exit(passed ? 0 : 1)
}

console.error(`Unknown command: ${command}`)
process.exit(1)
