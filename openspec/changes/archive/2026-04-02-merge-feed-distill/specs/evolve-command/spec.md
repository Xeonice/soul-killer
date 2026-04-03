## ADDED Requirements

### Requirement: Evolve command merges feed and distill
The system SHALL provide an `/evolve <soul>` command that performs data ingestion followed by automatic distillation for the specified soul.

#### Scenario: User runs evolve with valid soul
- **WHEN** user submits `/evolve mysoul` where "mysoul" exists in local souls
- **THEN** the system enters interactive mode and begins the evolve flow (path selection → feed → distill)

#### Scenario: User runs evolve with no argument
- **WHEN** user submits `/evolve` without a soul name argument
- **THEN** the system displays a warning error "MISSING ARGUMENT" and remains in idle state

### Requirement: Invalid soul name shows error and returns to initial state
When the user provides a soul name that does not exist in the local soul list, the system SHALL display an error and return to the `/` command input state.

#### Scenario: Non-existent soul name
- **WHEN** user submits `/evolve nonexistent` where "nonexistent" is not in `listLocalSouls()`
- **THEN** the system displays a warning error with title "SOUL NOT FOUND" and a message indicating the soul does not exist
- **AND** the system remains in idle state (not interactiveMode), user sees the `/` command prompt

#### Scenario: Error includes suggestion to use /list
- **WHEN** a "SOUL NOT FOUND" error is displayed
- **THEN** the error suggestions include a hint to run `/list` to see available souls

### Requirement: Evolve flow phase 1 — data source selection and feed
After entering evolve interactive mode, the system SHALL prompt the user to select a data source path and ingest data.

#### Scenario: Path input with completion
- **WHEN** evolve interactive mode begins
- **THEN** the system shows a path input prompt with filesystem path completion enabled

#### Scenario: Feed executes on path submission
- **WHEN** user submits a valid file/directory path in the evolve path prompt
- **THEN** the system runs the ingest pipeline against the specified path for the target soul

### Requirement: Evolve flow phase 2 — automatic distill after feed
After feed completes successfully, the system SHALL automatically proceed to distillation without requiring user confirmation.

#### Scenario: Auto-distill after feed
- **WHEN** the feed (ingest) phase completes successfully
- **THEN** the distill phase begins automatically, showing distillation progress

#### Scenario: Return to idle after distill completes
- **WHEN** the distill phase completes
- **THEN** interactive mode ends and the user returns to the idle `/` command prompt

### Requirement: Escape exits evolve at any phase
The user SHALL be able to exit evolve interactive mode by pressing Escape at any phase.

#### Scenario: Escape during path selection
- **WHEN** user presses Escape during the path input phase
- **THEN** interactive mode ends and user returns to idle state

#### Scenario: Escape during feed or distill
- **WHEN** user presses Escape during feed or distill execution
- **THEN** the current operation is cancelled, interactive mode ends, and user returns to idle state

## REMOVED Requirements

### Requirement: Feed command
**Reason**: Replaced by `/evolve` command which combines feed + distill
**Migration**: Use `/evolve <soul>` instead of `/feed <path>`

### Requirement: Distill command
**Reason**: Replaced by `/evolve` command which combines feed + distill
**Migration**: Use `/evolve <soul>` instead of `/distill`
