## 1. Search Engine Adjustments

- [x] 1.1 Exa maxCharacters 3000 -> 10000
- [x] 1.2 extractPage removed from capture agent tool set

## 2. Deterministic Search Executor

- [x] 2.1 Code loop executes all DimensionPlan queries before agent runs
- [x] 2.2 Results cached per dimension in ~/.soulkiller/cache/search/{sessionId}/{dim}.json
- [x] 2.3 Progress events emitted during search execution

## 3. Agent Tool Set Refactor

- [x] 3.1 evaluateDimension tool: reads dimension cache, returns preview
- [x] 3.2 supplementSearch tool: targeted supplements with 2/dim limit + URL dedup
- [x] 3.3 reportFindings tool retained
- [x] 3.4 search/planSearch/checkCoverage/readSearchDetails removed
- [x] 3.5 Old code cleaned up (decomposeQuery, searchCache, etc.)

## 4. System Prompt Rewrite

- [x] 4.1 SOUL_SYSTEM_PROMPT: quality evaluation mode
- [x] 4.2 WORLD_SYSTEM_PROMPT: quality evaluation mode
- [x] 4.3 buildSystemPrompt injects dimension list with cached result counts

## 5. Capture Agent Flow Refactor

- [x] 5.1 runCaptureAgent: Pre-search -> Planning -> Deterministic Search -> Agent(evaluate+extract)
- [x] 5.2 ToolLoopAgent tools = evaluateDimension + supplementSearch + reportFindings
- [x] 5.3 toolChoice required, maxSteps 30
- [x] 5.4 reportFindings backup fallback retained

## 6. Tests

- [x] 6.1 evaluateDimension tests: cache read, empty dimension
- [x] 6.2 supplementSearch tests: append to cache, limit enforcement, URL dedup
- [x] 6.3 Existing tests updated for new API
