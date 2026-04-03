# Soul Type System

### Requirement: Soul type selection

The system SHALL present a type selection step as the first step of the `/create` command, offering exactly two options: "个人灵魂" (personal) and "公开灵魂" (public).

#### Scenario: User selects personal soul type

- **WHEN** the user selects "个人灵魂"
- **THEN** the system SHALL set `soulType` to `personal`
- **THEN** the system SHALL skip the Agent online search step entirely

#### Scenario: User selects public soul type

- **WHEN** the user selects "公开灵魂"
- **THEN** the system SHALL set `soulType` to `public`
- **THEN** the system SHALL proceed to Agent online search after intake questions

### Requirement: Soul type persisted in manifest

The system SHALL persist the selected soul type in `manifest.json` as a `soulType` field with value `personal` or `public`.

#### Scenario: Manifest includes soul type

- **WHEN** a soul package is created
- **THEN** `manifest.json` SHALL contain a `soulType` field set to the user's selection

### Requirement: Soul type determines data source availability

The system SHALL conditionally show data source options based on soul type.

#### Scenario: Personal soul data sources

- **WHEN** `soulType` is `personal`
- **THEN** available data sources SHALL include: Markdown documents, Twitter archive, paste content
- **THEN** "在线搜索" SHALL NOT appear as an option

#### Scenario: Public soul data sources

- **WHEN** `soulType` is `public`
- **THEN** "在线搜索" SHALL be enabled by default (via Agent capture)
- **THEN** additional optional sources SHALL include: Markdown documents, Twitter archive, paste content
