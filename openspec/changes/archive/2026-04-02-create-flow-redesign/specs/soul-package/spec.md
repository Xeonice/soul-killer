## MODIFIED Requirements

### Requirement: Manifest Schema

The `manifest.json` file MUST contain the following fields: `name` (package identifier), `display_name` (human-readable name), `version` (semver string), `created_at` (ISO 8601 timestamp), `languages` (array of language codes), `description` (brief description), `chunk_count` (number of chunks in vector store), `embedding_model` (model used for embeddings), `engine_version` (soulkiller engine version), `soulType` (soul type: `personal` or `public`), and `tags` (TagSet object with category-to-string-array mapping).

#### Scenario: Manifest validation on package creation

- **WHEN** a soul package is created via `/publish`
- **THEN** the system SHALL generate a `manifest.json` with all required fields populated
- **THEN** `version` SHALL default to `1.0.0` for new packages
- **THEN** `created_at` SHALL be set to the current UTC timestamp
- **THEN** `chunk_count` SHALL reflect the actual number of chunks in the vector store
- **THEN** `soulType` SHALL be set to `personal` or `public`
- **THEN** `tags` SHALL contain the parsed TagSet (may be empty)

#### Scenario: Loading a package with missing manifest fields

- **WHEN** a soul package is loaded
- **AND** `manifest.json` is missing required fields
- **THEN** the system SHALL display a warning listing the missing fields
- **AND** attempt to load with available data
- **AND** `soulType` SHALL default to `public` if missing (backward compatibility)
- **AND** `tags` SHALL default to an empty TagSet if missing
