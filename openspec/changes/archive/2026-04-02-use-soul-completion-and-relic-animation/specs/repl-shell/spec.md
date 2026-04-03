## MODIFIED Requirements

### Requirement: TextInput supports argument completion map
TextInput SHALL accept an optional `argCompletionMap` prop that maps command names to argument candidate providers.

#### Scenario: Argument completion activates after command + space
- **WHEN** user types `/use ` and argCompletionMap contains a 'use' entry
- **THEN** the argument provider function is called and results are shown in a completion palette

#### Scenario: No argument completion for unmapped commands
- **WHEN** user types `/help ` and argCompletionMap has no 'help' entry
- **THEN** no argument completion list appears

### Requirement: CommandPalette title is configurable
CommandPalette SHALL accept an optional `title` prop (default "COMMANDS").

#### Scenario: Custom title
- **WHEN** CommandPalette is rendered with title="SOULS"
- **THEN** the palette header displays "SOULS"
