# dimension-framework Specification

## Purpose
TBD - created by archiving change dynamic-dimensions. Update Purpose after archive.
## Requirements
### Requirement: DimensionSource 统一为 planned
DimensionDef.source SHALL 只有 'planned' 一种值，不再区分 base/extension。

#### Scenario: 所有维度来源统一
- **WHEN** Planning Agent 输出维度
- **THEN** 所有维度的 source 字段 SHALL 为 'planned'

### Requirement: 维度模版重命名
SOUL_BASE_DIMENSIONS 和 WORLD_BASE_DIMENSIONS SHALL 重命名为 SOUL_DIMENSION_TEMPLATES 和 WORLD_DIMENSION_TEMPLATES。

#### Scenario: 向后兼容
- **WHEN** 外部代码引用旧名称
- **THEN** SHALL 提供向后兼容的别名导出

