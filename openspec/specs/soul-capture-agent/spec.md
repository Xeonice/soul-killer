# Soul Capture Agent

### Requirement: Auto-classify target type

The agent SHALL automatically identify the target type through a two-phase process: (1) program-driven deterministic search, (2) single LLM analysis call.

WHEN a user provides a target name, the agent MUST:
1. Execute deterministic searches: Tavily search for the name, Tavily search for name + hint (if provided), Wikipedia search in Chinese, Wikipedia search in English
2. Collect all search results into a context document
3. Call the LLM once (without tools) with the search context, requesting a JSON response with classification, english_name, origin, and summary
4. Parse the JSON response to determine the target classification

The agent SHALL NOT use LLM tool-calling loops for search. All searches are program-initiated.

#### Scenario: Fictional character identification

- **WHEN** the user inputs "大卫·马丁内斯" with hint "cyberpunk edge runner 的主角"
- **THEN** the agent executes Tavily search for "大卫·马丁内斯" and "大卫·马丁内斯 cyberpunk edge runner 的主角"
- **THEN** the agent executes Wikipedia search in Chinese and English
- **THEN** the agent calls LLM once with all search results
- **THEN** the LLM returns JSON with classification DIGITAL_CONSTRUCT

#### Scenario: Name-only identification (no hint)

- **WHEN** the user inputs "Elon Musk" with no hint
- **THEN** the agent executes Tavily search for "Elon Musk"
- **THEN** the agent executes Wikipedia search in Chinese and English
- **THEN** the LLM returns JSON with classification PUBLIC_ENTITY

#### Scenario: All searches fail

- **WHEN** all search sources return errors or no results
- **THEN** the LLM analysis SHALL still be called with empty context
- **THEN** classification SHALL be UNKNOWN_ENTITY

#### Scenario: LLM analysis returns invalid JSON

- **WHEN** the LLM response cannot be parsed as valid JSON
- **THEN** the agent SHALL retry the LLM call once
- **THEN** if retry also fails, classification SHALL be UNKNOWN_ENTITY

---

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

---

### Requirement: DIGITAL_CONSTRUCT gathering strategy

The agent SHALL use fiction-specific search strategies for DIGITAL_CONSTRUCT targets.

#### Scenario: Gathering deep data for fictional character

- WHEN the target is classified as DIGITAL_CONSTRUCT
- THEN the gather_deep step MUST execute Tavily searches for:
  - Character quotes and dialogue lines
  - Character analysis and personality breakdowns
  - Character relationships and story arcs
- THEN search queries SHALL target game wikis, anime wikis, movie databases, and fan analysis sites

---

### Requirement: PUBLIC_ENTITY gathering strategy

The agent SHALL use public-figure-specific search strategies for PUBLIC_ENTITY targets.

#### Scenario: Gathering deep data for public figure

- WHEN the target is classified as PUBLIC_ENTITY
- THEN the gather_deep step MUST execute Tavily searches for:
  - Interviews and public statements
  - Speeches and presentations
  - Opinions and public positions
  - Social media presence and communication style

---

### Requirement: HISTORICAL_RECORD gathering strategy

The agent SHALL use historical-figure-specific search strategies for HISTORICAL_RECORD targets.

#### Scenario: Gathering deep data for historical figure

- WHEN the target is classified as HISTORICAL_RECORD
- THEN the gather_deep step MUST execute Tavily searches for:
  - Famous quotes and attributed sayings
  - Philosophical positions and core ideas
  - Published writings and known works
  - Historical accounts and biographical analyses

---

### Requirement: UNKNOWN_ENTITY fallback behavior

WHEN search results are insufficient for meaningful extraction, the agent SHALL return empty chunks and signal manual mode.

#### Scenario: Insufficient search results trigger manual fallback

- WHEN the target is classified as UNKNOWN_ENTITY
- THEN the agent MUST return an empty SoulChunk[] array
- THEN the agent MUST signal that manual data source selection is required
- THEN the user SHALL be presented with manual data source options

---

### Requirement: OpenRouter via Vercel AI SDK

The agent SHALL use OpenRouter as its LLM provider through the Vercel AI SDK.

#### Scenario: LLM provider configuration

- WHEN the agent initializes
- THEN it MUST use @ai-sdk/openai with a custom baseURL pointing to OpenRouter
- THEN API authentication MUST use the configured OpenRouter API key

---

### Requirement: Tavily API key optional

The Tavily API key SHALL be optional. When absent, the agent is skipped entirely.

#### Scenario: No Tavily API key configured

- WHEN the Tavily API key is not present in configuration
- THEN the soul capture agent MUST NOT be invoked
- THEN the system SHALL proceed directly to manual data source selection mode

