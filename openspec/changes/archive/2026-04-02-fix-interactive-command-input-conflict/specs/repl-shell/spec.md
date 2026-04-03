## MODIFIED Requirements

### Requirement: Interactive commands disable main input
When an interactive command (one that contains its own input elements) is active, the App SHALL NOT render the main TextInput or SoulPrompt to prevent useInput conflicts.

#### Scenario: /create hides main input
- **WHEN** user executes /create and the CreateCommand component is rendered
- **THEN** the main TextInput and SoulPrompt are not rendered
- **AND** only CreateCommand's internal inputs receive keyboard events

#### Scenario: Interactive command completion restores input
- **WHEN** an interactive command completes (success or error)
- **THEN** the main TextInput and SoulPrompt are rendered again
- **AND** the user can type new commands

#### Scenario: Static commands keep main input active
- **WHEN** user executes /help or /status or /list
- **THEN** the main TextInput and SoulPrompt remain rendered and active
