## MODIFIED Requirements

### Requirement: /use loads a soul and enters conversation mode
The `/use <name>` command SHALL load the specified soul, initialize the engine, and enter conversation mode. Upon loading a new soul, the system SHALL clear all prior conversation state.

#### Scenario: Switching from one soul to another
- **WHEN** user has an active conversation with soul A and runs `/use B`
- **THEN** the conversation display SHALL be cleared (no messages from soul A visible)
- **AND** the LLM conversation context SHALL be reset (no prior messages sent to the model)
- **AND** the user sees the RELIC load animation for soul B
- **AND** subsequent messages go to soul B with a clean context

#### Scenario: Using the same soul again
- **WHEN** user runs `/use <name>` where name matches the currently loaded soul
- **THEN** the system SHALL do nothing (no-op, no conversation reset)
