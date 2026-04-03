## MODIFIED Requirements

### Requirement: TextInput supports onEscape callback
TextInput SHALL accept an optional `onEscape` prop that is called when Esc is pressed and no completion list is open.

#### Scenario: Esc with no completion list
- **WHEN** user presses Esc in a TextInput with onEscape set and no completion list is open
- **THEN** the onEscape callback is invoked

#### Scenario: Esc with completion list open
- **WHEN** user presses Esc in a TextInput with a completion list open
- **THEN** the completion list closes (existing behavior) and onEscape is NOT called
