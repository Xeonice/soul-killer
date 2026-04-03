## MODIFIED Requirements

### Requirement: 4-step soul capture workflow

The agent SHALL execute a sequential workflow: deterministic_search, llm_classify, strategy_deep_search, convert_chunks.

#### Scenario: Full workflow execution

- **WHEN** the agent begins soul capture for a target
- **THEN** Step 1 (deterministic_search): the agent executes programmatic Tavily + Wikipedia searches
- **THEN** Step 2 (llm_classify): the agent sends search results to LLM for classification, receiving JSON output
- **THEN** Step 3 (strategy_deep_search): the agent selects a SearchStrategy based on classification and executes it to collect deep extractions
- **THEN** Step 4 (convert_chunks): all search extractions are filtered for relevance and converted to SoulChunk[]

#### Scenario: Strategy selection by classification

- **WHEN** classification is DIGITAL_CONSTRUCT
- **THEN** Step 3 SHALL use the DIGITAL_CONSTRUCT strategy (DuckDuckGo + page extraction)

- **WHEN** classification is PUBLIC_ENTITY
- **THEN** Step 3 SHALL use the PUBLIC_ENTITY strategy (Tavily + Wikipedia)

- **WHEN** classification is HISTORICAL_RECORD
- **THEN** Step 3 SHALL use the HISTORICAL_RECORD strategy (Wikipedia-first + Tavily)

- **WHEN** classification is UNKNOWN_ENTITY
- **THEN** Step 3 SHALL be skipped
