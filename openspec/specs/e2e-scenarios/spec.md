## ADDED Requirements

### Requirement: Scenario 1 — Cold boot to idle
验证 soulkiller 启动（animation: false）后进入 idle 状态。

#### Scenario: Boot with existing config
- **WHEN** soulkiller starts with valid config (animation: false)
- **THEN** process reaches idle prompt within timeout

#### Scenario: Boot exits cleanly
- **WHEN** user sends /exit after reaching idle
- **THEN** process exits with code 0

### Requirement: Scenario 2 — Complete /create flow
验证 /create wizard 的完整多步流程。

#### Scenario: Create soul through wizard
- **WHEN** user sends /create, selects type, enters name, description, tags, and confirms
- **THEN** soul directory is created with correct structure (manifest.json, soul/identity.md exist)
- **AND** prompt switches to loaded mode showing the soul name

### Requirement: Scenario 3 — Graceful exit
验证 /exit 命令触发退出流程。

#### Scenario: Exit from idle
- **WHEN** user sends /exit from idle prompt
- **THEN** process exits with code 0

### Requirement: Scenario 4 — Soul management
验证多 soul 创建、列表、切换。

#### Scenario: List multiple souls
- **WHEN** two distilled souls exist (fixture) and user sends /list
- **THEN** output contains both soul names

#### Scenario: Switch between souls
- **WHEN** user sends /use alice then /use bob
- **THEN** prompt reflects the currently loaded soul name each time

### Requirement: Scenario 5 — Evolve then recall
验证数据喂入和知识检索的完整管线。

#### Scenario: Ingest markdown and recall
- **WHEN** a distilled soul is loaded, /evolve ingests markdown fixture data, then /recall queries a keyword
- **THEN** /recall returns non-empty results related to the fixture content

### Requirement: Scenario 6 — Conversation flow with mock LLM
验证对话流的流式输出和上下文延续。

#### Scenario: First message gets streamed response
- **WHEN** a distilled soul is loaded (with mock LLM), user sends natural language input
- **THEN** mock response text appears in output and prompt returns

#### Scenario: Context accumulates across turns
- **WHEN** user sends a second message after first round
- **THEN** mock server's second request contains messages from first round (system + user1 + assistant1 + user2)

### Requirement: Scenario 7 — Error paths
验证错误情况的正确反馈。

#### Scenario: Use nonexistent soul
- **WHEN** user sends /use nonexistent
- **THEN** output contains 'SOUL NOT FOUND' error

#### Scenario: Recall without argument
- **WHEN** user sends /recall (no args)
- **THEN** output contains 'MISSING ARGUMENT' error

#### Scenario: Unknown command
- **WHEN** user sends /xyzzy
- **THEN** output contains 'UNKNOWN COMMAND'

#### Scenario: Natural language without soul loaded
- **WHEN** user sends natural language text without loading a soul
- **THEN** output contains 'NO SOUL LOADED' error

### Requirement: Scenario 8 — Tab completion
验证命令补全功能。

#### Scenario: Command completion
- **WHEN** user types "/cr" then presses Tab
- **THEN** input is completed to "/create"

### Requirement: Scenario 9 — Evolve subcommands
验证 /evolve status 和 /evolve rollback。

#### Scenario: Evolve status shows history
- **WHEN** an evolved soul (fixture with evolve_history) is loaded and user sends /evolve status
- **THEN** output displays ingest history information

#### Scenario: Evolve rollback
- **WHEN** an evolved soul is loaded and user sends /evolve rollback and confirms
- **THEN** rollback completes and returns to prompt
