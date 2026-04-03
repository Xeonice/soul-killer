# Web Source Adapter

## ADDED Requirements

### Requirement: SoulChunk output format

The adapter SHALL produce SoulChunk objects with web-specific metadata.

#### Scenario: SoulChunk field values

- WHEN the adapter converts a search result into a SoulChunk
- THEN the source field MUST be set to "web"
- THEN the metadata MUST include:
  - url: the source URL of the search result
  - search_query: the Tavily query that produced the result
  - extraction_step: the workflow step that triggered the extraction (e.g., "gather_base", "gather_deep")

---

### Requirement: LLM-based structured extraction

The adapter SHALL use an LLM to extract structured chunks from raw search text.

#### Scenario: Splitting raw text into distinct chunks

- WHEN the adapter receives raw search result text
- THEN it MUST pass the text to the LLM for extraction
- THEN the LLM MUST split the text into distinct SoulChunks, each representing a single fact, opinion, quote, or analysis

#### Scenario: No conflation of distinct information

- WHEN a search result contains multiple distinct pieces of information
- THEN each piece MUST become a separate SoulChunk
- THEN no single SoulChunk SHALL contain unrelated information merged together

---

### Requirement: Chunk type classification

The adapter SHALL classify each extracted chunk into a semantic type.

#### Scenario: Knowledge type classification

- WHEN the extracted chunk contains factual information (biographical data, events, attributes)
- THEN the chunk type MUST be set to "knowledge"

#### Scenario: Opinion type classification

- WHEN the extracted chunk contains views, positions, or takes expressed by the target
- THEN the chunk type MUST be set to "opinion"

#### Scenario: Casual type classification

- WHEN the extracted chunk contains dialogue lines, direct quotes, or conversational fragments
- THEN the chunk type MUST be set to "casual"

#### Scenario: Reflection type classification

- WHEN the extracted chunk contains analysis, introspection, or philosophical reasoning
- THEN the chunk type MUST be set to "reflection"

---

### Requirement: Cross-step deduplication

The adapter SHALL deduplicate chunks with similar content across different search steps.

#### Scenario: Duplicate content across steps

- WHEN gather_base and gather_deep both produce chunks with substantially similar content
- THEN the adapter MUST retain only one copy of the duplicated chunk
- THEN the retained chunk SHOULD prefer the version with richer metadata or more specific source

#### Scenario: Similar but distinct content preserved

- WHEN two chunks cover the same topic but contain meaningfully different information
- THEN both chunks MUST be preserved as separate entries
