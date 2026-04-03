## MODIFIED Requirements

### Requirement: Full i18n coverage for all user-visible strings
The i18n system SHALL provide translations for ALL user-visible strings in the application. No hardcoded Chinese, Japanese, or English text SHALL appear outside of locale JSON files.

#### Scenario: CLI command output in English
- **WHEN** the user's language is set to `en`
- **THEN** all command output, error messages, prompts, and status text SHALL be in English
- **AND** no Chinese or Japanese characters appear in the output (except soul names and user data)

#### Scenario: CLI command output in Japanese
- **WHEN** the user's language is set to `ja`
- **THEN** all command output SHALL be in Japanese

#### Scenario: LLM prompts match configured language
- **WHEN** the user's language is set to `en`
- **THEN** LLM system prompts (distillation, tag parsing, merging) SHALL be in English
- **AND** the prompts SHALL be natively written (not machine-translated) to maintain quality

#### Scenario: Missing translation key falls back to key name
- **WHEN** a translation key has no entry in the current locale
- **THEN** the system SHALL display the key name as fallback (existing behavior preserved)

### Requirement: Locale JSON structure supports multiline prompt templates
The locale JSON files SHALL support long multiline strings for LLM prompt templates using `\n` escapes.

#### Scenario: Prompt template in locale file
- **WHEN** a distillation prompt is stored as a locale key
- **THEN** the value SHALL contain the complete prompt text with `\n` for line breaks
- **AND** the `t()` function SHALL return the prompt with newlines preserved
