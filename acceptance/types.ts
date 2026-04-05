import type { TestTerminal } from '../tests/e2e/harness/test-terminal.js'
import type { MockLLMServer } from '../tests/e2e/harness/mock-llm-server.js'

// ── Parsed from spec.md ──

export interface AcceptanceScenario {
  name: string
  specFile: string
  line: number
  environment: EnvironmentDeclaration
  steps: StepDefinition[]
}

export interface EnvironmentDeclaration {
  fixture: 'void' | 'bare-soul' | 'distilled-soul' | 'evolved-soul'
  soulName: string
  persona?: {
    identity?: string
    style?: string
    behaviors?: Array<{ name: string; content: string }>
  }
  mockLlm?: {
    response?: string
  } | boolean
  realConfig: boolean // copy user's real ~/.soulkiller/config.yaml (API keys, model, etc.)
  env?: Record<string, string>
  timeout: number // milliseconds
}

export interface StepDefinition {
  type: string
  value?: string | number | Record<string, unknown>
  timeout?: number // step-level override in ms
  raw: Record<string, unknown> // original YAML object
}

// ── Execution ──

export interface ExecutionContext {
  terminal: TestTerminal
  mockServer: MockLLMServer | null
  homeDir: string
  globalTimeout: number
}

export interface StepResult {
  passed: boolean
  elapsed: number
  error?: string
  diagnostics?: DiagnosticContext
}

export interface DiagnosticContext {
  screen: string
  timeline: string
  bufferTail: string
}

export type StepExecutor = (
  step: StepDefinition,
  ctx: ExecutionContext,
) => Promise<StepResult>

// ── Reporting ──

export interface ScenarioResult {
  name: string
  specFile: string
  passed: boolean
  elapsed: number
  stepResults: StepResult[]
  failedStep?: {
    index: number
    step: StepDefinition
    error: string
    diagnostics?: DiagnosticContext
  }
}

export interface SuiteResult {
  specFile: string
  scenarios: ScenarioResult[]
  passed: number
  failed: number
  total: number
}

export interface Reporter {
  onSuiteStart(specPath: string, scenarioCount: number): void
  onScenarioStart(name: string): void
  onStepPass(step: StepDefinition, elapsed: number): void
  onStepFail(step: StepDefinition, error: Error, diagnostics?: DiagnosticContext): void
  onScenarioEnd(name: string, passed: boolean, elapsed: number): void
  onSuiteEnd(passed: number, failed: number, total: number): void
}

// ── Fixture ──

export type FixtureFactory = (
  homeDir: string,
  opts: { soulName: string; persona?: EnvironmentDeclaration['persona'] },
) => void
