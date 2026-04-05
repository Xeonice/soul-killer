## MODIFIED Requirements

### Requirement: Agent loop event processing
The `captureSoul` function SHALL create an `AgentLogger` instance at the start of execution and integrate it with the `fullStream` event loop. It SHALL return the logger instance via `CaptureResult.agentLog` without closing it, so the caller can extend the log with distillation data.

#### Scenario: Full logging integration
- **WHEN** `captureSoul` is called and completes a 12-step agent loop
- **THEN** an `AgentLogger` is created at the start, all 12 steps are logged with their events, and `writeResult()` + `writeAnalysis()` are called before the function returns

#### Scenario: AgentLogger returned in CaptureResult
- **WHEN** `captureSoul` returns a result
- **THEN** `CaptureResult.agentLog` contains the open `AgentLogger` instance (not closed)

#### Scenario: AgentLogger passed to tools
- **WHEN** `createAgentTools` is called
- **THEN** the `AgentLogger` instance is passed via the options parameter

#### Scenario: text-delta events captured
- **WHEN** the model emits `text-delta` events during a step
- **THEN** `agentLog.modelOutput(text)` is called for each delta
