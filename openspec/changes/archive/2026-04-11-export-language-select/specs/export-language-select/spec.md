## ADDED Requirements

### Requirement: Export wizard includes language selection step
The export wizard SHALL include a language selection step where the user chooses the target language for the exported skill content.

#### Scenario: Language selection appears in wizard
- **WHEN** user runs `/export` and completes the story-direction step
- **THEN** a language selection step SHALL appear before the output location step
- **AND** the options SHALL be Chinese (zh), English (en), Japanese (ja)
- **AND** the default selection SHALL be the user's `config.language`

#### Scenario: User selects Japanese
- **WHEN** user selects "日本語 (ja)" in the language step
- **THEN** `exportLanguage` SHALL be set to `'ja'`
- **AND** the export process SHALL use Japanese for all generated content

### Requirement: Export agent generates metadata in selected language
The export agent (planning + execution) SHALL output all story metadata in the user-selected export language.

#### Scenario: Japanese export generates Japanese metadata
- **WHEN** `exportLanguage` is `'ja'`
- **THEN** the planning agent SHALL output `genre_direction`, `tone_direction`, `prose_direction` in Japanese
- **AND** the execution agent SHALL output `genre`, `tone`, `constraints`, `dynamics_note` in Japanese

#### Scenario: English export generates English metadata
- **WHEN** `exportLanguage` is `'en'`
- **THEN** all story metadata SHALL be in English

#### Scenario: Chinese export preserves current behavior
- **WHEN** `exportLanguage` is `'zh'`
- **THEN** behavior SHALL be identical to the current default (Chinese metadata)

### Requirement: set_prose_style target_language matches export language
The export agent SHALL set `set_prose_style.target_language` to match the user-selected export language.

#### Scenario: Japanese export sets target_language to ja
- **WHEN** `exportLanguage` is `'ja'`
- **THEN** the agent SHALL call `set_prose_style` with `target_language: 'ja'`
- **AND** the prose style anti-translatese patterns SHALL be Japanese patterns (not Chinese)

### Requirement: Language directive injected into agent prompts
All export agent prompt builder functions SHALL inject a language directive at the beginning of the user prompt.

#### Scenario: Language directive is first block in prompt
- **WHEN** `buildPlanningPrompt` is called with `exportLanguage: 'ja'`
- **THEN** the returned prompt SHALL begin with a language directive block specifying Japanese
- **AND** the directive SHALL appear before any "User Original Intent" block
