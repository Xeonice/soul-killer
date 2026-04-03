## MODIFIED Requirements

### Requirement: TestTerminal spawns isolated PTY process
TestTerminal SHALL spawn a soulkiller process via Bun.spawn with terminal option, with环境变量隔离 (HOME, SOULKILLER_SEED, SOULKILLER_API_URL)。进程退出后 SHALL 可通过 `.exitCode` 获取退出码。

#### Scenario: Spawn with isolated HOME
- **WHEN** TestTerminal is created with a homeDir
- **THEN** the spawned process uses homeDir as HOME, SOULKILLER_SEED=42, and optionally SOULKILLER_API_URL

#### Scenario: Process exit code
- **WHEN** soulkiller exits normally via /exit
- **THEN** TestTerminal.exitCode SHALL be 0

### Requirement: Cleanup on kill
`TestTerminal.kill()` SHALL terminate the Bun subprocess and clean up resources.

#### Scenario: Kill running process
- **WHEN** kill() is called while soulkiller is running
- **THEN** the subprocess is terminated via subprocess.kill() and no resource leaks occur
