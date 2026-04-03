# Soul Capture Agent

## ADDED Requirements

### Requirement: Auto-classify target type

The agent SHALL automatically identify the target type based on input name without user confirmation.

WHEN a user provides a target name, the agent MUST:
- Execute a Tavily search for the name
- Pass search results to the LLM for classification
- Classify the target as one of: DIGITAL_CONSTRUCT (fictional characters from games/anime/movies/novels), PUBLIC_ENTITY (public figures), HISTORICAL_RECORD (historical persons), or UNKNOWN_ENTITY (insufficient results)

The user SHALL NOT see or be prompted to confirm the classification. The classification is fully autonomous.

#### Scenario: Fictional character identification

- WHEN the user inputs "Hatsune Miku"
- THEN the agent searches via Tavily and receives results about a virtual singer / Vocaloid character
- THEN the LLM classifies the target as DIGITAL_CONSTRUCT

#### Scenario: Public figure identification

- WHEN the user inputs "Elon Musk"
- THEN the agent searches via Tavily and receives results about a real public figure
- THEN the LLM classifies the target as PUBLIC_ENTITY

#### Scenario: Historical person identification

- WHEN the user inputs "Socrates"
- THEN the agent searches via Tavily and receives results about the ancient philosopher
- THEN the LLM classifies the target as HISTORICAL_RECORD

#### Scenario: Unknown entity fallback

- WHEN the user inputs an obscure or private individual name
- THEN the agent searches via Tavily and receives insufficient or irrelevant results
- THEN the LLM classifies the target as UNKNOWN_ENTITY

---

### Requirement: 4-step soul capture workflow

The agent SHALL execute a sequential 4-step workflow: identify, gather_base, gather_deep, personality_analysis.

#### Scenario: Full workflow execution

- WHEN the agent begins soul capture for a classified target
- THEN Step 1 (identify): the agent classifies the target type via Tavily search + LLM
- THEN Step 2 (gather_base): the agent searches Wikipedia for foundational information and extracts SoulChunk[] via LLM
- THEN Step 3 (gather_deep): the agent executes type-specific Tavily searches and extracts SoulChunk[] via LLM
- THEN Step 4 (personality_analysis): the agent synthesizes all gathered chunks into personality trait analysis, producing additional SoulChunk[]

#### Scenario: Each step produces SoulChunks

- WHEN any workflow step completes
- THEN it MUST produce zero or more SoulChunk[] objects
- THEN each SoulChunk SHALL have source field set to "web"

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
