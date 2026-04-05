## MODIFIED Requirements

### Requirement: Distill pipeline supports optional logging
The `extractFeatures` function SHALL accept an optional `agentLog?: AgentLogger` parameter and log each batch LLM call and merge operation when provided.

#### Scenario: Batch logging
- **WHEN** `extractFeatures` is called with an `agentLog` and processes batch 3 of 7 for identity extraction
- **THEN** `agentLog.distillBatch('identity', 3, 7, durationMs, outputLen)` is called after the batch completes

#### Scenario: Merge logging
- **WHEN** identity extraction has multiple batches and merge is called
- **THEN** `agentLog.distillMerge('identity', batchCount, durationMs, outputLen)` is called after merge

#### Scenario: No logger provided
- **WHEN** `extractFeatures` is called without an `agentLog`
- **THEN** the function behaves identically to before (no logging side effects)
