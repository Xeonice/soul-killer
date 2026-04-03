## ADDED Requirements

### Requirement: Tag taxonomy definition

The system SHALL define a tag taxonomy with the following categories: `personality` (性格内核), `communication` (沟通风格), `values` (价值取向), `behavior` (行为模式), `domain` (领域标签). Each category SHALL contain a set of predefined anchor tags as reference points.

#### Scenario: Taxonomy structure

- **WHEN** the tag system is initialized
- **THEN** it SHALL expose a taxonomy object with 5 categories
- **THEN** each category SHALL contain at least 5 predefined anchor tags
- **THEN** the `personality` category SHALL include sub-groups for MBTI, Enneagram, and free-form traits

### Requirement: Tag parsing from natural language

The system SHALL parse a natural language string (user's Q3 input) into a structured `TagSet` by calling the LLM. The parser SHALL match known anchor tags AND extract custom tags not in the taxonomy.

#### Scenario: Parsing mixed input

- **WHEN** the parser receives "INTJ 话少 冷幽默 技术洁癖"
- **THEN** it SHALL return a `TagSet` containing:
  - `personality`: `["INTJ"]`
  - `communication`: `["话少", "冷幽默"]`
  - `behavior`: `["技术洁癖"]`

#### Scenario: Parsing with unknown tags

- **WHEN** the parser receives "爱用比喻 反复横跳 喜欢抬杠"
- **THEN** known tags SHALL be categorized (e.g., "反复横跳" → `behavior`)
- **THEN** unknown tags SHALL be placed in the most likely category or as `custom` tags

#### Scenario: Empty or skipped input

- **WHEN** the parser receives an empty string
- **THEN** it SHALL return an empty `TagSet` with all categories as empty arrays

### Requirement: Tag storage in soul package

Tags SHALL be stored in `manifest.json` under a `tags` field as a `TagSet` object (category → string array mapping).

#### Scenario: Tags written to manifest

- **WHEN** a soul package is created with parsed tags
- **THEN** `manifest.json` SHALL contain a `tags` field with the full `TagSet`

### Requirement: Tags consumed by distillation

The distillation process SHALL receive the `TagSet` and use it to guide LLM feature extraction prompts.

#### Scenario: Tags influence extraction

- **WHEN** distillation runs with tags `["INTJ", "话少", "冷幽默"]`
- **THEN** the extraction prompt SHALL include these tags as personality hints
- **THEN** the extracted identity/style SHALL reflect the tagged traits
