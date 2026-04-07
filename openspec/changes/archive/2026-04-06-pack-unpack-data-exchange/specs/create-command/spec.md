## MODIFIED Requirements

### Requirement: Command registry entries
The command registry SHALL include entries for all available commands including `pack` and `unpack`.

#### Scenario: Pack command registered
- **WHEN** the command registry is loaded
- **THEN** it contains a `pack` command with description and group

#### Scenario: Unpack command registered
- **WHEN** the command registry is loaded
- **THEN** it contains an `unpack` command with description and group
