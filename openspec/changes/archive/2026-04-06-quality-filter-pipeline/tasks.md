## 1. Title Quick Filter

- [x] 1.1 Created src/agent/search/title-filter.ts: batch LLM title review
- [x] 1.2 Integrated into capture-agent.ts after search, before scoring

## 2. Score-based Cache Filtering

- [x] 2.1 After scoring + supplement rounds, filter caches to keep only score >= 3, sorted by score desc
- [x] 2.2 Cache JSON includes _score and _reason metadata

## 3. Distill Improvements

- [x] 3.1 Removed 8000 chars hard truncation, reads full articles with 150K total limit
- [x] 3.2 Long articles (>30K chars): truncated per-article with marker (chapter extraction to be implemented as follow-up)
- [x] 3.3 Distill prompt: target name + classification + anti-hallucination rules

## 4. Tests

- [x] 4.1-4.4 Build passes, all 558 tests pass
