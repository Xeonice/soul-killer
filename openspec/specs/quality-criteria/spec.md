# quality-criteria Specification

## Purpose
TBD - created by archiving change capture-distill-separation. Update Purpose after archive.
## Requirements
### Requirement: DimensionDef 包含质量评分标准
DimensionDef SHALL 包含 qualityCriteria 和 minArticles 字段，由 Planning Agent 生成。

#### Scenario: qualityCriteria 内容
- **WHEN** Planning Agent 生成维度计划
- **THEN** 每个维度 SHALL 包含 2-4 条质量标准描述
- **AND** 标准 SHALL 具体到文章需要包含什么类型的信息

#### Scenario: minArticles 按优先级不同
- **WHEN** 维度 priority 为 required
- **THEN** minArticles SHALL 为 3-5
- **WHEN** 维度 priority 为 supplementary
- **THEN** minArticles SHALL 为 2-3

#### Scenario: Capture Agent 按标准评估
- **WHEN** Capture Agent 调用 evaluateDimension
- **THEN** system prompt SHALL 包含该维度的 qualityCriteria
- **AND** Agent SHALL 对照标准判断每篇文章是否合格

