## MODIFIED Requirements

### Requirement: Planning Agent 生成 qualityCriteria
Planning Agent 的输出 SHALL 为每个维度（含 base 和 extension）包含 qualityCriteria 和 minArticles。

#### Scenario: prompt 包含质量标准生成要求
- **WHEN** 构造 planning prompt
- **THEN** SHALL 要求每个维度生成 2-4 条文章质量标准
- **AND** SHALL 要求指定 minArticles（required 维度 3-5，supplementary 维度 2-3）

#### Scenario: 输出 JSON 包含新字段
- **WHEN** 解析 Planning Agent 输出
- **THEN** extensions 的每个维度 SHALL 包含 qualityCriteria 数组和 minArticles 数字
- **AND** adjustments SHALL 可选覆盖 base 维度的 qualityCriteria 和 minArticles
