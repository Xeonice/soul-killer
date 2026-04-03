# Evolve Audit

### Requirement: Evolve status shows soul data composition
The system SHALL provide an `/evolve status` subcommand that displays the current soul's data composition and evolve history.

#### Scenario: Status for a soul with evolve history
- **WHEN** user runs `/evolve status` with a loaded soul
- **THEN** the system SHALL display:
  - Total chunk count and breakdown by source type (markdown: N, web: N, user-input: N, feedback: N, synthetic: N)
  - Last distillation timestamp
  - Number of evolve sessions and their dates
  - Number of available snapshots
  - Current soul files list with approximate sizes

#### Scenario: Status for a freshly created soul
- **WHEN** user runs `/evolve status` for a soul with no evolve history
- **THEN** the system SHALL display: chunk count, source breakdown, creation date
- **AND** message "尚无 evolve 历史"

#### Scenario: No soul loaded
- **WHEN** user runs `/evolve status` without a loaded soul
- **THEN** the system SHALL display an error "请先使用 /use 加载一个分身"

### Requirement: Manifest stores evolve history
The soul manifest SHALL include an `evolve_history` array recording each evolve operation.

#### Scenario: Evolve history entry format
- **WHEN** an evolve operation completes successfully
- **THEN** a new entry SHALL be appended to `manifest.evolve_history` with:
  - `timestamp`: ISO 8601
  - `sources`: array of `{type, path_or_url?, chunk_count}`
  - `dimensions_updated`: array of `'identity' | 'style' | 'behaviors'`
  - `mode`: `'delta' | 'full'`
  - `snapshot_id`: the pre-evolve snapshot timestamp
  - `total_chunks_after`: total chunk count after this evolve

#### Scenario: Manifest backwards compatibility
- **WHEN** loading a manifest that does not contain `evolve_history`
- **THEN** the system SHALL treat it as an empty array
- **AND** not fail or require migration
