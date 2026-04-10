## ADDED Requirements

### Requirement: Dual-layer language architecture for exported skill files
The export system SHALL generate .skill archives using a dual-layer language architecture: engine instructions in English (lingua franca), narrative instructions in the user's configured language.

#### Scenario: Export with Japanese language setting
- **WHEN** user's language config is `ja` and they run `/export`
- **THEN** the generated SKILL.md engine instructions (Phase control flow, state management, validation logic, save/load mechanics) SHALL be in English
- **AND** the narrative instructions (prose style, scene rendering tone, choice text rules, ending narration) SHALL be in Japanese

#### Scenario: Export with Chinese language setting
- **WHEN** user's language config is `zh` and they run `/export`
- **THEN** the generated SKILL.md engine instructions SHALL be in English
- **AND** the narrative instructions SHALL be in Chinese

#### Scenario: Export with English language setting
- **WHEN** user's language config is `en` and they run `/export`
- **THEN** both engine and narrative instructions SHALL be in English

### Requirement: Language-aware skill template generation
The `buildMultiCharacterEngine()` and related template functions SHALL accept a `language` parameter that controls the narrative instruction language.

#### Scenario: Template function signature
- **WHEN** `buildMultiCharacterEngine(config, language)` is called with `language = 'ja'`
- **THEN** the returned template SHALL contain English engine instructions and Japanese narrative instructions

#### Scenario: Read budget declaration respects language
- **WHEN** `buildReadBudgetDeclaration(opts, language)` is called
- **THEN** the declaration text SHALL be in the specified language

### Requirement: Language-aware story-spec generation
The `generateStorySpec()` function SHALL produce story-spec.md content in the user's configured language.

#### Scenario: Japanese story-spec
- **WHEN** `generateStorySpec(config, 'ja')` is called
- **THEN** structural labels (共享轴 → 共有軸), descriptions, and documentation SHALL be in Japanese
- **AND** field names in state_schema (snake_case identifiers) SHALL remain in English

### Requirement: Language-aware export agent prompts
The export agent system prompts (planning and execution) SHALL be available in zh/en/ja and selected based on the user's language setting.

#### Scenario: Japanese export agent
- **WHEN** export runs with language `ja`
- **THEN** the planning agent's system prompt SHALL be in Japanese
- **AND** the execution agent's system prompt SHALL be in Japanese

#### Scenario: Prompt selection function
- **WHEN** `getPlanningPrompt('en')` is called
- **THEN** it SHALL return the English version of the planning system prompt

### Requirement: State runtime CLI messages match export language
The state runtime CLI files (`runtime/lib/*.ts`) packaged into .skill archives SHALL contain output messages in the export language.

#### Scenario: Japanese skill state messages
- **WHEN** a skill is exported with language `ja`
- **THEN** the `runtime/lib/*.ts` files in the archive SHALL contain Japanese output messages
- **AND** the messages SHALL be parseable by the LLM running the skill

#### Scenario: State CLI structured output unchanged
- **WHEN** state CLI runs validation or apply commands
- **THEN** structured JSON output (field names, error codes like `DANGLING_SCRIPT_REF`) SHALL remain in English regardless of language
- **AND** only human/LLM-readable description strings SHALL be localized
