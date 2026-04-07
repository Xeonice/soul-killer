## ADDED Requirements

### Requirement: Pack soul command
The system SHALL provide a `/pack soul <name>` command that packages a soul and all its bound worlds into a single `.soul.pack` file.

#### Scenario: Pack an existing soul
- **WHEN** user runs `/pack soul alice`
- **THEN** the system creates `alice.soul.pack` in the current working directory containing the soul data, bindings, and all bound world data

#### Scenario: Pack soul with custom output path
- **WHEN** user runs `/pack soul alice --output /tmp/`
- **THEN** the system creates `/tmp/alice.soul.pack`

#### Scenario: Pack soul with snapshots
- **WHEN** user runs `/pack soul alice --with-snapshots`
- **THEN** the pack file includes the `snapshots/` directory

#### Scenario: Pack soul without snapshots by default
- **WHEN** user runs `/pack soul alice` (no --with-snapshots flag)
- **THEN** the pack file does NOT include the `snapshots/` directory

#### Scenario: Pack nonexistent soul
- **WHEN** user runs `/pack soul nonexistent`
- **THEN** the system displays an error message indicating the soul does not exist

### Requirement: Pack world command
The system SHALL provide a `/pack world <name>` command that packages a world into a single `.world.pack` file.

#### Scenario: Pack an existing world
- **WHEN** user runs `/pack world night-city`
- **THEN** the system creates `night-city.world.pack` in the current working directory containing only the world data

#### Scenario: Pack nonexistent world
- **WHEN** user runs `/pack world nonexistent`
- **THEN** the system displays an error message indicating the world does not exist

### Requirement: Pack command argument completion
The `/pack` command SHALL provide argument completion for sub-commands (`soul`, `world`) and for soul/world names.

#### Scenario: Complete sub-command
- **WHEN** user types `/pack ` and triggers completion
- **THEN** the system suggests `soul` and `world`

#### Scenario: Complete soul name
- **WHEN** user types `/pack soul ` and triggers completion
- **THEN** the system lists available soul names

#### Scenario: Complete world name
- **WHEN** user types `/pack world ` and triggers completion
- **THEN** the system lists available world names

### Requirement: Pack output feedback
The system SHALL display progress feedback during packing including which items are being packed and the final output path.

#### Scenario: Successful pack output
- **WHEN** a pack operation completes successfully
- **THEN** the system displays the output file path and file size
