## ADDED Requirements

### Requirement: World system prompt 重写为质量评估模式
WORLD_SYSTEM_PROMPT SHALL 从搜索指令改为质量评估指令，与 Soul 保持一致的模式。

#### Scenario: prompt 内容
- **WHEN** 构建 world capture agent 的 system prompt
- **THEN** SHALL 指示 Agent 逐维度调用 evaluateDimension 审查搜索结果
- **AND** SHALL 指示 Agent 在数据不足时用 supplementSearch 补充
- **AND** SHALL 指示 Agent 审查完所有维度后调用 reportFindings
- **AND** SHALL 不包含任何搜索策略指令
