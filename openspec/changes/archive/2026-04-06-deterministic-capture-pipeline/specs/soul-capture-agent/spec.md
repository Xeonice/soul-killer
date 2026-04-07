## ADDED Requirements

### Requirement: Soul system prompt 重写为质量评估模式
SOUL_SYSTEM_PROMPT SHALL 从搜索指令改为质量评估指令。

#### Scenario: prompt 内容
- **WHEN** 构建 soul capture agent 的 system prompt
- **THEN** SHALL 指示 Agent 逐维度调用 evaluateDimension 审查搜索结果
- **AND** SHALL 指示 Agent 在数据不足时用 supplementSearch 补充
- **AND** SHALL 指示 Agent 审查完所有维度后调用 reportFindings
- **AND** SHALL 不包含任何搜索策略指令（搜索由代码层完成）
