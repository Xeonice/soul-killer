# Data Ingestion Pipeline

Data ingestion pipeline providing a unified SoulChunk format, Markdown and Twitter adapters, pipeline orchestration, progress reporting, and an extensible adapter interface.

## ADDED Requirements

### Requirement: SoulChunk Unified Format

The system SHALL define a `SoulChunk` data structure as the universal format for all ingested data. Each SoulChunk MUST contain the following fields: `id` (unique identifier), `source` (origin adapter name), `content` (text content), `timestamp` (ISO 8601 datetime), `context` (surrounding context or thread info), `type` (content type: "note", "tweet", "thread", "conversation", etc.), and `metadata` (adapter-specific key-value pairs). All adapters MUST output `SoulChunk[]` regardless of their input format.

#### Scenario: Markdown Chunk Structure

- WHEN the Markdown adapter processes a heading section from `philosophy.md`
- THEN it produces a SoulChunk with `id` as a deterministic hash, `source` as "markdown", `content` as the section text, `timestamp` as the file's mtime, `context` as the parent heading hierarchy, `type` as "note", and `metadata` containing filename and directory topic tag

#### Scenario: Tweet Chunk Structure

- WHEN the Twitter adapter processes a single tweet
- THEN it produces a SoulChunk with `id` as the tweet ID, `source` as "twitter", `content` as the tweet text, `timestamp` as the tweet's created_at, `context` as reply-to info if applicable, `type` as "tweet", and `metadata` containing is_reply flag

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
