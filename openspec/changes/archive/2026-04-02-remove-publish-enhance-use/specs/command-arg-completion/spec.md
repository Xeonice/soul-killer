## MODIFIED Requirements

### Requirement: Command argument completion
When the user types a command that supports argument completion followed by a space, the system SHALL show argument candidates.

#### Scenario: /use shows soul list
- **WHEN** user types `/use ` (with trailing space)
- **THEN** a completion list appears showing all locally available souls

#### Scenario: /use with non-existent soul name returns error
- **WHEN** user submits `/use nonexistent` where "nonexistent" is not in `listLocalSouls()`
- **THEN** the system displays a warning error with title "SOUL NOT FOUND" and suggestions including `/list`
- **AND** the system remains in idle state, user sees the `/` command prompt
