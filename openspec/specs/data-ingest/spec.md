# Data Ingestion Pipeline

Data ingestion pipeline providing a unified SoulChunk format, Markdown and Twitter adapters, pipeline orchestration, progress reporting, and an extensible adapter interface.

## ADDED Requirements

### Requirement: SoulChunk Unified Format
The system SHALL define a `SoulChunk` data structure as the universal format for all ingested data. Each SoulChunk MUST contain the following fields: `id` (unique identifier), `source` (origin adapter name), `content` (text content), `timestamp` (ISO 8601 datetime representing ingestion time), `context` (surrounding context or thread info), `type` (content type), and `metadata` (adapter-specific key-value pairs). All adapters MUST output `SoulChunk[]` regardless of their input format. Additionally, each SoulChunk MAY contain an optional `temporal` field representing the content's original time context with confidence level.

#### Scenario: Markdown Chunk Structure
- **WHEN** the Markdown adapter processes a heading section from `philosophy.md`
- **THEN** it produces a SoulChunk with `id` as a deterministic hash, `source` as "markdown", `content` as the section text, `timestamp` as the current ingestion time, `context` as the parent heading hierarchy, `type` as "note", `metadata` containing filename and directory topic tag, and `temporal` extracted from frontmatter/filename/mtime

#### Scenario: Tweet Chunk Structure
- **WHEN** the Twitter adapter processes a single tweet
- **THEN** it produces a SoulChunk with `id` as the tweet ID, `source` as "twitter", `content` as the tweet text, `timestamp` as ingestion time, `context` as reply-to info if applicable, `type` as "tweet", `metadata` containing is_reply flag, and `temporal: { date: '<tweet date>', confidence: 'exact' }`

### Requirement: Markdown Adapter

The system SHALL provide a Markdown adapter that scans a directory recursively for `.md` files. The adapter MUST split each file by heading boundaries (h1 `#` and h2 `##`), creating one SoulChunk per section. The adapter MUST extract metadata including the filename, file modification time (mtime), and the parent directory name as a topic tag. Empty sections MUST be skipped.

#### Scenario: Directory With Multiple Markdown Files

- WHEN the adapter is given a directory containing 3 markdown files with a total of 10 heading sections
- THEN the adapter scans all 3 files recursively
- THEN it produces 10 SoulChunk objects (one per heading section)
- THEN each chunk's metadata includes the source filename and directory topic tag

#### Scenario: Nested Directory Structure

- WHEN the adapter scans a directory with subdirectories `thoughts/philosophy/` and `thoughts/tech/`
- THEN files in `philosophy/` get topic tag "philosophy"
- THEN files in `tech/` get topic tag "tech"

#### Scenario: File With No Headings

- WHEN the adapter encounters a markdown file with no h1/h2 headings
- THEN the entire file content is treated as a single SoulChunk

### Requirement: Twitter Adapter

The system SHALL provide a Twitter adapter that parses the `tweets.js` file from a standard Twitter archive export. The adapter MUST filter out retweets (tweets starting with "RT @") and pure-link tweets (tweets containing only a URL with no other text). The adapter MUST merge adjacent tweets from the same user posted within a 30-minute gap into thread SoulChunks. The adapter MUST extract tweet content, timestamp, and `is_reply` flag for each chunk.

#### Scenario: Standard Twitter Archive

- WHEN the adapter is given a `tweets.js` file containing 500 tweets
- THEN retweets and pure-link tweets are filtered out
- THEN adjacent tweets within 30-minute gaps are merged into threads
- THEN each resulting SoulChunk has type "tweet" or "thread" accordingly

#### Scenario: Thread Merging

- WHEN the archive contains 5 consecutive tweets posted within 10 minutes of each other
- THEN the adapter merges them into a single SoulChunk with type "thread"
- THEN the content contains all 5 tweets joined with newlines
- THEN the timestamp is the first tweet's timestamp

#### Scenario: Retweet Filtering

- WHEN the archive contains a tweet with text "RT @someone: great take"
- THEN the tweet is excluded from the output

#### Scenario: Pure-Link Filtering

- WHEN the archive contains a tweet with text "https://example.com"
- THEN the tweet is excluded from the output
- WHEN the archive contains a tweet with text "Check this out https://example.com"
- THEN the tweet is included because it has text beyond the URL

### Requirement: Pipeline Orchestration

The system SHALL provide a pipeline orchestrator that accepts adapter selection and input paths, runs the selected adapters, collects all resulting SoulChunks, and passes them to the engine for embedding and storage. The orchestrator MUST support running multiple adapters in a single pipeline execution. The orchestrator MUST deduplicate chunks by ID before passing to the engine.

#### Scenario: Single Adapter Pipeline

- WHEN the user runs `/ingest` and selects only the Markdown adapter with path `~/notes/`
- THEN the pipeline runs the Markdown adapter on `~/notes/`
- THEN collected chunks are deduplicated by ID
- THEN chunks are passed to the engine's `ingest()` method

#### Scenario: Multi-Adapter Pipeline

- WHEN the user selects both Markdown and Twitter adapters with respective paths
- THEN the pipeline runs both adapters
- THEN all chunks from both adapters are collected and deduplicated
- THEN the combined chunk set is passed to the engine's `ingest()` method

### Requirement: Progress Reporting

