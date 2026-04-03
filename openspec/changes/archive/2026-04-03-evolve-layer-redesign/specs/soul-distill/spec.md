## MODIFIED Requirements

### Requirement: Soul File Generation
The system SHALL support both full generation mode (overwrite) and delta merge mode (integrate with existing). In delta mode, the system SHALL read existing soul files, merge delta features using LLM, and write updated files. In full mode, the existing behavior is preserved (overwrite all files).

#### Scenario: Generating soul files in full mode
- **WHEN** distillation runs in full mode
- **THEN** the system SHALL merge results across batches
- **AND** deduplicate overlapping or contradictory features (preferring higher-frequency observations)
- **AND** write `identity.md`, `style.md`, and at least one `behaviors/*.md` file to the soul directory
- **AND** overwrite any existing soul files

#### Scenario: Generating soul files in delta mode
- **WHEN** distillation runs in delta mode with existing soul files present
- **THEN** the system SHALL read the current content of `identity.md`, `style.md`, and `behaviors/*.md`
- **AND** run a merge LLM pass for each selected dimension: existing content + delta features → merged output
- **AND** write the merged output back to the soul files
- **AND** new behavior categories create new files without affecting existing ones

#### Scenario: Delta mode with no existing soul files
- **WHEN** distillation runs in delta mode but no soul files exist yet
- **THEN** the system SHALL fall back to full mode behavior (generate from scratch)

## ADDED Requirements

### Requirement: Selective dimension extraction
The `extractFeatures()` function SHALL accept an optional `dimensions` parameter specifying which feature types to extract.

#### Scenario: Extract only identity
- **WHEN** `extractFeatures()` is called with `dimensions: ['identity']`
- **THEN** only the identity extraction LLM pass SHALL run
- **AND** style and behavior extractions are skipped
- **AND** the returned features SHALL have empty style and behaviors arrays

#### Scenario: Extract identity and style
- **WHEN** `extractFeatures()` is called with `dimensions: ['identity', 'style']`
- **THEN** identity and style extraction LLM passes SHALL run
- **AND** behavior extraction is skipped

#### Scenario: Extract all dimensions (default)
- **WHEN** `extractFeatures()` is called without a `dimensions` parameter
- **THEN** all three dimensions (identity, style, behaviors) SHALL be extracted

### Requirement: Merge function for soul files
The system SHALL provide a `mergeSoulFiles()` function that takes existing soul file content and delta features, and produces merged output via LLM.

#### Scenario: Merge identity with additions
- **WHEN** `mergeSoulFiles()` receives existing identity.md and delta identity text
- **THEN** the LLM SHALL integrate new information into the existing identity structure
- **AND** resolve conflicts by preferring newer information while noting the evolution

#### Scenario: Merge style preserving consistency
- **WHEN** `mergeSoulFiles()` receives existing style.md and delta style text
- **THEN** the LLM SHALL integrate new patterns without creating contradictory directives
- **AND** maintain the overall coherence and voice of the style profile

#### Scenario: Merge behaviors with new category
- **WHEN** delta features contain a behavior category "academic-writing" not in existing behaviors
- **THEN** `mergeSoulFiles()` SHALL return a new behavior entry for "academic-writing"
- **AND** existing behavior entries remain unchanged in the output
