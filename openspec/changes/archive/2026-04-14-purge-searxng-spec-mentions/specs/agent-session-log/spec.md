## MODIFIED Requirements

### Requirement: META header in log file
The system SHALL write a META header at the top of each log file containing the original prompt, timestamp, model name, search provider, and config summary.

#### Scenario: META header content
- **WHEN** a log file is created for prompt "Research Hideo Kojima" with model "qwen/qwen3-235b-a22b" and provider "exa"
- **THEN** the file starts with a META section containing all of: original prompt (untruncated), ISO timestamp, model identifier, resolved search provider, and serialized config

### Requirement: Tool internal detail logging
The system SHALL log internal details of tool execution including search provider selection, HTTP request URLs, response status codes, raw result counts, and sub-operation details.

#### Scenario: Tavily/Exa search internals
- **WHEN** a search is executed via Tavily or Exa provider
- **THEN** the log contains `[INTERNAL]` lines showing: provider name, result count, and duration