The system SHALL emit progress events throughout the ingestion pipeline for the UI to display. Events MUST include: files scanned count, chunks created count, and embedding progress (percentage or chunk index). The REPL MUST render these events as a live-updating progress display.

#### Scenario: Progress During Markdown Ingestion

- WHEN the Markdown adapter processes a directory with 20 files
- THEN progress events emit: "Scanning files: 1/20", "Scanning files: 2/20", etc.
- THEN after scanning: "Chunks created: 45"
- THEN during embedding: "Embedding: 10/45", "Embedding: 20/45", etc.

#### Scenario: Progress Display in REPL

- WHEN progress events are emitted during ingestion
- THEN the REPL displays a live-updating progress bar or status line
- THEN the display updates in-place without scrolling

### Requirement: Extensible Adapter Interface

The system SHALL define an adapter interface that allows new data source adapters to be added without modifying core pipeline code. Each adapter MUST implement a `name` property, a `parse(input: AdapterInput): Promise<SoulChunk[]>` method, and a `validate(input: AdapterInput): Promise<boolean>` method. The pipeline orchestrator MUST discover and use adapters through this interface only.

#### Scenario: Adding a New Adapter

- WHEN a developer creates a new WeChat adapter implementing the adapter interface
- THEN the adapter can be registered with the pipeline without changing orchestrator code
- THEN the `/ingest` command's source selection automatically includes the new adapter

#### Scenario: Adapter Validation Failure

- WHEN the Twitter adapter's `validate()` is called with a path that contains no `tweets.js`
- THEN `validate()` returns false
- THEN the pipeline skips the Twitter adapter and reports the validation failure to the user
## MODIFIED Requirements

### Requirement: Create flow supports Esc cancellation
The /create command SHALL allow the user to press Esc at any step to exit back to the REPL.

#### Scenario: Esc during name input
- **WHEN** user presses Esc during the name input step of /create
- **THEN** the create flow is cancelled and the user returns to the REPL prompt

#### Scenario: Esc during source path input
- **WHEN** user presses Esc during the source-path input step
- **THEN** the create flow is cancelled and the user returns to the REPL prompt

#### Scenario: Esc during ingesting phase
- **WHEN** user presses Esc during the ingesting phase
- **THEN** the create flow is cancelled, the partially created soul directory is preserved

#### Scenario: Esc during distilling phase
- **WHEN** user presses Esc during the distilling phase
- **THEN** the create flow is cancelled, imported data is preserved, user can later run /distill

### Requirement: Create flow uses path completion for source paths
The source-path input step in /create SHALL use file system path completion.

#### Scenario: Path completion in source-path step
- **WHEN** user is on the source-path step for Markdown
- **THEN** the TextInput uses pathCompletion mode showing matching directories and files
# Data Ingest

## MODIFIED Requirements

### Requirement: Agent-first /create flow

The /create flow SHALL be agent-first, attempting automatic soul capture before falling back to manual mode.

#### Scenario: Successful agent capture

- WHEN the user initiates /create and provides a target name
- THEN the system MUST first invoke the soul capture agent
- THEN if the agent returns SoulChunk[] with content (non-UNKNOWN_ENTITY)
- THEN the system proceeds to distillation with the agent-produced chunks

#### Scenario: Agent fallback to manual mode

- WHEN the user initiates /create and the agent classifies the target as UNKNOWN_ENTITY
- THEN the system MUST fall back to manual data source selection
- THEN the user SHALL be presented with the existing manual data source options

#### Scenario: No Tavily key configured

- WHEN the user initiates /create and no Tavily API key is configured
- THEN the system MUST skip the agent entirely
- THEN the system MUST proceed directly to manual data source selection

---

### Requirement: Merge agent and manual results

Agent-produced SoulChunks SHALL be merged with any manual data source results before distillation.

#### Scenario: Agent-only results

- WHEN the agent produces SoulChunk[] and no manual sources are added
- THEN only the agent SoulChunks are passed to distillation

#### Scenario: Agent results supplemented with manual data

- WHEN the agent produces SoulChunk[] and the user also provides manual data sources
- THEN both sets of SoulChunks MUST be merged into a single collection
- THEN the merged collection is passed to distillation

#### Scenario: Manual-only results

- WHEN the agent is skipped or returns empty results and the user provides manual data sources
- THEN only the manual SoulChunks are passed to distillation

---

### Requirement: Config schema extension for Tavily

The config schema SHALL be extended to include an optional Tavily API key.

#### Scenario: Config with Tavily key

- WHEN the config includes search.tavily_api_key with a valid string value
- THEN the soul capture agent MUST use this key for Tavily API calls

#### Scenario: Config without Tavily key

- WHEN the config does not include search.tavily_api_key or it is empty
- THEN the soul capture agent MUST NOT be invoked
- THEN the system SHALL proceed to manual mode without error

---

### Requirement: Setup wizard Tavily key step

The setup wizard SHALL include an optional step for configuring the Tavily API key.

#### Scenario: Tavily key prompt in setup

- WHEN the user runs the setup wizard
- THEN the wizard MUST display the prompt: "Tavily API Key (可选，用于自动采集虚构角色/公众人物): "
- THEN the user MAY leave this field empty to skip agent-based capture

#### Scenario: Tavily key saved to config

- WHEN the user provides a Tavily API key during setup
- THEN the key MUST be saved to config under search.tavily_api_key

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
