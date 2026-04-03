## MODIFIED Requirements

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
