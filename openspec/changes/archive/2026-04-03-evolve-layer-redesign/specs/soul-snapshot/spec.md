## ADDED Requirements

### Requirement: Auto-snapshot before every evolve
The system SHALL create a snapshot of the current soul files before any evolve operation modifies them.

#### Scenario: Snapshot creation before evolve
- **WHEN** an evolve operation is about to modify soul files
- **THEN** the system SHALL copy the entire `soul/` directory to `snapshots/<ISO-timestamp>/`
- **AND** record the snapshot ID (timestamp) in the evolve history entry

#### Scenario: Snapshot directory structure
- **WHEN** a snapshot is created
- **THEN** the snapshot directory SHALL contain an exact copy of: `soul/identity.md`, `soul/style.md`, `soul/behaviors/*.md`
- **AND** a `snapshot-meta.json` with `{timestamp, reason, chunk_count_at_time}`

### Requirement: Snapshot retention limit
The system SHALL retain at most 10 snapshots per soul, automatically removing the oldest when the limit is exceeded.

#### Scenario: Snapshot count exceeds limit
- **WHEN** a new snapshot is created and the soul already has 10 snapshots
- **THEN** the system SHALL delete the oldest snapshot directory
- **AND** the newest 10 snapshots remain

#### Scenario: Snapshot count within limit
- **WHEN** a new snapshot is created and the soul has fewer than 10 snapshots
- **THEN** no existing snapshots SHALL be deleted

### Requirement: Rollback to snapshot
The system SHALL provide an `/evolve rollback` subcommand that restores soul files from a selected snapshot.

#### Scenario: Rollback with available snapshots
- **WHEN** user runs `/evolve rollback` for a soul with snapshots
- **THEN** the system SHALL display a list of available snapshots with timestamps and metadata
- **AND** the user selects one snapshot
- **AND** the current soul files are replaced with the snapshot contents
- **AND** a new snapshot of the pre-rollback state is created first (to prevent rollback from being irreversible)

#### Scenario: Rollback with no snapshots
- **WHEN** user runs `/evolve rollback` for a soul with no snapshots
- **THEN** the system SHALL display "无可用快照" and return to idle

#### Scenario: Rollback preserves chunks
- **WHEN** a rollback is performed
- **THEN** only soul files (identity.md, style.md, behaviors/) are restored
- **AND** `chunks.json` is NOT modified (ingested data is preserved)
- **AND** manifest evolve_history records the rollback event
