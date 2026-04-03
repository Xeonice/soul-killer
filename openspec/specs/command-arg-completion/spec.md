## ADDED Requirements

### Requirement: Command argument completion
When the user types a command that supports argument completion followed by a space, the system SHALL show argument candidates.

#### Scenario: /use shows soul list
- **WHEN** user types `/use ` (with trailing space)
- **THEN** a completion list appears showing all locally available souls

#### Scenario: /evolve shows soul list
- **WHEN** user types `/evolve ` (with trailing space)
- **THEN** a completion list appears showing all locally available souls

#### Scenario: Argument prefix filtering
- **WHEN** user types `/use 强`
- **THEN** the list filters to souls whose name starts with "强"

#### Scenario: Argument prefix filtering for evolve
- **WHEN** user types `/evolve 强`
- **THEN** the list filters to souls whose name starts with "强"

#### Scenario: Tab confirms argument
- **WHEN** user presses Tab with a soul selected in the argument list
- **THEN** the input is filled with `/<command> <soul-name>` and the list closes

#### Scenario: Enter confirms and submits
- **WHEN** user presses Enter with a soul selected
- **THEN** the command `/<command> <soul-name>` is submitted

#### Scenario: /use with non-existent soul name returns error
- **WHEN** user submits `/use nonexistent` where "nonexistent" is not in `listLocalSouls()`
- **THEN** the system displays a warning error with title "SOUL NOT FOUND" and suggestions including `/list`
- **AND** the system remains in idle state, user sees the `/` command prompt

### Requirement: Completion list shows context-appropriate title
The completion palette SHALL display a title matching the completion context.

#### Scenario: Soul completion title
- **WHEN** argument completion is active for /use or /evolve
- **THEN** the palette title is "SOULS" instead of "COMMANDS"
