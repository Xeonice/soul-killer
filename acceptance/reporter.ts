import type { Reporter, StepDefinition, DiagnosticContext } from './types.js'

function stepLabel(step: StepDefinition): string {
  const val = typeof step.value === 'string'
    ? `"${step.value}"`
    : typeof step.value === 'number'
      ? String(step.value)
      : JSON.stringify(step.value)
  return `${step.type}: ${val}`
}

export class ConsoleReporter implements Reporter {
  private verbose: boolean
  private stepIndex = 0

  constructor(opts?: { verbose?: boolean }) {
    this.verbose = opts?.verbose ?? false
  }

  onSuiteStart(specPath: string, scenarioCount: number): void {
    console.log(`\n┌─── Verify: ${specPath} ─────────────────────┐`)
    console.log(`│  ${scenarioCount} scenario(s) to run`)
    console.log('│')
  }

  onScenarioStart(name: string): void {
    this.stepIndex = 0
    if (this.verbose) {
      console.log(`│  ▸ ${name}`)
    }
  }

  onStepPass(step: StepDefinition, elapsed: number): void {
    this.stepIndex++
    if (this.verbose) {
      console.log(`│    ✓ step ${this.stepIndex}: ${stepLabel(step)}  (${elapsed}ms)`)
    }
  }

  onStepFail(step: StepDefinition, error: Error, diagnostics?: DiagnosticContext): void {
    this.stepIndex++
    console.log(`│    ✗ step ${this.stepIndex} failed: ${stepLabel(step)}`)
    console.log(`│      ${error.message}`)
    if (diagnostics) {
      console.log('│    ┌─── Screen ───────────────────────────────┐')
      for (const line of diagnostics.screen.split('\n').slice(-10)) {
        console.log(`│    │ ${line}`)
      }
      console.log('│    └────────────────────────────────────────���─┘')
      console.log('│    ┌─── Timeline (last 10) ────────────────────┐')
      const timelineLines = diagnostics.timeline.split('\n')
      for (const line of timelineLines.slice(-10)) {
        console.log(`│    │ ${line}`)
      }
      console.log('│    └──────────────────────────────────────────┘')
    }
  }

  onScenarioEnd(name: string, passed: boolean, elapsed: number): void {
    const icon = passed ? '✓' : '✗'
    const time = `(${(elapsed / 1000).toFixed(1)}s)`
    console.log(`│  ${icon} ${name}  ${time}`)
  }

  onSuiteEnd(passed: number, failed: number, total: number): void {
    console.log('│')
    console.log(`│  Result: ${passed}/${total} passed`)
    if (failed > 0) {
      console.log(`│  ${failed} failed`)
    }
    console.log('└────────────────────────────────────────────────────────┘\n')
  }
}
