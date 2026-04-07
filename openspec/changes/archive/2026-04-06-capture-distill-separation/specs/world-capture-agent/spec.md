## ADDED Requirements

### Requirement: World system prompt 改为质量筛选模式
WORLD_SYSTEM_PROMPT SHALL 与 Soul 使用相同的质量筛选工作流，不做深度阅读和提取。

#### Scenario: prompt 工作流
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 逐维度评估 → 对照 qualityCriteria → 补充搜索 → reportFindings
- **AND** SHALL 注入每个维度的 qualityCriteria 和 minArticles
