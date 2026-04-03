## MODIFIED Requirements

### Requirement: Completion triggers on slash input
When the user types `/` as the first character, the system SHALL display a command candidate list immediately.

#### Scenario: User types slash
- **WHEN** user types `/` in an empty input field
- **THEN** a candidate list appears showing all available commands with descriptions, including `/evolve` but NOT `/feed` or `/distill`

## REMOVED Requirements

### Requirement: Feed command in completion list
**Reason**: `/feed` is replaced by `/evolve`
**Migration**: `/evolve <soul>` replaces `/feed <path>`

### Requirement: Distill command in completion list
**Reason**: `/distill` is replaced by `/evolve`
**Migration**: `/evolve <soul>` replaces `/distill`
