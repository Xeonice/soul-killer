## ADDED Requirements

### Requirement: Name conflict check after confirmation

After the user confirms the intake summary, the system SHALL check for an existing soul with the same name before proceeding to the next step.

#### Scenario: Conflict detected triggers name-conflict step

- **WHEN** the user confirms intake summary
- **AND** a soul directory exists at `~/.soulkiller/souls/<name>/`
- **THEN** the system SHALL transition to the `name-conflict` step instead of proceeding to capturing or data-sources

#### Scenario: No conflict proceeds normally

- **WHEN** the user confirms intake summary
- **AND** no soul directory exists for the given name
- **THEN** the system SHALL proceed normally (public → capturing, personal → data-sources)
