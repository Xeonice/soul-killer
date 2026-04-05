## MODIFIED Requirements

### Requirement: Config menu items
The config menu SHALL include a "Clean Agent Logs" option alongside existing options (Language, LLM Provider, Search Provider, Animation).

#### Scenario: Clean Agent Logs in menu
- **WHEN** user opens the `/config` command
- **THEN** the menu includes "Clean Agent Logs" as a selectable item that triggers the log cleanup flow defined in the `agent-log-cleanup` spec
