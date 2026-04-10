## ADDED Requirements

### Requirement: inputExamples for all tools with array parameters
Every tool definition that uses `z.array()` in its `inputSchema` SHALL include at least one `inputExamples` entry providing a complete, correctly-formatted input object.

#### Scenario: set_prose_style has inputExamples
- **WHEN** the `set_prose_style` tool is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `ip_specific` is a real JavaScript array (not a string)
- **AND** the example array SHALL contain at least 3 elements

#### Scenario: set_story_metadata has inputExamples
- **WHEN** the `set_story_metadata` tool is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `constraints` is a real JavaScript array

#### Scenario: plan_story has inputExamples
- **WHEN** the `plan_story` tool is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `flags` is a real JavaScript array

#### Scenario: supplement_search has inputExamples
- **WHEN** the `createSupplementSearchTool` tool is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `keywords` is a real JavaScript array

#### Scenario: report_findings has inputExamples
- **WHEN** the `createReportFindingsTool` tool is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `dimensionStatus` is a real JavaScript array of objects

#### Scenario: writeExample has inputExamples
- **WHEN** the `writeExampleTool` is defined
- **THEN** it SHALL include `inputExamples` with at least one entry where `messages` is a real JavaScript array of objects

### Requirement: strict mode on critical export tools
Export tools with high failure frequency SHALL enable `strict: true` to leverage provider-side schema enforcement.

#### Scenario: set_prose_style uses strict mode
- **WHEN** the `set_prose_style` tool is defined
- **THEN** it SHALL have `strict: true`

#### Scenario: set_story_metadata uses strict mode
- **WHEN** the `set_story_metadata` tool is defined
- **THEN** it SHALL have `strict: true`

### Requirement: shared repairToolCall on all ToolLoopAgent instances
All `ToolLoopAgent` constructions SHALL include `experimental_repairToolCall` with a shared repair function that fixes string-encoded array arguments.

#### Scenario: repair function fixes string-encoded array
- **WHEN** a tool call contains a parameter value that is a string starting with `[` and ending with `]`
- **THEN** the repair function SHALL attempt to parse it as a JSON array
- **AND** if JSON.parse fails, SHALL attempt regex-based extraction
- **AND** return a repaired tool call with the parameter as a real array

#### Scenario: repair function ignores non-array errors
- **WHEN** the error is `NoSuchToolError`
- **THEN** the repair function SHALL return null (do not attempt repair)

#### Scenario: repair function returns null when unfixable
- **WHEN** the string parameter cannot be parsed as an array by any strategy
- **THEN** the repair function SHALL return null

### Requirement: remove z.preprocess workarounds
All `z.preprocess(coerceStringArray/coerceObjectArray, ...)` wrappers previously added to tool inputSchemas SHALL be removed, restoring pure `z.array()` definitions.

#### Scenario: no z.preprocess in tool schemas
- **WHEN** any tool inputSchema is inspected
- **THEN** it SHALL NOT contain `z.preprocess` wrappers for array coercion
- **AND** the `zod-preprocess.ts` utility module SHALL be deleted
