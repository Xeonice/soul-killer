## MODIFIED Requirements

### Requirement: planSearch tool
Agent SHALL 提供 `planSearch` tool。tool 的 execute 函数 SHALL 从 DimensionPlan 读取维度和 queries，而非模板填充。

#### Scenario: planSearch 返回 DimensionPlan 的 queries
- **WHEN** LLM 调用 planSearch
- **THEN** execute 函数 SHALL 从传入的 DimensionPlan 读取每个维度的 queries
- **AND** SHALL 返回包含所有维度(基础+扩展)的搜索计划

#### Scenario: planSearch 不再做模板替换
- **WHEN** planSearch execute 执行
- **THEN** SHALL 直接返回 DimensionPlan 中已生成好的 queries
- **AND** SHALL 不再使用 `{name}/{localName}/{origin}` 模板占位符替换
