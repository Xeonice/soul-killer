## ADDED Requirements

### Requirement: Unpack soul pack
The system SHALL provide a `/unpack <path>` command that restores a `.soul.pack` file to local storage, including the soul and all bundled worlds.

#### Scenario: Unpack soul pack with no conflicts
- **WHEN** user runs `/unpack alice.soul.pack` and no local soul/world name conflicts exist
- **THEN** the soul is written to `~/.soulkiller/souls/alice/` and all bundled worlds are written to `~/.soulkiller/worlds/<name>/`

#### Scenario: Unpack soul pack with soul name conflict
- **WHEN** user runs `/unpack alice.soul.pack` and a local soul named "alice" already exists
- **THEN** the system prompts with three options: overwrite, rename (suggesting `alice-2`), or skip

#### Scenario: Unpack soul pack with world name conflict
- **WHEN** user runs `/unpack alice.soul.pack` and a bundled world name conflicts with a local world
- **THEN** the system prompts with three options per conflicting world: overwrite, rename, or skip

#### Scenario: Rename world updates bindings
- **WHEN** user chooses to rename a conflicting world from `night-city` to `night-city-2` during unpack
- **THEN** the soul's binding file is updated to reference `night-city-2` instead of `night-city`, and the binding filename is renamed accordingly

### Requirement: Unpack world pack
The system SHALL restore a `.world.pack` file to local world storage.

#### Scenario: Unpack world pack with no conflict
- **WHEN** user runs `/unpack night-city.world.pack` and no local world named "night-city" exists
- **THEN** the world is written to `~/.soulkiller/worlds/night-city/`

#### Scenario: Unpack world pack with conflict
- **WHEN** user runs `/unpack night-city.world.pack` and a local world named "night-city" exists
- **THEN** the system prompts with three options: overwrite, rename, or skip

### Requirement: Unpack path completion
The `/unpack` command SHALL provide filesystem path completion for `.soul.pack` and `.world.pack` files.

#### Scenario: Path completion filters pack files
- **WHEN** user types `/unpack ./` and triggers completion
- **THEN** the system shows only `.soul.pack` and `.world.pack` files and directories

### Requirement: Unpack validates pack integrity
The system SHALL verify the pack checksum before unpacking.

#### Scenario: Valid checksum
- **WHEN** user unpacks a file with matching SHA-256 checksum
- **THEN** unpacking proceeds normally

#### Scenario: Invalid checksum
- **WHEN** user unpacks a file with mismatched checksum
- **THEN** the system displays a warning and asks for confirmation before proceeding

#### Scenario: Unsupported format version
- **WHEN** user unpacks a file with a `format_version` higher than supported
- **THEN** the system displays an error and aborts

### Requirement: Unpack progress feedback
The system SHALL display which items are being unpacked and their conflict resolution results.

#### Scenario: Unpack summary
- **WHEN** an unpack operation completes
- **THEN** the system displays a summary: items installed, items skipped, items renamed
