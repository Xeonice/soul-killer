## ADDED Requirements

### Requirement: Agent-driven distillation with tool loop
The system SHALL provide a `distillSoul` function that uses a `ToolLoopAgent` to autonomously distill raw chunks into soul files (identity.md, style.md, behaviors/*.md, examples/*.md) through tool calling.

#### Scenario: Successful distillation
- **WHEN** `distillSoul` is called with chunks for a target
- **THEN** the agent samples chunks, writes identity.md, style.md, behavior files, example files, reviews for consistency, and calls finalize

#### Scenario: Agent forced to finalize at max steps
- **WHEN** the agent reaches maxSteps - 1 without calling finalize
- **THEN** prepareStep forces toolChoice to finalize

### Requirement: sampleChunks tool
The sampleChunks tool SHALL return a subset of chunks, optionally filtered by dimension, with a configurable limit.

#### Scenario: Filter by dimension
- **WHEN** sampleChunks is called with dimension "quotes"
- **THEN** only chunks with matching extraction_step are returned

#### Scenario: Dimension not found fallback
- **WHEN** sampleChunks is called with a dimension that no chunks match
- **THEN** a general sample of all chunks is returned

### Requirement: writeIdentity tool
The writeIdentity tool SHALL write identity.md with a "# Identity" prefix.

#### Scenario: Write identity
- **WHEN** writeIdentity is called with content
- **THEN** `soulDir/soul/identity.md` is created and character count returned

### Requirement: writeStyle tool
The writeStyle tool SHALL write style.md with a "# Style" prefix. The system prompt SHALL guide the agent to include a raw quotes/expressions section preserving original dialogue.

#### Scenario: Write style with quotes section
- **WHEN** writeStyle is called
- **THEN** the content includes both analytical style description and a section with preserved original quotes/expressions

### Requirement: writeBehavior tool
The writeBehavior tool SHALL write a behavior file with auto-slugified name.

#### Scenario: Write behavior
- **WHEN** writeBehavior is called with name "Honor Code"
- **THEN** `soulDir/soul/behaviors/honor-code.md` is created

### Requirement: writeExample tool
The writeExample tool SHALL write a conversation example file to the examples directory.

#### Scenario: Write greeting example
- **WHEN** writeExample is called with scenario "greeting" and messages [{role:"user", content:"你好"}, {role:"character", content:"吾乃骑士王..."}]
- **THEN** `soulDir/examples/greeting.md` is created with formatted dialogue

#### Scenario: Multiple examples generated
- **WHEN** the agent completes distillation
- **THEN** at least 3 example files are generated covering different conversation types

### Requirement: reviewSoul tool
The reviewSoul tool SHALL read back all written soul files AND example files for self-inspection.

#### Scenario: Review includes examples
- **WHEN** reviewSoul is called after writing examples
- **THEN** the response includes identity, style, behaviors, and examples content

### Requirement: finalize tool ends distillation
The finalize tool SHALL signal the end of the distillation loop.

#### Scenario: Agent calls finalize
- **WHEN** the agent calls finalize
- **THEN** the tool loop stops and distillSoul returns

### Requirement: System prompt guides style quotes and relationships
The system prompt SHALL instruct the agent to include original quotes in style.md and to create a relationships behavior file when relation data is available.

#### Scenario: Style includes quotes section
- **WHEN** the agent writes style.md
- **THEN** the system prompt has guided it to include a "典型表达" or "Characteristic Expressions" section with direct quotes

#### Scenario: Relationships behavior created
- **WHEN** relation dimension data is available in chunks
- **THEN** the agent is guided to create a relationships.md behavior file
