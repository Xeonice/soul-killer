## ADDED Requirements

### Requirement: URL adapter for direct page content extraction
The system SHALL provide a URL adapter that fetches web pages by URL and converts their content into SoulChunks, reusing the existing Readability + Turndown extraction pipeline.

#### Scenario: URL adapter ingests a valid web page
- **WHEN** the URL adapter receives `["https://example.com/article"]`
- **THEN** the adapter SHALL fetch the page HTML
- **AND** extract main content via `@mozilla/readability`
- **AND** convert to Markdown via `turndown`
- **AND** split into SoulChunks at paragraph boundaries
- **AND** each chunk has `source: 'web'`, `type` inferred from content, `metadata: {url, title}`

#### Scenario: URL adapter handles multiple URLs
- **WHEN** the URL adapter receives a list of 5 URLs
- **THEN** the adapter SHALL process each URL sequentially
- **AND** emit progress events per URL (`processing 1/5`, `processing 2/5`, etc.)
- **AND** failures on individual URLs do not stop processing of remaining URLs

### Requirement: Feedback source type in SoulChunk
The SoulChunk `source` field SHALL accept `'feedback'` as a valid source type for conversation feedback data.

#### Scenario: Feedback chunk structure
- **WHEN** a conversation feedback record is converted to a SoulChunk
- **THEN** the chunk SHALL have `source: 'feedback'`, `type: 'reflection'`
- **AND** `metadata: {feedback_id, rating, original_query, original_response, note?}`
- **AND** `content` includes the feedback context framed as correction/reinforcement guidance

#### Scenario: URL adapter extracts publication date into temporal
- **WHEN** the URL adapter fetches a page with publication date metadata
- **THEN** each chunk SHALL include `temporal: { date, confidence: 'exact' }`
- **AND** pages without date metadata SHALL have `temporal: { confidence: 'unknown' }`

## MODIFIED Requirements

### Requirement: SoulChunk Unified Format
The system SHALL define a `SoulChunk` data structure as the universal format for all ingested data. Each SoulChunk MUST contain the following fields: `id` (unique identifier), `source` (origin adapter name), `content` (text content), `timestamp` (ISO 8601 datetime representing ingestion time), `context` (surrounding context or thread info), `type` (content type), and `metadata` (adapter-specific key-value pairs). All adapters MUST output `SoulChunk[]` regardless of their input format. Additionally, each SoulChunk MAY contain an optional `temporal` field representing the content's original time context with confidence level.

#### Scenario: Markdown Chunk Structure
- **WHEN** the Markdown adapter processes a heading section from `philosophy.md`
- **THEN** it produces a SoulChunk with `id` as a deterministic hash, `source` as "markdown", `content` as the section text, `timestamp` as the current ingestion time, `context` as the parent heading hierarchy, `type` as "note", `metadata` containing filename and directory topic tag, and `temporal` extracted from frontmatter/filename/mtime

#### Scenario: Tweet Chunk Structure
- **WHEN** the Twitter adapter processes a single tweet
- **THEN** it produces a SoulChunk with `id` as the tweet ID, `source` as "twitter", `content` as the tweet text, `timestamp` as ingestion time, `context` as reply-to info if applicable, `type` as "tweet", `metadata` containing is_reply flag, and `temporal: { date: '<tweet date>', confidence: 'exact' }`
