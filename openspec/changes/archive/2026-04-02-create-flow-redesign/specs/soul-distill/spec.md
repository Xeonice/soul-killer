## ADDED Requirements

### Requirement: Tag-guided extraction

The distillation extractor SHALL accept a `TagSet` parameter and incorporate it into the LLM extraction prompt as personality hints.

#### Scenario: Tags guide identity extraction

- **WHEN** extraction runs with tags containing `["INTJ"]`
- **THEN** the extraction prompt SHALL mention INTJ traits as a reference
- **THEN** the generated `identity.md` SHALL reflect analytical/strategic personality traits consistent with INTJ

#### Scenario: Tags guide style extraction

- **WHEN** extraction runs with tags containing `["话少", "冷幽默"]`
- **THEN** the extraction prompt SHALL hint at terse, dry-humor communication style
- **THEN** the generated `style.md` SHALL reflect concise expression with occasional sarcasm

#### Scenario: No tags provided

- **WHEN** extraction runs with an empty TagSet
- **THEN** the extraction prompt SHALL proceed without personality hints
- **THEN** extraction SHALL rely entirely on chunk content

### Requirement: Description-only distillation

The distillation pipeline SHALL produce valid soul files even when the only input is synthetic chunks from user description and tags (no real data chunks).

#### Scenario: Minimal input distillation

- **WHEN** distillation runs with only 1-2 synthetic chunks (from intake Q2 + Q3)
- **THEN** the system SHALL skip the sampling step (all chunks used directly)
- **THEN** the system SHALL generate `identity.md`, `style.md`, and at least one `behaviors/*.md`
- **THEN** generated files SHALL be marked as low-confidence (can be improved with more data)

#### Scenario: Mixed synthetic and real chunks

- **WHEN** distillation runs with synthetic chunks plus real data chunks (from markdown/twitter/agent)
- **THEN** synthetic chunks SHALL be included in the sampling pool alongside real chunks
- **THEN** real data chunks SHALL take priority when contradicting synthetic chunks
