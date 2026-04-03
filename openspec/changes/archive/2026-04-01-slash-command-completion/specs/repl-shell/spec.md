## MODIFIED Requirements

### Requirement: Command parsing uses shared registry
The command parser and help command SHALL consume command definitions from a single shared registry instead of maintaining separate lists.

#### Scenario: Registry is single source of truth
- **WHEN** a new command is added to the command registry
- **THEN** it appears in help output, completion candidates, and command parser recognition without additional changes

#### Scenario: Help output matches registry
- **WHEN** user runs /help
- **THEN** all commands from the registry are displayed grouped by their registered group
