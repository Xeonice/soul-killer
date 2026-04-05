## MODIFIED Requirements

### Requirement: Error state keyboard handling
The create command SHALL handle keyboard input in the `error` step: Esc to return to REPL, up/down arrows to navigate menu, Enter to confirm selection.

#### Scenario: Esc returns to REPL
- **WHEN** the user is on the error screen and presses Esc
- **THEN** `onCancel()` is called and the user returns to the REPL

#### Scenario: Enter on retry option
- **WHEN** the user selects "retry" and presses Enter
- **THEN** agent state is reset (toolCalls, classification, origin, chunks, protocolPhase) and the create flow restarts from capturing (public) or data-sources (personal)

#### Scenario: Enter on return option
- **WHEN** the user selects "return to REPL" and presses Enter
- **THEN** `onCancel()` is called

### Requirement: Error screen shows retry menu
The error screen SHALL display the error message and a two-option menu (retry / return to REPL) instead of a text-only hint.

#### Scenario: Error menu displayed
- **WHEN** an error occurs during create flow
- **THEN** the error screen shows the error message and two selectable options: retry and return to REPL

#### Scenario: User inputs preserved on retry
- **WHEN** the user retries after an error
- **THEN** soulName, soulType, description, and hint are preserved from the original attempt
