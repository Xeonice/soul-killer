## ADDED Requirements

### Requirement: World system prompt 增加深度阅读工作流
WORLD_SYSTEM_PROMPT SHALL 与 Soul 使用相同的深度阅读工作流指令。

#### Scenario: prompt 工作流指令
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 对每个维度执行 evaluate → read → extract 循环
- **AND** 最后调 reportFindings 汇总
