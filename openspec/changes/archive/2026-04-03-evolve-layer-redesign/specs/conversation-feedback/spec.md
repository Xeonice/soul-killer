## ADDED Requirements

### Requirement: /feedback command marks conversation response quality
The system SHALL provide a `/feedback` slash command available during conversation mode (when a soul is loaded) that allows the user to rate the most recent assistant response.

#### Scenario: Positive feedback
- **WHEN** the user enters `/feedback` after receiving an assistant response
- **THEN** the system SHALL display rating options: "很像本人"、"基本像"、"不太像"、"完全不像"
- **AND** the user selects "很像本人"
- **THEN** the feedback is stored with `rating: 'positive'`

#### Scenario: Negative feedback with note
- **WHEN** the user selects "不太像" or "完全不像"
- **THEN** the system SHALL prompt for an optional text note explaining what was wrong
- **AND** the user can provide a note like "他不会用这种语气说话" or press Enter to skip
- **AND** the feedback is stored with `rating: 'negative'` and the user note

#### Scenario: No conversation active
- **WHEN** the user enters `/feedback` without a loaded soul or with no conversation history
- **THEN** the system SHALL display an error "没有可评价的对话"

#### Scenario: Feedback on specific message
- **WHEN** the user enters `/feedback` during a conversation
- **THEN** the feedback SHALL reference the most recent assistant message (the last response)

### Requirement: Feedback storage in soul directory
The system SHALL persist conversation feedback in `~/.soulkiller/souls/<name>/feedback.json` as a JSON array.

#### Scenario: Feedback record structure
- **WHEN** a feedback is submitted
- **THEN** the system SHALL append a record to `feedback.json` with fields:
  - `id`: unique hash
  - `timestamp`: ISO 8601
  - `user_query`: the user message that prompted the assistant response
  - `assistant_response`: the assistant response being rated
  - `rating`: `'positive' | 'somewhat_positive' | 'somewhat_negative' | 'negative'`
  - `note`: optional user-provided text explanation
  - `consumed`: boolean, initially `false` (set to `true` after evolve processes it)

#### Scenario: First feedback creates file
- **WHEN** feedback is submitted for a soul with no existing `feedback.json`
- **THEN** the system SHALL create the file with a single-element array

#### Scenario: Subsequent feedback appends
- **WHEN** feedback is submitted for a soul with existing `feedback.json`
- **THEN** the system SHALL append to the existing array without overwriting

### Requirement: Feedback adapter converts feedback to SoulChunks
The system SHALL provide a feedback adapter that converts unconsumed feedback records into SoulChunks for the evolve pipeline.

#### Scenario: Positive feedback chunk
- **WHEN** a positive feedback record is converted to a SoulChunk
- **THEN** the chunk SHALL have `source: 'feedback'`, `type: 'reflection'`
- **AND** `content` SHALL describe what the soul did right, e.g.: "在被问到「{query}」时，以下回答被认为很像本人：「{response snippet}」"
- **AND** `metadata` SHALL include `{feedback_id, rating, original_query, note?}`

#### Scenario: Negative feedback chunk
- **WHEN** a negative feedback record is converted to a SoulChunk
- **THEN** the chunk `content` SHALL describe what was wrong, e.g.: "在被问到「{query}」时，以下回答被认为不像本人：「{response snippet}」。用户备注：{note}"
- **AND** the content SHALL frame it as correction guidance for the soul

#### Scenario: Mark feedback as consumed
- **WHEN** feedback records are successfully converted to chunks during evolve
- **THEN** the system SHALL set `consumed: true` on those records in `feedback.json`
- **AND** subsequent evolve sessions SHALL only process unconsumed feedback

#### Scenario: No unconsumed feedback
- **WHEN** evolve selects feedback source but all records are already consumed
- **THEN** the system SHALL display "没有未处理的反馈" and return to source selection

### Requirement: Feedback command registered in command registry
The `/feedback` command SHALL be registered in the command registry and available for slash completion.

#### Scenario: Command registry entry
- **WHEN** the command registry is loaded
- **THEN** `/feedback` SHALL appear in the command list with description key `cmd.feedback`
- **AND** grouped under conversation commands

#### Scenario: Slash completion
- **WHEN** user types `/fee` during conversation mode
- **THEN** the completion system SHALL suggest `/feedback`
