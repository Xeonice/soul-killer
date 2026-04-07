## MODIFIED Requirements

### Requirement: Soul system prompt 注入动态维度
SOUL_SYSTEM_PROMPT SHALL 通过方法动态注入 DimensionPlan 的维度描述，与 World 使用相同机制。

#### Scenario: system prompt 包含所有维度描述
- **WHEN** 构建 soul capture agent 的 system prompt
- **THEN** SHALL 列出 DimensionPlan 中所有维度(基础+扩展)的 name、description、priority
- **AND** 扩展维度 SHALL 与基础维度以相同格式呈现

#### Scenario: reportFindings dimension enum 动态构建
- **WHEN** 构建 reportFindings tool schema
- **THEN** dimension 字段的 z.enum SHALL 从 DimensionPlan.dimensions.map(d => d.name) 构建
