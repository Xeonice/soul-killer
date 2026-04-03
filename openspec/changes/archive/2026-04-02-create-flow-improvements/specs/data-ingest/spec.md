## MODIFIED Requirements

### Requirement: Create flow supports Esc cancellation
The /create command SHALL allow the user to press Esc at any step to exit back to the REPL.

#### Scenario: Esc during name input
- **WHEN** user presses Esc during the name input step of /create
- **THEN** the create flow is cancelled and the user returns to the REPL prompt

#### Scenario: Esc during source path input
- **WHEN** user presses Esc during the source-path input step
- **THEN** the create flow is cancelled and the user returns to the REPL prompt

#### Scenario: Esc during ingesting phase
- **WHEN** user presses Esc during the ingesting phase
- **THEN** the create flow is cancelled, the partially created soul directory is preserved

#### Scenario: Esc during distilling phase
- **WHEN** user presses Esc during the distilling phase
- **THEN** the create flow is cancelled, imported data is preserved, user can later run /distill

### Requirement: Create flow uses path completion for source paths
The source-path input step in /create SHALL use file system path completion.

#### Scenario: Path completion in source-path step
- **WHEN** user is on the source-path step for Markdown
- **THEN** the TextInput uses pathCompletion mode showing matching directories and files
