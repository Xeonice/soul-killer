## MODIFIED Requirements

### Requirement: All command output uses i18n
All slash command output (create wizard, evolve pipeline, feedback ratings, config display, model selection, recall results, source display, list output, help text) SHALL use `t()` for user-visible strings.

#### Scenario: Create wizard in English
- **WHEN** language is `en` and user runs `/create`
- **THEN** all wizard prompts, labels, confirmations SHALL be in English

#### Scenario: Evolve pipeline in Japanese
- **WHEN** language is `ja` and user runs `/evolve`
- **THEN** source selection labels, dimension options, pipeline step names SHALL be in Japanese

#### Scenario: Feedback ratings in configured language
- **WHEN** user runs `/feedback`
- **THEN** rating labels (很像本人/基本像/不太像/完全不像) SHALL be displayed in the configured language
