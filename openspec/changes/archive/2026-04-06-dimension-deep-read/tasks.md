## 1. Tool File Structure Refactor

- [x] 1.1 Created directories: search/, planning/, strategy/
- [x] 1.2 Moved search backends to search/
- [x] 1.3 Moved planning files to planning/
- [x] 1.4 Moved strategy files to strategy/
- [x] 1.5 Updated all import paths (25 files)
- [x] 1.6 Split search-factory.ts into:
  - tools/evaluate-dimension.ts
  - tools/read-full-result.ts
  - tools/extract-dimension.ts
  - tools/supplement-search.ts
  - tools/report-findings.ts
  - tools/index.ts

## 2. New Tools

- [x] 2.1 readFullResult: reads single result full content (3000 chars max)
- [x] 2.2 extractDimension: accumulates extractions per dimension into buffer
- [x] 2.3 reportFindings: merges extractionBuffer with inline extractions

## 3. System Prompt Update

- [x] 3.1 SOUL_SYSTEM_PROMPT: evaluate → read(3x) → extract → next → report
- [x] 3.2 WORLD_SYSTEM_PROMPT: same deep-read workflow

## 4. Capture Agent Adjustments

- [x] 4.1 maxSteps = dimCount * 5 + 5, max 80
- [x] 4.2 prepareStep force at dimCount * 4 + 3
- [x] 4.3 extractionBuffer merged into final CaptureResult

## 5. Tests

- [x] 5.1 evaluateDimension tests pass
- [x] 5.2 supplementSearch tests updated for new return format
- [x] 5.3 All 557 tests pass, 0 failed
