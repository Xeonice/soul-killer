# Soul Distillation Engine

## ADDED Requirements

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

The system SHALL merge and deduplicate multi-batch extraction results, then generate the following soul files: `identity.md` (basic info, worldview, contradictions), `style.md` (language habits, communication modes, catchphrases), and one or more `behaviors/*.md` files (context-specific behaviors such as code-review, architecture-design, casual-chat). Generated files MUST overwrite any existing soul files from prior runs.

#### Scenario: Generating soul files from extraction results

- WHEN all batch extractions are complete
- THEN the system SHALL merge results across batches
- AND deduplicate overlapping or contradictory features (preferring higher-frequency observations)
- AND write `identity.md`, `style.md`, and at least one `behaviors/*.md` file to the soul directory

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
