## MODIFIED Requirements

### Requirement: Completion triggers on slash input
When the user types `/` as the first character, the system SHALL display a command candidate list immediately.

#### Scenario: User types slash
- **WHEN** user types `/` in an empty input field
- **THEN** a candidate list appears showing all available commands with descriptions, NOT including `/publish` or `/link`

## REMOVED Requirements

### Requirement: Publish command in completion list
**Reason**: `/publish` command has been removed
**Migration**: No replacement — feature removed

### Requirement: Link command in completion list
**Reason**: `/link` command has been removed
**Migration**: No replacement — feature removed
