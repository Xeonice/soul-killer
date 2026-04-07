## 1. DimensionDef Extension

- [x] 1.1 Added qualityCriteria: string[] and minArticles: number to DimensionDef
- [x] 1.2 Added defaults to SOUL_BASE_DIMENSIONS and WORLD_BASE_DIMENSIONS

## 2. Planning Agent

- [x] 2.1 Planning prompt requires qualityCriteria and minArticles per dimension
- [x] 2.2 Extension dimensions get default qualityCriteria/minArticles
- [x] 2.3 JSON parsing handles new fields

## 3. Capture Agent Simplification

- [x] 3.1 Deleted read-full-result.ts
- [x] 3.2 Deleted extract-dimension.ts
- [x] 3.3 tools/index.ts: only evaluateDimension + supplementSearch + reportFindings
- [x] 3.4 report-findings.ts: dimensionStatus replaces extractions
- [x] 3.5 capture-agent.ts: CaptureResult returns sessionDir, no chunks
- [x] 3.6 maxSteps = dimCount * 2 + 5

## 4. System Prompt

- [x] 4.1 SOUL_SYSTEM_PROMPT: quality filtering with qualityCriteria
- [x] 4.2 WORLD_SYSTEM_PROMPT: same
- [x] 4.3 buildSystemPrompt injects qualityCriteria and minArticles per dimension

## 5. Distill Refactor

- [x] 5.1 Added distillFromCache(worldName, sessionDir, dimensionPlan)
- [x] 5.2 Per-dimension parallel LLM extraction (concurrency 5)
- [x] 5.3 Reuses reviewEntries for dedup
- [x] 5.4 Existing distill() preserved for markdown/URL sources

## 6. world-create-wizard Adaptation

- [x] 6.1 Web-search path uses distillFromCache(sessionDir, dimensionPlan)
- [x] 6.2 Removed agentChunks → tmp .md → distill roundtrip
- [x] 6.3 UI displays chunkCount instead of agentChunks.length

## 7. Tests

- [x] 7.1 Updated agent-logger test for new CaptureResult (sessionDir replaces chunks)
- [x] 7.2 All 557 unit + 35 integration tests pass
