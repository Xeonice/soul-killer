## ADDED Requirements

### Requirement: Dimension definitions support three languages
Soul dimension templates (`soul-dimensions.ts`) and world dimension templates (`world-dimensions.ts`) SHALL provide display names, descriptions, and quality criteria in zh/en/ja.

#### Scenario: Soul dimension display name in English
- **WHEN** the system renders dimension `identity` with language `en`
- **THEN** the display name SHALL be `"Identity"` (not `"身份"`)

#### Scenario: World dimension quality criteria in Japanese
- **WHEN** the system evaluates dimension `geography` with language `ja`
- **THEN** the quality criteria SHALL be in Japanese

#### Scenario: Dimension signals remain multilingual
- **WHEN** dimension signals are used for search matching
- **THEN** the signals array SHALL contain mixed zh/en/ja keywords for maximum search coverage
- **AND** signals SHALL NOT be filtered by language

### Requirement: Planning agent prompts support three languages
The planning agent (`planning-agent.ts`) classification strategies, search query rules, and error messages SHALL be available in zh/en/ja.

#### Scenario: English planning agent
- **WHEN** language is `en` and planning agent runs
- **THEN** the classification strategy descriptions SHALL be in English
- **AND** search query examples SHALL include English examples
- **AND** error messages (e.g., timeout) SHALL be in English

#### Scenario: Japanese planning agent
- **WHEN** language is `ja` and planning agent runs
- **THEN** the classification strategy descriptions SHALL be in Japanese

### Requirement: Distill agent prompts support three languages
The distill agent (`distill-agent.ts`) system prompts and workflow guidelines SHALL be available in zh/en/ja.

#### Scenario: English distill agent
- **WHEN** language is `en` and distill agent runs soul distillation
- **THEN** the system prompt sections (behavior guidelines, relationship types, Phase 2 references) SHALL be in English

### Requirement: World distill prompts support three languages
The world distillation system (`world/distill.ts`) entry generation and history filtering prompts SHALL be available in zh/en/ja.

#### Scenario: Japanese world distill
- **WHEN** language is `ja` and world distill runs
- **THEN** in-world event filtering rules and time format examples SHALL include Japanese examples
- **AND** pass C analysis prompt SHALL be in Japanese

### Requirement: Capture agent scoring prompts support three languages
The capture agent (`capture-agent.ts`) quality scoring guide SHALL be in the configured language.

#### Scenario: English capture scoring
- **WHEN** language is `en` and capture agent scores an article
- **THEN** the scoring explanation examples SHALL be in English
