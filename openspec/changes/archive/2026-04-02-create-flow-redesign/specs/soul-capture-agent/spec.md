## MODIFIED Requirements

### Requirement: Auto-classify target type

The agent SHALL automatically identify the target type based on input name and optional user-provided hint without user confirmation.

WHEN a user provides a target name, the agent MUST:
- Execute a Tavily search for the name (using hint for disambiguation if provided)
- Pass search results to the LLM for classification
- Classify the target as one of: DIGITAL_CONSTRUCT (fictional characters from games/anime/movies/novels), PUBLIC_ENTITY (public figures), HISTORICAL_RECORD (historical persons), or UNKNOWN_ENTITY (insufficient results)

The user SHALL NOT see or be prompted to confirm the classification. The classification is fully autonomous.

#### Scenario: Fictional character identification

- **WHEN** the user inputs "V" with hint "赛博朋克2077主角 女V"
- **THEN** the agent searches via Tavily using the hint to disambiguate
- **THEN** the LLM classifies the target as DIGITAL_CONSTRUCT

#### Scenario: Name-only identification (no hint)

- **WHEN** the user inputs "Elon Musk" with no hint
- **THEN** the agent searches via Tavily using only the name
- **THEN** the LLM classifies the target as PUBLIC_ENTITY

#### Scenario: Hint improves disambiguation

- **WHEN** the user inputs "张三" with hint "唐代诗人"
- **THEN** the agent SHALL include the hint in search queries
- **THEN** the LLM SHALL use the hint context to classify as HISTORICAL_RECORD instead of UNKNOWN_ENTITY

## ADDED Requirements

### Requirement: Conditional agent invocation

The Soul Capture Agent SHALL only be invoked when `soulType` is `public`. When `soulType` is `personal`, the agent SHALL NOT be invoked.

#### Scenario: Personal soul skips agent

- **WHEN** a soul is created with `soulType: personal`
- **THEN** the `captureSoul()` function SHALL NOT be called
- **THEN** the flow SHALL proceed directly to data source selection or distillation

#### Scenario: Public soul triggers agent

- **WHEN** a soul is created with `soulType: public`
- **THEN** the `captureSoul()` function SHALL be called with the name and optional hint

### Requirement: Hint parameter in captureSoul

The `captureSoul()` function SHALL accept an optional `hint?: string` parameter. When provided, the hint SHALL be appended to the ROUND1_PROMPT to guide classification and search.

#### Scenario: Hint appended to prompt

- **WHEN** `captureSoul("V", config, onProgress, "赛博朋克2077主角 女V")` is called
- **THEN** the ROUND1_PROMPT SHALL include the hint text as additional context for the LLM
