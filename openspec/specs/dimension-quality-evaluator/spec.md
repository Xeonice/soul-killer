# dimension-quality-evaluator Specification

## Purpose
TBD - created by archiving change deterministic-capture-pipeline. Update Purpose after archive.
## Requirements
### Requirement: evaluateDimension 工具
Agent SHALL 拥有 evaluateDimension 工具，用于审查单个维度的搜索结果质量。

#### Scenario: 读取维度缓存并返回
- **WHEN** Agent 调用 evaluateDimension(dimensionName)
- **THEN** SHALL 从文件缓存读取该维度的所有搜索结果
- **AND** 返回每条结果的 title、url 和 content（content 截断到 1500 chars 作为预览）
- **AND** 返回该维度的 description 供 Agent 对照评估

#### Scenario: Agent 判断质量
- **WHEN** Agent 收到 evaluateDimension 的返回
- **THEN** Agent SHALL 判断内容是否充分覆盖该维度的 description
- **AND** 判断结果为 sufficient 或 needs_more

### Requirement: supplementSearch 工具
Agent SHALL 拥有 supplementSearch 工具，用于针对特定维度补充搜索。

#### Scenario: 补充搜索有上限
- **WHEN** Agent 调用 supplementSearch(dimensionName, query)
- **THEN** SHALL 执行搜索并将结果追加到该维度的文件缓存
- **AND** 每个维度的补充搜索次数 SHALL 不超过 2 次
- **AND** 超过上限时 SHALL 返回错误提示

#### Scenario: 补充结果去重
- **WHEN** supplementSearch 返回结果
- **THEN** SHALL 过滤掉该维度缓存中已存在的 URL

