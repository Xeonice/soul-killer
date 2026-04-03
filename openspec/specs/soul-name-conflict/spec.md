# Soul Name Conflict

### Requirement: Detect existing soul on name confirmation

After the user confirms intake information, the system SHALL check if `~/.soulkiller/souls/<name>/` exists before proceeding to search or data source steps.

#### Scenario: No existing soul

- **WHEN** the user confirms intake and no soul directory exists for the given name
- **THEN** the system SHALL proceed directly to the next step (capturing or data-sources)

#### Scenario: Existing soul detected

- **WHEN** the user confirms intake and a soul directory exists for the given name
- **THEN** the system SHALL display the existing soul's metadata (type, fragment count, creation date)
- **THEN** the system SHALL present three options: overwrite, append, rename

### Requirement: Conflict resolution options

When an existing soul is detected, the system SHALL offer three resolution strategies.

#### Scenario: User chooses overwrite

- **WHEN** the user selects "覆盖重建"
- **THEN** the system SHALL delete the existing soul directory
- **THEN** the system SHALL proceed with normal creation flow

#### Scenario: User chooses append

- **WHEN** the user selects "追加数据"
- **THEN** the system SHALL read existing chunks from the soul's engine storage
- **THEN** the system SHALL merge existing chunks with newly collected chunks before distillation
- **THEN** distillation output SHALL overwrite the soul files in the existing directory

#### Scenario: User chooses rename

- **WHEN** the user selects "换个名字"
- **THEN** the system SHALL return to the name input step

#### Scenario: Existing soul has no readable chunks

- **WHEN** the user selects "追加数据" but existing chunks cannot be read
- **THEN** the system SHALL warn the user that no existing data was found
- **THEN** the system SHALL fall back to overwrite behavior

### Requirement: Display existing soul info

The conflict step SHALL display key metadata about the existing soul.

#### Scenario: Full metadata available

- **WHEN** the existing soul has a valid manifest.json
- **THEN** the system SHALL display: soul type, fragment count, creation date

#### Scenario: Manifest missing or corrupt

- **WHEN** the existing soul directory exists but manifest.json is missing or unreadable
- **THEN** the system SHALL display the directory path and note "元数据不可用"
