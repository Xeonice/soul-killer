## MODIFIED Requirements

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

### Requirement: 4-step soul capture workflow

The agent SHALL execute a sequential workflow: deterministic_search, llm_classify, gather_deep, convert_chunks.

#### Scenario: Full workflow execution

- **WHEN** the agent begins soul capture for a target
- **THEN** Step 1 (deterministic_search): the agent executes programmatic Tavily + Wikipedia searches
- **THEN** Step 2 (llm_classify): the agent sends search results to LLM for classification, receiving JSON output
- **THEN** Step 3 (gather_deep): if classification is not UNKNOWN_ENTITY, the agent executes type-specific template searches using origin for disambiguation
- **THEN** Step 4 (convert_chunks): all search extractions are filtered for relevance and converted to SoulChunk[]

#### Scenario: Each step produces progress events

- **WHEN** any search query is executed
- **THEN** the agent SHALL emit tool_call and tool_result progress events
- **THEN** the progress events SHALL be identical in format to the previous implementation (ToolCallDisplay compatible)

## REMOVED Requirements

### Requirement: Hint parameter in captureSoul

**Reason**: The hint parameter is retained in the function signature but is no longer passed to an LLM tool-calling prompt. Instead, it is used directly as a search query suffix in the deterministic search step.
**Migration**: No caller changes needed — the parameter remains, only its internal usage changes.
