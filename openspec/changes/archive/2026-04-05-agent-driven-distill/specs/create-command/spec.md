## MODIFIED Requirements

### Requirement: Distill step uses agent-driven distillation
The create command's `startDistill` function SHALL call `distillSoul` (agent-driven) instead of `extractFeatures` (fixed pipeline). Soul files are written by the agent's tools, so `generateSoulFiles` is no longer called separately.

#### Scenario: Create flow distill step
- **WHEN** distillation starts in the create flow
- **THEN** `distillSoul(name, chunks, soulDir, config, tags, onProgress, agentLog)` is called and the agent writes files via tools

### Requirement: Distill panel shows dynamic tool calls
The distillation UI SHALL display a dynamic list of agent tool calls with status indicators, replacing the fixed 5-phase progress panel.

#### Scenario: Dynamic distill panel
- **WHEN** the agent calls sampleChunks, writeIdentity, reviewSoul in sequence
- **THEN** each tool call appears as a line item with icon, name, result summary, and done/spinner indicator
