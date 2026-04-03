## MODIFIED Requirements

### Requirement: Conversation flow includes recall animation and history
The conversation flow SHALL display the full sequence: user input echo → thinking indicator → SOUL_RECALL panel → streaming response → completed message in history.

#### Scenario: Full conversation turn
- **WHEN** user types a question to the loaded soul
- **THEN** the question appears as "❯ {question}" in the conversation view
- **AND** a thinking indicator appears with spinner
- **AND** after recall completes, the SOUL_RECALL panel briefly shows results
- **AND** streaming response begins with soul name header
- **AND** after completion, the full response is added to conversation history
