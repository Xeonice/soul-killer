# Search Strategy

### Requirement: SearchStrategy interface

The system SHALL define a `SearchStrategy` interface with a `search()` method that accepts target names, origin, search executors, and progress callback, returning `WebSearchExtraction[]`.

#### Scenario: Strategy dispatched by classification

- **WHEN** the soul capture agent reaches Step 3 with a classification
- **THEN** it SHALL select the corresponding SearchStrategy implementation
- **THEN** it SHALL call `strategy.search()` to collect deep extractions

### Requirement: DIGITAL_CONSTRUCT strategy uses DuckDuckGo

The DIGITAL_CONSTRUCT strategy SHALL use DuckDuckGo search with page extraction as its primary search engine, targeting fandom wikis and character databases.

#### Scenario: Searching for an anime character

- **WHEN** the strategy searches for "David Martinez" with origin "Cyberpunk: Edgerunners"
- **THEN** it SHALL execute DuckDuckGo queries including "{name} {origin} wiki" and "{name} {origin} character"
- **THEN** it SHALL extract full page content from top results via Readability
- **THEN** it SHALL supplement with Wikipedia English search

### Requirement: PUBLIC_ENTITY strategy uses Tavily

The PUBLIC_ENTITY strategy SHALL use Tavily as its primary search engine, targeting news articles, interviews, and speeches.

#### Scenario: Searching for a public figure

- **WHEN** the strategy searches for "Elon Musk" with origin "Tesla, SpaceX"
- **THEN** it SHALL execute Tavily queries for interviews, personality, and views
- **THEN** it SHALL supplement with Wikipedia search

### Requirement: HISTORICAL_RECORD strategy uses Wikipedia-first

The HISTORICAL_RECORD strategy SHALL use Wikipedia as its primary source with Tavily as supplement.

#### Scenario: Searching for a historical figure

- **WHEN** the strategy searches for "Socrates" with origin "Ancient Greece"
- **THEN** it SHALL execute Wikipedia searches in English and Chinese as primary source
- **THEN** it SHALL supplement with Tavily queries for quotes and philosophy
