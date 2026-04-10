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

#### Scenario: World distill panel phase labels are localized
- **WHEN** language is `en` and world distill panel renders
- **THEN** phase labels SHALL show "Data Ingestion", "Dimension Classification", "Semantic Clustering", "Entry Generation" instead of Chinese

#### Scenario: World distill review buttons are localized
- **WHEN** language is `ja` and distill review renders
- **THEN** button labels (accept/skip/end review) and status messages SHALL be in Japanese

#### Scenario: Export error messages are localized
- **WHEN** language is `en` and export command encounters an error (cannot read soul/world, config uninitialized)
- **THEN** error messages SHALL be in English

#### Scenario: Config language labels are localized
- **WHEN** language is `en` and config displays language options
- **THEN** language labels SHALL show localized names ("Chinese", "Japanese", "English")

#### Scenario: Export protocol panel summary is localized
- **WHEN** language is `ja` and export protocol panel shows character summary
- **THEN** the summary text (character count, axis names) SHALL be in Japanese

#### Scenario: Create command placeholder is localized
- **WHEN** language is `en` and create wizard shows tag placeholder
- **THEN** the placeholder example SHALL be in English (not "INTJ 话少 冷幽默 技术洁癖")