#### Scenario: Tavily API key present

- WHEN the Tavily API key is present in configuration
- THEN the soul capture agent SHALL be invoked as the first step of the /create flow

### Requirement: Agent uses manual loop with realtime progress
The Soul Capture Agent SHALL use a manual agent loop instead of single generateText, emitting progress for each tool call.

#### Scenario: Each tool call is visible to UI
- **WHEN** the agent calls the search tool
- **THEN** a progress event is emitted with the tool name and search query before execution
- **AND** a progress event is emitted with the result count after execution

#### Scenario: Classification is extracted during loop
- **WHEN** the agent receives search results about the target
- **THEN** the classification is extracted from LLM text output during the loop (not from final JSON)
- **AND** a classification progress event is emitted

#### Scenario: Loop terminates when LLM stops calling tools
- **WHEN** the LLM responds without requesting tool calls
- **THEN** the agent loop exits and returns the accumulated chunks

#### Scenario: Max iterations prevent infinite loop
- **WHEN** the agent has executed 15 loop iterations
- **THEN** the loop exits regardless of LLM behavior

### Requirement: Agent uses classification-specific search queries
After identifying the target classification, the agent SHALL use predefined search query templates specific to that classification instead of letting the LLM freely decide what to search.

#### Scenario: DIGITAL_CONSTRUCT search strategy
- **WHEN** the agent identifies the target as DIGITAL_CONSTRUCT
- **THEN** the agent searches for: character wiki/fandom, quotes/dialogue, personality analysis
- **AND** searches use the English name with keywords like "character", "wiki", "quotes", "personality"

#### Scenario: PUBLIC_ENTITY search strategy
- **WHEN** the agent identifies the target as PUBLIC_ENTITY
- **THEN** the agent searches for: interviews/speeches, opinions/philosophy, personality/communication style

#### Scenario: HISTORICAL_RECORD search strategy
- **WHEN** the agent identifies the target as HISTORICAL_RECORD
- **THEN** the agent searches for: philosophy/famous quotes, biography/legacy, writings

### Requirement: Agent extracts and uses English name
After the initial identification search, the agent SHALL extract the English name from Wikipedia results and use it for subsequent searches.

#### Scenario: Chinese name mapped to English
- **WHEN** user inputs "强尼银手" and Wikipedia returns "Johnny Silverhand"
- **THEN** subsequent searches use "Johnny Silverhand" as the primary query name

### Requirement: Two-round search strategy
The agent SHALL use a two-round approach: Round 1 for identification (free search), Round 2 for targeted collection (predefined queries based on classification).

#### Scenario: Round 1 then Round 2
- **WHEN** Round 1 completes with classification DIGITAL_CONSTRUCT
- **THEN** Round 2 executes predefined character-specific searches without LLM deciding queries

### Requirement: Search results include full page content
After DuckDuckGo search returns URLs, the agent SHALL use the page extractor to fetch full content for the top 3 results, replacing snippets with full Markdown content.

#### Scenario: Full content replaces snippet
- **WHEN** DuckDuckGo returns 5 results with snippets
- **THEN** the top 3 URLs are fetched in parallel using the page extractor
- **AND** results with successfully extracted content use the full content instead of the snippet
- **AND** results where extraction failed keep the original snippet

#### Scenario: Tavily results with short content
- **WHEN** Tavily returns a result with content shorter than 200 characters
- **THEN** the page extractor is triggered for that URL to get full content

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

The `captureSoul()` function SHALL accept an optional `hint?: string` parameter. When provided, the hint SHALL be used as a search query suffix in the deterministic search step (not passed to an LLM tool-calling prompt).

#### Scenario: Hint used as search suffix

- **WHEN** `captureSoul("大卫·马丁内斯", config, onProgress, "cyberpunk edge runner 的主角")` is called
- **THEN** the deterministic search step SHALL execute an additional Tavily search for "大卫·马丁内斯 cyberpunk edge runner 的主角"

### Requirement: Search result confirmation before proceeding

After Agent search completes with valid results, the system SHALL pause at a `search-confirm` step to let the user verify the target before continuing.

#### Scenario: Successful search triggers confirmation

- **WHEN** Agent search completes with classification other than UNKNOWN_ENTITY
- **THEN** the system SHALL transition to `search-confirm` step
- **THEN** the system SHALL NOT auto-proceed to data-sources or distillation

#### Scenario: UNKNOWN_ENTITY skips confirmation

- **WHEN** Agent search completes with UNKNOWN_ENTITY classification
- **THEN** the system SHALL transition directly to data-sources step (existing behavior)
