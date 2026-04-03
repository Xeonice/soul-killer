# Data Ingest

## MODIFIED Requirements

### Requirement: Agent-first /create flow

The /create flow SHALL be agent-first, attempting automatic soul capture before falling back to manual mode.

#### Scenario: Successful agent capture

- WHEN the user initiates /create and provides a target name
- THEN the system MUST first invoke the soul capture agent
- THEN if the agent returns SoulChunk[] with content (non-UNKNOWN_ENTITY)
- THEN the system proceeds to distillation with the agent-produced chunks

#### Scenario: Agent fallback to manual mode

- WHEN the user initiates /create and the agent classifies the target as UNKNOWN_ENTITY
- THEN the system MUST fall back to manual data source selection
- THEN the user SHALL be presented with the existing manual data source options

#### Scenario: No Tavily key configured

- WHEN the user initiates /create and no Tavily API key is configured
- THEN the system MUST skip the agent entirely
- THEN the system MUST proceed directly to manual data source selection

---

### Requirement: Merge agent and manual results

Agent-produced SoulChunks SHALL be merged with any manual data source results before distillation.

#### Scenario: Agent-only results

- WHEN the agent produces SoulChunk[] and no manual sources are added
- THEN only the agent SoulChunks are passed to distillation

#### Scenario: Agent results supplemented with manual data

- WHEN the agent produces SoulChunk[] and the user also provides manual data sources
- THEN both sets of SoulChunks MUST be merged into a single collection
- THEN the merged collection is passed to distillation

#### Scenario: Manual-only results

- WHEN the agent is skipped or returns empty results and the user provides manual data sources
- THEN only the manual SoulChunks are passed to distillation

---

### Requirement: Config schema extension for Tavily

The config schema SHALL be extended to include an optional Tavily API key.

#### Scenario: Config with Tavily key

- WHEN the config includes search.tavily_api_key with a valid string value
- THEN the soul capture agent MUST use this key for Tavily API calls

#### Scenario: Config without Tavily key

- WHEN the config does not include search.tavily_api_key or it is empty
- THEN the soul capture agent MUST NOT be invoked
- THEN the system SHALL proceed to manual mode without error

---

### Requirement: Setup wizard Tavily key step

The setup wizard SHALL include an optional step for configuring the Tavily API key.

#### Scenario: Tavily key prompt in setup

- WHEN the user runs the setup wizard
- THEN the wizard MUST display the prompt: "Tavily API Key (可选，用于自动采集虚构角色/公众人物): "
- THEN the user MAY leave this field empty to skip agent-based capture

#### Scenario: Tavily key saved to config

- WHEN the user provides a Tavily API key during setup
- THEN the key MUST be saved to config under search.tavily_api_key
