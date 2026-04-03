# Lightweight Intake

### Requirement: Three-question intake model

The `/create` command SHALL collect information through exactly 3 sequential inputs after type selection: name (required), description (optional), and tags/impression (optional).

#### Scenario: Full intake flow

- **WHEN** the user enters `/create` and selects a soul type
- **THEN** the system SHALL prompt Q1: soul name (required, cannot be empty)
- **THEN** the system SHALL prompt Q2: one-line description (can be skipped with Enter)
- **THEN** the system SHALL prompt Q3: personality/impression tags (can be skipped with Enter)

#### Scenario: Minimal intake (name only)

- **WHEN** the user provides only a name and skips Q2 and Q3
- **THEN** the system SHALL proceed with empty description and empty tags
- **THEN** the creation flow SHALL still complete successfully

### Requirement: Intake confirmation summary

After collecting all 3 inputs, the system SHALL display a formatted summary and ask the user to confirm before proceeding.

#### Scenario: Summary display with all fields

- **WHEN** all 3 inputs are collected
- **THEN** the system SHALL display: name, description, and parsed tags
- **THEN** the system SHALL ask "确认？(确认 / 修改)"

#### Scenario: User requests modification

- **WHEN** the user responds with "修改" at the confirmation step
- **THEN** the system SHALL return to Q1 and re-collect all inputs

### Requirement: Description used as Agent search hint

For public souls, the Q2 description SHALL be passed to the Soul Capture Agent as a `hint` parameter to improve search accuracy and disambiguation.

#### Scenario: Description improves search

- **WHEN** a public soul is created with description "赛博朋克2077主角 女V 街头小子路线"
- **THEN** the Agent SHALL receive this description as a hint in addition to the name "V"
- **THEN** the Agent's search SHALL use the hint to disambiguate the target

### Requirement: Synthetic chunks from intake data

The system SHALL convert intake data (description + parsed tags) into synthetic `SoulChunk` objects that enter the distillation pipeline alongside any real data chunks.

#### Scenario: Description becomes a knowledge chunk

- **WHEN** the user provides a description "我大学室友 程序员 喜欢钓鱼"
- **THEN** the system SHALL create a SoulChunk with `source: 'user-input'`, `type: 'knowledge'`, `context: 'personal'`

#### Scenario: Tags become a reflection chunk

- **WHEN** the tag parser produces a non-empty TagSet
- **THEN** the system SHALL create a SoulChunk with `source: 'user-input'`, `type: 'reflection'` containing a structured representation of the tags

#### Scenario: No description or tags provided

- **WHEN** both Q2 and Q3 are skipped
- **THEN** no synthetic chunks SHALL be created
- **THEN** the system SHALL still proceed (public souls will have Agent chunks; personal souls will get a minimal skeleton)

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
