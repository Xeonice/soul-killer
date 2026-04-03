## ADDED Requirements

### Requirement: SoulChunk temporal metadata field
The SoulChunk interface SHALL include an optional `temporal` field that captures the content's original time context, separate from the `timestamp` field (which represents ingestion time).

#### Scenario: Temporal field structure
- **WHEN** a SoulChunk is created
- **THEN** it MAY include a `temporal` field with structure:
  - `date`: optional ISO 8601 date string (YYYY-MM-DD), precise to day
  - `period`: optional human-readable period description (e.g., "2010s", "大学时期")
  - `confidence`: required enum `'exact' | 'inferred' | 'unknown'`

#### Scenario: Chunk without temporal field
- **WHEN** a SoulChunk is created without temporal information
- **THEN** the `temporal` field SHALL be omitted (not set to null or empty)
- **AND** consumers SHALL treat missing `temporal` as equivalent to `confidence: 'unknown'`

### Requirement: Twitter adapter provides exact temporal metadata
The Twitter adapter SHALL populate the `temporal` field with exact date information from tweet timestamps.

#### Scenario: Tweet with timestamp
- **WHEN** a tweet chunk is created from a tweet posted on 2023-03-15
- **THEN** the chunk SHALL have `temporal: { date: '2023-03-15', confidence: 'exact' }`

#### Scenario: Thread temporal uses first tweet date
- **WHEN** a thread chunk is created from multiple tweets
- **THEN** the `temporal.date` SHALL be the first tweet's date
- **AND** `confidence` SHALL be `'exact'`

### Requirement: Markdown adapter extracts temporal metadata from multiple sources
The Markdown adapter SHALL attempt to extract content date from multiple sources in priority order: frontmatter `date` field → filename date pattern → file mtime.

#### Scenario: Frontmatter date
- **WHEN** a markdown file contains YAML frontmatter with `date: 2024-01-15`
- **THEN** the chunk SHALL have `temporal: { date: '2024-01-15', confidence: 'exact' }`

#### Scenario: Filename date pattern
- **WHEN** a markdown file is named `2024-01-15-my-thoughts.md` and has no frontmatter date
- **THEN** the chunk SHALL have `temporal: { date: '2024-01-15', confidence: 'exact' }`

#### Scenario: Filename with year-month only
- **WHEN** a markdown file is named `2024-01-notes.md` and has no frontmatter date
- **THEN** the chunk SHALL have `temporal: { date: '2024-01-01', period: '2024-01', confidence: 'inferred' }`

#### Scenario: Fallback to file mtime
- **WHEN** a markdown file has no frontmatter date and no date pattern in filename
- **THEN** the chunk SHALL have `temporal: { date: '<mtime as YYYY-MM-DD>', confidence: 'inferred' }`

#### Scenario: Frontmatter parsing does not break non-frontmatter files
- **WHEN** a markdown file starts with `# Title` instead of `---`
- **THEN** the adapter SHALL skip frontmatter parsing without error
- **AND** fall through to filename/mtime extraction

### Requirement: Web adapter extracts publication date
The web adapter SHALL attempt to extract the article publication date from HTML metadata.

#### Scenario: Article with published_time meta tag
- **WHEN** a web page contains `<meta property="article:published_time" content="2024-06-20T...">`
- **THEN** the chunk SHALL have `temporal: { date: '2024-06-20', confidence: 'exact' }`

#### Scenario: Article with time element
- **WHEN** a web page contains `<time datetime="2024-06-20">` and no meta tag
- **THEN** the chunk SHALL have `temporal: { date: '2024-06-20', confidence: 'inferred' }`

#### Scenario: No date found in web page
- **WHEN** a web page has no recognizable date metadata
- **THEN** the chunk SHALL have `temporal: { confidence: 'unknown' }`

### Requirement: Synthetic and feedback chunks default to unknown temporal
User-input, synthetic, and feedback source chunks SHALL default to `temporal: { confidence: 'unknown' }` unless the user explicitly provides a time context.

#### Scenario: User-input chunk
- **WHEN** a text input chunk is created via evolve
- **THEN** the chunk SHALL have `temporal: { confidence: 'unknown' }`

#### Scenario: Feedback chunk
- **WHEN** a feedback chunk is created from conversation feedback
- **THEN** the chunk SHALL have `temporal: { date: '<feedback timestamp date>', confidence: 'exact' }` reflecting when the conversation occurred

### Requirement: Existing chunks without temporal remain valid
The system SHALL maintain backward compatibility with chunks that do not have the `temporal` field.

#### Scenario: Loading old chunks.json
- **WHEN** the engine loads a chunks.json where chunks have no `temporal` field
- **THEN** the system SHALL not fail or require migration
- **AND** those chunks SHALL be treated as having `confidence: 'unknown'` for any temporal-aware operations
