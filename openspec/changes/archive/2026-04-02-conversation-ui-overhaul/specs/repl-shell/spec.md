## MODIFIED Requirements

### Requirement: App renders ConversationView for natural language input
When a soul is loaded and the user types natural language, the App SHALL render the ConversationView component instead of a bare StreamingText.

#### Scenario: Conversation mode rendering
- **WHEN** a soul is loaded and user submits natural language
- **THEN** the App renders ConversationView with full history, thinking state, and streaming state
- **AND** the conversation view appears above the input prompt
