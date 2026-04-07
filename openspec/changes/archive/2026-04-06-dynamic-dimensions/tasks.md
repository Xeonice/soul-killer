## 1. DimensionDef Simplification

- [x] 1.1 DimensionSource from 'base'|'extension' to 'planned' only
- [x] 1.2 SOUL_BASE_DIMENSIONS → SOUL_DIMENSION_TEMPLATES + compat alias
- [x] 1.3 WORLD_BASE_DIMENSIONS → WORLD_DIMENSION_TEMPLATES + compat alias
- [x] 1.4 Updated all source='base'|'extension' references across project

## 2. Planning Agent Fully Dynamic

- [x] 2.1 Prompt rewritten: templates as reference, free to select/drop/add
- [x] 2.2 Removed "base dimensions cannot be deleted" validation
- [x] 2.3 applyPlan simplified: direct mapping from { dimensions: [...] } output
- [x] 2.4 All output dimensions source='planned'

## 3. Tests

- [x] 3.1 planning-agent tests updated for new { dimensions } format
- [x] 3.2 dimension-framework tests updated for TEMPLATES naming and source='planned'
- [x] 3.3 All 558 tests pass
