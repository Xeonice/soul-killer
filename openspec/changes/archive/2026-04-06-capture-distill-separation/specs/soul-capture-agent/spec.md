## ADDED Requirements

### Requirement: Soul system prompt 改为质量筛选模式
SOUL_SYSTEM_PROMPT SHALL 指导 Agent 逐维度评估文章质量，对照 qualityCriteria 判断，不做深度阅读和提取。

#### Scenario: prompt 工作流
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 逐维度 evaluateDimension → 对照 qualityCriteria 判断 → 不足则 supplementSearch → reportFindings
- **AND** SHALL 注入每个维度的 qualityCriteria 和 minArticles
- **AND** SHALL 不包含深度阅读或提取指令
