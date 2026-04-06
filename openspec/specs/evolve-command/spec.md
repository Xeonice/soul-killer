# Evolve Command

### Requirement: /evolve 命令路由
`/evolve` 不带子命令时 SHALL 渲染 `CreateCommand(supplementSoul={name, dir})`，进入 Soul 补充模式。`/evolve status` 和 `/evolve rollback` 子命令 SHALL 保持不变。

#### Scenario: /evolve 进入补充模式
- **WHEN** 用户执行 `/evolve`（已加载 Soul）
- **THEN** 渲染 CreateCommand 补充模式，显示数据源选择

#### Scenario: /evolve status 保持不变
- **WHEN** 用户执行 `/evolve status`
- **THEN** 渲染 EvolveStatusCommand（行为不变）

#### Scenario: User runs evolve with soul name argument
- **WHEN** user submits `/evolve mysoul` where "mysoul" exists but is not currently loaded
- **THEN** the system SHALL load that soul and enter the evolve interactive flow

#### Scenario: User runs evolve with no argument and no soul loaded
- **WHEN** user submits `/evolve` without a soul name and no soul is currently loaded
- **THEN** the system SHALL display a warning "请先使用 /use 加载一个分身，或指定分身名称：/evolve <name>"

#### Scenario: Evolve status subcommand
- **WHEN** user submits `/evolve status`
- **THEN** the system SHALL display the soul's data composition and evolve history (delegated to evolve-audit)

#### Scenario: Evolve rollback subcommand
- **WHEN** user submits `/evolve rollback`
- **THEN** the system SHALL enter the snapshot rollback flow (delegated to soul-snapshot)

### Requirement: Invalid soul name shows error and returns to initial state
When the user provides a soul name that does not exist in the local soul list, the system SHALL display an error and return to the `/` command input state.

#### Scenario: Non-existent soul name
- **WHEN** user submits `/evolve nonexistent` where "nonexistent" is not in `listLocalSouls()`
- **THEN** the system displays a warning error with title "SOUL NOT FOUND" and a message indicating the soul does not exist
- **AND** the system remains in idle state (not interactiveMode), user sees the `/` command prompt

#### Scenario: Error includes suggestion to use /list
- **WHEN** a "SOUL NOT FOUND" error is displayed
- **THEN** the error suggestions include a hint to run `/list` to see available souls

### Requirement: Dimension selection controls update scope
After data ingestion, the evolve flow SHALL prompt the user to select which soul dimensions to update.

#### Scenario: User selects specific dimensions
- **WHEN** user selects "identity" and "style" only
- **THEN** the system SHALL only extract and merge identity and style features
- **AND** behavior files remain untouched

#### Scenario: User selects all dimensions
- **WHEN** user selects "all"
- **THEN** the system SHALL extract and merge all three dimensions (identity, style, behaviors)

#### Scenario: Default dimension is all
- **WHEN** user presses Enter without selecting specific dimensions
- **THEN** the system SHALL default to updating all dimensions

### Requirement: Escape exits evolve at any phase
The user SHALL be able to exit evolve interactive mode by pressing Escape at any phase.

#### Scenario: Escape during source selection
- **WHEN** user presses Escape during the source type selection
- **THEN** interactive mode ends and user returns to idle state

#### Scenario: Escape during data input
- **WHEN** user presses Escape during source-specific data input
- **THEN** interactive mode ends and user returns to idle state

#### Scenario: Escape during distillation
- **WHEN** user presses Escape during distillation
- **THEN** the current operation is cancelled, snapshot is preserved, user returns to idle
- **AND** partially ingested chunks are preserved in chunks.json
