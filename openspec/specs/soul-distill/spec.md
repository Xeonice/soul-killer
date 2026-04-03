# Soul Distillation Engine


### Requirement: Chunk Sampling

The system SHALL randomly sample 200 chunks from the vector store for each distillation run. The sampled chunks MUST be grouped by source (e.g., markdown file path, tweet archive) and by type (e.g., opinion, code-review, conversation). The sampling MUST be non-deterministic across runs to avoid overfitting to the same subset, unless SOULKILLER_SEED is set.

#### Scenario: Standard sampling from a populated vector store

- WHEN a distillation run is triggered
- AND the vector store contains more than 200 chunks
- THEN the system SHALL randomly select exactly 200 chunks
- AND group them into batches keyed by (source, type)

#### Scenario: Vector store contains fewer than 200 chunks

- WHEN a distillation run is triggered
- AND the vector store contains fewer than 200 chunks
- THEN the system SHALL use all available chunks
- AND still group them by source and type

### Requirement: LLM Extraction via OpenRouter

The system SHALL send each batch of grouped chunks to the LLM via OpenRouter, using the `distill_model` from config. The prompt MUST instruct the LLM to extract three categories of features: identity traits (values, worldview, contradictions), style traits (language habits, communication modes, catchphrases), and behavior patterns (context-specific response tendencies).

#### Scenario: Successful batch extraction

- WHEN a batch of chunks is sent to the LLM
- THEN the system SHALL receive structured feature extractions covering identity, style, and behavior
- AND each extraction SHALL reference the source chunks it was derived from

#### Scenario: LLM request fails for a batch

- WHEN an LLM request fails (network error, rate limit, or API error)
- THEN the system SHALL retry up to 3 times with exponential backoff
- AND if all retries fail, the system SHALL skip the batch and continue with remaining batches
- AND report the skipped batch count in the final summary

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

#### Scenario: Behavior file categorization

- WHEN extraction results contain context-specific behaviors
- THEN the system SHALL create separate files under `behaviors/` for each distinct context (e.g., `behaviors/code-review.md`, `behaviors/casual-chat.md`)
- AND each file SHALL contain only behaviors relevant to that context

### Requirement: /distill Command

The system SHALL provide a `/distill` slash command that manually triggers a full re-distillation. The command MUST show real-time progress (sampling status, batch progress, file generation status) and MUST overwrite any existing soul files upon completion.

#### Scenario: User triggers manual distillation

- WHEN the user enters `/distill` in the REPL
- THEN the system SHALL begin a full distillation run
- AND display a progress indicator showing current phase (sampling, extracting batch N/M, generating files)
- AND upon completion, display a summary of generated files with chunk counts

#### Scenario: Distillation triggered with no data in vector store

- WHEN the user enters `/distill`
- AND the vector store is empty
- THEN the system SHALL display an error message indicating no data is available for distillation
- AND suggest the user ingest data first

### Requirement: Model Selection

The distillation process SHALL use the `distill_model` from config for all LLM calls. If `distill_model` is not set, the system MUST fall back to `default_model`. The system SHOULD recommend a high-quality model (such as `anthropic/claude-sonnet`) when no distill model is configured, displaying this recommendation during the first distillation run.

#### Scenario: distill_model is configured

- WHEN a distillation run starts
- AND `distill_model` is set in config (e.g., `anthropic/claude-sonnet-4-20250514`)
- THEN the system SHALL use that model for all LLM extraction calls

#### Scenario: distill_model is not configured

- WHEN a distillation run starts
- AND `distill_model` is not set in config
- THEN the system SHALL fall back to `default_model`
- AND display a one-time recommendation suggesting the user set `distill_model` to a high-quality model for better results

### Requirement: Distillation prompts include target name context
All distillation prompts (identity, style, behavior) SHALL include the target entity name and explicitly instruct the LLM to analyze the target entity, not the text itself.

#### Scenario: Identity prompt with name
- **WHEN** distilling identity for "强尼银手"
- **THEN** the prompt says "以下是关于【强尼银手】的描述...请从中提取【强尼银手】本人的核心身份特征"

#### Scenario: Style prompt distinguishes target from text
- **WHEN** distilling style for any entity
- **THEN** the prompt explicitly says "要分析的是目标人物的沟通风格，不是文章本身的写作风格"

### Requirement: Tag-guided extraction

The distillation extractor SHALL accept a `TagSet` parameter and incorporate it into the LLM extraction prompt as personality hints.

#### Scenario: Tags guide identity extraction

- **WHEN** extraction runs with tags containing `["INTJ"]`
- **THEN** the extraction prompt SHALL mention INTJ traits as a reference
- **THEN** the generated `identity.md` SHALL reflect analytical/strategic personality traits consistent with INTJ

#### Scenario: Tags guide style extraction

- **WHEN** extraction runs with tags containing `["话少", "冷幽默"]`
- **THEN** the extraction prompt SHALL hint at terse, dry-humor communication style
- **THEN** the generated `style.md` SHALL reflect concise expression with occasional sarcasm

#### Scenario: No tags provided

- **WHEN** extraction runs with an empty TagSet
- **THEN** the extraction prompt SHALL proceed without personality hints
- **THEN** extraction SHALL rely entirely on chunk content

### Requirement: Description-only distillation

The distillation pipeline SHALL produce valid soul files even when the only input is synthetic chunks from user description and tags (no real data chunks).

#### Scenario: Minimal input distillation

- **WHEN** distillation runs with only 1-2 synthetic chunks (from intake Q2 + Q3)
- **THEN** the system SHALL skip the sampling step (all chunks used directly)
- **THEN** the system SHALL generate `identity.md`, `style.md`, and at least one `behaviors/*.md`
- **THEN** generated files SHALL be marked as low-confidence (can be improved with more data)

#### Scenario: Mixed synthetic and real chunks

- **WHEN** distillation runs with synthetic chunks plus real data chunks (from markdown/twitter/agent)
- **THEN** synthetic chunks SHALL be included in the sampling pool alongside real chunks
- **THEN** real data chunks SHALL take priority when contradicting synthetic chunks

### Requirement: Progress callback in extractFeatures

The `extractFeatures()` function SHALL accept an optional `onProgress?: (progress: DistillProgress) => void` parameter. When provided, it SHALL emit events at the start and completion of each extraction phase.

#### Scenario: Progress events emitted during extraction

- **WHEN** `extractFeatures()` is called with an `onProgress` callback
- **THEN** progress events SHALL be emitted for phases: identity, style, behavior, merge
- **THEN** the `generate` phase events SHALL be emitted by the caller (create.tsx) since file generation is outside extractor

#### Scenario: Batch-level progress for multi-batch extraction

- **WHEN** a phase processes multiple batches
- **THEN** `onProgress` SHALL be called with `status: 'in_progress'` and `batch`/`totalBatches` for each batch

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
