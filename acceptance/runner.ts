import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TestTerminal } from '../tests/e2e/harness/test-terminal.js'
import { MockLLMServer } from '../tests/e2e/harness/mock-llm-server.js'
import { createTestHome, type TestHome } from '../tests/e2e/fixtures/test-home.js'
import { parseSpecFile } from './parser.js'
import { getExecutor } from './executors.js'
import { applyFixture } from './fixtures.js'
import type {
  AcceptanceScenario,
  Reporter,
  SuiteResult,
  ScenarioResult,
  ExecutionContext,
  StepResult,
  DiagnosticContext,
} from './types.js'

export class AcceptanceRunner {
  private reporter: Reporter

  constructor(reporter: Reporter) {
    this.reporter = reporter
  }

  async runSpecFile(specPath: string): Promise<SuiteResult> {
    const scenarios = parseSpecFile(specPath)
    this.reporter.onSuiteStart(specPath, scenarios.length)

    const results: ScenarioResult[] = []
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario)
      results.push(result)
    }

    const passed = results.filter((r) => r.passed).length
    const failed = results.filter((r) => !r.passed).length
    this.reporter.onSuiteEnd(passed, failed, results.length)

    return {
      specFile: specPath,
      scenarios: results,
      passed,
      failed,
      total: results.length,
    }
  }

  async runScenario(scenario: AcceptanceScenario): Promise<ScenarioResult> {
    const start = Date.now()
    this.reporter.onScenarioStart(scenario.name)

    let home: TestHome | null = null
    let mockServer: MockLLMServer | null = null
    let terminal: TestTerminal | null = null
    const stepResults: StepResult[] = []
    let failedStep: ScenarioResult['failedStep'] = undefined

    try {
      // 1. Create isolated environment
      const mockLlmConfig = scenario.environment.mockLlm
      const needsMock = mockLlmConfig != null && mockLlmConfig !== false

      if (needsMock) {
        const responseText = typeof mockLlmConfig === 'object' && mockLlmConfig.response
          ? mockLlmConfig.response
          : undefined
        mockServer = new MockLLMServer(responseText ? { responseText } : undefined)
        await mockServer.start()
      }

      home = createTestHome(mockServer ? { mockServerUrl: mockServer.url } : undefined)

      // 1b. If real-config requested, overwrite the test config with user's real config
      if (scenario.environment.realConfig) {
        const userConfig = path.join(os.homedir(), '.soulkiller', 'config.yaml')
        if (fs.existsSync(userConfig)) {
          fs.copyFileSync(userConfig, home.configPath)
        }
      }

      // 2. Apply fixture
      applyFixture(home.homeDir, scenario.environment)

      // 3. Create terminal
      terminal = new TestTerminal({
        homeDir: home.homeDir,
        mockServerUrl: mockServer?.url,
        label: scenario.name,
      })

      // 4. Execute steps
      const ctx: ExecutionContext = {
        terminal,
        mockServer,
        homeDir: home.homeDir,
        globalTimeout: scenario.environment.timeout,
      }

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i]!
        const executor = getExecutor(step.type)
        if (!executor) {
          const error = `Unknown step type: "${step.type}"`
          const result: StepResult = { passed: false, elapsed: 0, error }
          stepResults.push(result)
          failedStep = { index: i, step, error }
          this.reporter.onStepFail(step, new Error(error))
          break
        }

        const result = await executor(step, ctx)
        stepResults.push(result)

        if (result.passed) {
          this.reporter.onStepPass(step, result.elapsed)
        } else {
          failedStep = {
            index: i,
            step,
            error: result.error ?? 'Step failed',
            diagnostics: result.diagnostics,
          }
          this.reporter.onStepFail(step, new Error(result.error ?? 'Step failed'), result.diagnostics)
          break
        }
      }
    } catch (err) {
      const error = (err as Error).message
      failedStep = failedStep ?? { index: stepResults.length, step: scenario.steps[stepResults.length]!, error }
    } finally {
      // 5. Cleanup
      terminal?.kill()
      if (mockServer) await mockServer.stop()
      home?.cleanup()
    }

    const passed = !failedStep
    const elapsed = Date.now() - start
    this.reporter.onScenarioEnd(scenario.name, passed, elapsed)

    return {
      name: scenario.name,
      specFile: scenario.specFile,
      passed,
      elapsed,
      stepResults,
      failedStep,
    }
  }
}
