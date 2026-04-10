## ADDED Requirements

### Requirement: Japanese anti-translatese pattern library
The prose style system SHALL include a Japanese anti-translatese pattern library at `src/export/support/ja-translatese-patterns.ts`, parallel to the existing Chinese library.

#### Scenario: Japanese patterns loaded for ja export
- **WHEN** prose style is set up for a Japanese export
- **THEN** the system SHALL use Japanese-specific anti-translatese patterns (e.g., unnatural Chinese-influenced expressions, excessive keigo, stiff sentence structures)

#### Scenario: English export has no anti-translatese
- **WHEN** prose style is set up for an English export
- **THEN** the system SHALL NOT inject any anti-translatese patterns
- **AND** the prose style constraints SHALL focus on natural English prose only

### Requirement: Language-aware pattern formatting
The `formatPatternsForToolDescription()` function SHALL accept a language parameter and return patterns for the corresponding language.

#### Scenario: Format patterns for Japanese
- **WHEN** `formatPatternsForToolDescription('ja')` is called
- **THEN** it SHALL return the Japanese anti-translatese pattern descriptions

#### Scenario: Format patterns for Chinese
- **WHEN** `formatPatternsForToolDescription('zh')` is called
- **THEN** it SHALL return the Chinese anti-translatese pattern descriptions (existing behavior)

#### Scenario: Format patterns for English
- **WHEN** `formatPatternsForToolDescription('en')` is called
- **THEN** it SHALL return an empty pattern list or English-only prose guidance
