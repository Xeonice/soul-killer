## MODIFIED Requirements

### Requirement: Conversation system loads examples as few-shot
The `assembleContext` and `buildLegacyPrompt` functions SHALL read example files from `soulDir/examples/*.md` and inject them into the system prompt as few-shot conversation examples.

#### Scenario: Examples injected into system prompt
- **WHEN** a soul has 3 example files in examples/
- **THEN** the system prompt includes an "## Examples" section after behaviors, containing all example conversations

#### Scenario: No examples directory
- **WHEN** a soul has no examples/ directory or it is empty
- **THEN** the system prompt is generated without an Examples section (backward compatible)

### Requirement: loadSoulFiles returns examples
The `loadSoulFiles` function SHALL return an `examples` field containing all example file contents.

#### Scenario: Load soul with examples
- **WHEN** loadSoulFiles is called for a soul with 3 example files
- **THEN** the result includes `examples: { "greeting": "...", "conflict": "...", "philosophy": "..." }`

#### Scenario: Load soul without examples
- **WHEN** loadSoulFiles is called for a soul with no examples
- **THEN** the result includes `examples: {}` (empty object)
