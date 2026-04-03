## ADDED Requirements

### Requirement: User messages displayed with prefix
User messages SHALL be displayed in the conversation view with a `❯` prefix in dim color.

#### Scenario: User input echo
- **WHEN** user submits "你好强尼" in the REPL
- **THEN** the conversation view displays "❯ 你好强尼" in dim color above the response

### Requirement: Assistant messages displayed with soul name header
Assistant (soul) messages SHALL be displayed with a `◈ {soulName}` header in magenta, followed by the response content in cyan.

#### Scenario: Soul response rendering
- **WHEN** the soul responds with text
- **THEN** the display shows "◈ 强尼银手" in magenta on one line, followed by the response text in cyan

### Requirement: Conversation history persists on screen
The conversation view SHALL display all messages from the current session, with a separator between conversation turns.

#### Scenario: Multiple turns visible
- **WHEN** the user has had 3 rounds of conversation
- **THEN** all 3 rounds (user + assistant pairs) are visible in the conversation area

### Requirement: Thinking indicator before response
Before the soul starts responding, a thinking indicator SHALL be displayed.

#### Scenario: Thinking animation
- **WHEN** user submits a question and the soul is retrieving memories
- **THEN** a spinner with "scanning memory cortex..." is displayed under the soul name header

### Requirement: Streaming response replaces thinking indicator
When the soul starts streaming its response, the thinking indicator SHALL be replaced by the streaming text.

#### Scenario: Transition from thinking to streaming
- **WHEN** the first token of the response arrives
- **THEN** the thinking indicator disappears and streaming text begins rendering
