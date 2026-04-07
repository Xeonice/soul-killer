## ADDED Requirements

### Requirement: Batch pipeline executes souls in parallel with concurrency limit
The batch pipeline SHALL accept an array of `SoulInput` (name + description) and execute each through the full capture → distill flow. The maximum concurrent executions SHALL be 3.

#### Scenario: Three souls submitted
- **WHEN** the user submits 3 souls for batch creation
- **THEN** all 3 begin capture simultaneously (up to concurrency limit of 3)

#### Scenario: Five souls submitted
- **WHEN** the user submits 5 souls for batch creation
- **THEN** 3 begin immediately, and the remaining 2 start as slots become available

### Requirement: Pipeline uses flow-style execution
Each soul SHALL progress independently through capture → distill. When a soul's capture completes, its distill SHALL begin immediately without waiting for other souls to finish capture.

#### Scenario: Soul A finishes capture before Soul B
- **WHEN** Soul A's capture completes while Soul B is still capturing
- **THEN** Soul A's distill begins immediately, Soul B continues capturing

### Requirement: Pipeline emits per-soul progress events
The pipeline SHALL emit progress events tagged with the soul name, allowing the UI to track each soul's status independently. Events SHALL include: phase changes, tool calls, classification, chunks extracted, errors.

#### Scenario: Progress event emitted during capture
- **WHEN** Soul A's capture agent makes a search tool call
- **THEN** a progress event is emitted with `{ soulName: 'A', type: 'tool_call', ... }`

#### Scenario: Phase transition event
- **WHEN** Soul A transitions from capturing to distilling
- **THEN** a progress event is emitted with `{ soulName: 'A', phase: 'distilling' }`

### Requirement: Pipeline isolates failures
A single soul's failure SHALL NOT affect other souls in the batch. Failed souls SHALL be recorded with their error message.

#### Scenario: One soul fails during capture
- **WHEN** Soul B's capture throws a rate limit error while A and C are running
- **THEN** Soul B is marked as failed with the error message, Soul A and C continue normally

#### Scenario: One soul fails during distill
- **WHEN** Soul A's distill throws an error after successful capture
- **THEN** Soul A is marked as failed, its captured chunks are preserved for retry

### Requirement: Pipeline supports retry of failed souls
The pipeline SHALL accept a list of failed soul names and re-execute them through the full capture → distill flow.

#### Scenario: Retry two failed souls
- **WHEN** the user selects "retry failed" with 2 failed souls
- **THEN** both failed souls are re-queued and executed through the pipeline (respecting concurrency limit)

### Requirement: Pipeline reports final batch result
When all souls complete (success or failure), the pipeline SHALL return a `BatchResult` containing per-soul status, chunk counts, classification, elapsed time, and error messages.

#### Scenario: Batch completes with mixed results
- **WHEN** 3 souls finish: 2 succeed, 1 fails
- **THEN** `BatchResult` contains 2 entries with status 'done' (chunks, classification) and 1 entry with status 'failed' (error message)
