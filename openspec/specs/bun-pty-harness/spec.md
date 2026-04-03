## ADDED Requirements

### Requirement: TestTerminal uses Bun.spawn terminal for PTY
TestTerminal SHALL spawn the soulkiller CLI via `Bun.spawn()` with `terminal` option to create a pseudo-terminal. SHALL NOT depend on node-pty or any external native module.

#### Scenario: Spawn with Bun terminal API
- **WHEN** TestTerminal is created with homeDir and optional mockServerUrl
- **THEN** Bun.spawn is called with `terminal: { columns, rows }` and env vars (HOME, TERM, COLORTERM, SOULKILLER_SEED, SOULKILLER_API_URL)

#### Scenario: No IPC middle layer
- **WHEN** TestTerminal is initialized
- **THEN** no child process fork or IPC channel is created; TestTerminal directly holds the Bun subprocess and its terminal object

### Requirement: Terminal data flows directly without IPC
TestTerminal SHALL read PTY output directly from the Bun subprocess stdout (via terminal readable stream) and write input via `terminal.write()`. No IPC protocol (process.send/process.on) SHALL be used.

#### Scenario: Read output from terminal
- **WHEN** the soulkiller CLI renders text to the PTY
- **THEN** TestTerminal receives the data via the subprocess readable stream and appends to rawBuffer

#### Scenario: Write input to terminal
- **WHEN** send() or sendKey() is called
- **THEN** data is written directly to the terminal via terminal.write()

### Requirement: CI environment variables are sanitized
TestTerminal SHALL remove CI-related env vars (CI, GITHUB_ACTIONS) from the spawned process environment to prevent ink v6 from suppressing dynamic rendering.

#### Scenario: CI=true does not affect PTY rendering
- **WHEN** E2E tests run in GitHub Actions (CI=true in host)
- **THEN** the spawned soulkiller process does NOT see CI=true and renders normally
