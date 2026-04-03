## ADDED Requirements

### Requirement: Conversation state is bound to active soul
The conversation state (display messages and LLM context) SHALL be logically bound to the currently active soul. Any operation that changes the active soul SHALL reset conversation state.

#### Scenario: Soul change via /use clears conversation
- **WHEN** the active soul changes from any source (/use, /create completion, /evolve soul switch)
- **THEN** `conversationMessages` SHALL be set to `[]`
- **AND** the LLM conversation context ref SHALL be set to `[]`

#### Scenario: /create completion clears conversation
- **WHEN** a new soul is created via /create and the flow completes
- **THEN** the conversation state SHALL be empty for the newly created soul
