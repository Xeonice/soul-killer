## ADDED Requirements

### Requirement: TestTerminal spawns isolated PTY process
TestTerminal SHALL spawn a soulkiller process via node-pty, with环境变量隔离 (HOME, SOULKILLER_SEED, SOULKILLER_API_URL)。进程退出后 SHALL 可通过 `.exitCode` 获取退出码。

#### Scenario: Spawn with isolated HOME
- **WHEN** TestTerminal is created with a homeDir
- **THEN** the spawned process uses homeDir as HOME, SOULKILLER_SEED=42, and optionally SOULKILLER_API_URL

#### Scenario: Process exit code
- **WHEN** soulkiller exits normally via /exit
- **THEN** TestTerminal.exitCode SHALL be 0

### Requirement: waitFor matches pattern in stdout
`waitFor(pattern, opts?)` SHALL accumulate PTY stdout, strip ANSI escape sequences (when strip: true, default), and resolve when pattern matches. SHALL reject with WaitForTimeout after timeout (default 10000ms).

#### Scenario: Match regex pattern
- **WHEN** waitFor is called with /SOULKILLER/ and PTY outputs boot text containing "SOULKILLER"
- **THEN** waitFor resolves with matched text, fullBuffer, and elapsed time

#### Scenario: Timeout with debug info
- **WHEN** waitFor is called with /nonexistent/ and timeout expires
- **THEN** waitFor rejects with WaitForTimeout containing the pattern, elapsed time, and tail of the buffer

#### Scenario: ANSI stripping
- **WHEN** PTY outputs "\x1b[36mSOULKILLER\x1b[0m" and waitFor matches /SOULKILLER/
- **THEN** waitFor matches successfully against stripped text "SOULKILLER"

### Requirement: waitFor supports incremental matching via since option
`waitFor(pattern, { since: 'last' })` SHALL only match against text received after the last successful waitFor call. Internal cursor tracks the position.

#### Scenario: Incremental matching avoids history
- **WHEN** first waitFor matches /alice/ in boot output, then /use alice is sent, then waitFor(/alice/, { since: 'last' }) is called
- **THEN** second waitFor matches only against new output after the first match, not the entire buffer

### Requirement: Semantic helpers for common patterns
TestTerminal SHALL provide `waitForPrompt()`, `waitForError(title?)`, and `waitForStreamEnd()` as convenience methods.

#### Scenario: waitForPrompt matches idle prompt
- **WHEN** waitForPrompt is called and soulkiller reaches idle state
- **THEN** it resolves when any prompt variant (▶, », >, [name]>) appears

#### Scenario: waitForError matches error output
- **WHEN** waitForError('SOUL NOT FOUND') is called and an error is rendered
- **THEN** it resolves when the error title appears in stdout

### Requirement: Key sending utilities
TestTerminal SHALL provide `send(input)` (appends \r), `sendKey(key)` (raw key codes for tab/escape/arrows/enter/backspace), `sendAndWait(input, pattern)`, and `sendCommand(cmd)` (sends + waits for prompt return).

#### Scenario: sendCommand waits for prompt
- **WHEN** sendCommand('/help') is called
- **THEN** '/help\r' is written to PTY stdin, and the returned promise resolves when the prompt reappears

#### Scenario: sendKey sends raw key codes
- **WHEN** sendKey('tab') is called
- **THEN** '\t' is written to PTY stdin

### Requirement: Cleanup on kill
`TestTerminal.kill()` SHALL terminate the PTY process and clean up resources.

#### Scenario: Kill running process
- **WHEN** kill() is called while soulkiller is running
- **THEN** the PTY process is terminated and no resource leaks occur
