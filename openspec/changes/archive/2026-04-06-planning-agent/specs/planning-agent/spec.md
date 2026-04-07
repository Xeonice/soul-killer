## ADDED Requirements

### Requirement: Planning Agent 独立 LLM 调用
系统 SHALL 提供 `runPlanningAgent()` 函数，在 capture agent 启动前执行单次 LLM 调用生成维度计划。

#### Scenario: Planning Agent 输入
- **WHEN** 调用 runPlanningAgent
- **THEN** SHALL 接收 type('soul'|'world')、name、hint、preSearchResults、classification 作为输入
- **AND** SHALL 从 type 获取对应的基础维度列表

#### Scenario: Planning Agent 输出结构
- **WHEN** LLM 返回结果
- **THEN** SHALL 解析为两部分: adjustments(基础维度调整) + extensions(扩展维度)
- **AND** adjustments SHALL 只允许修改 priority 和 description，不允许删除基础维度
- **AND** extensions SHALL 包含完整的 DimensionDef 字段

#### Scenario: 扩展维度数量约束
- **WHEN** 解析 Planning Agent 输出
- **THEN** extensions 数量 SHALL 在 0-6 之间
- **AND** 基础维度 + 扩展维度总数 SHALL 不超过 15

#### Scenario: Planning Agent 失败阻断
- **WHEN** LLM 返回无法解析的 JSON 或校验失败
- **THEN** SHALL 抛出错误，不做 fallback
- **AND** 调用方 SHALL 将错误传递到 UI 层，提示用户重试

### Requirement: Planning Prompt 内容
Planning Agent 的 system prompt SHALL 包含基础维度定义、调整规则、扩展规则和输出格式要求。

#### Scenario: prompt 包含基础维度
- **WHEN** 构造 planning prompt
- **THEN** SHALL 列出所有基础维度的 name/description/priority
- **AND** SHALL 明确标注"不可删除"

#### Scenario: prompt 包含扩展规则
- **WHEN** 构造 planning prompt
- **THEN** SHALL 要求每个扩展维度提供 name、display、description、priority、signals(5-10 个关键词)、queries(2-4 条)
- **AND** SHALL 要求 signals 包含中英文混合关键词

#### Scenario: prompt 包含侦察结果
- **WHEN** 构造 planning prompt
- **THEN** SHALL 包含 pre-search 结果的标题和摘要(前 8 条)
- **AND** SHALL 包含 name 和 hint

### Requirement: 维度计划持久化
Planning Agent 生成的 DimensionPlan SHALL 写入对应的 manifest(world.json 或 soul manifest)。

#### Scenario: 写入 manifest
- **WHEN** Planning Agent 成功生成 DimensionPlan
- **THEN** SHALL 将 dimensions 数组写入 manifest 的 dimensions 字段

#### Scenario: evolve 不重新规划
- **WHEN** 执行 evolve 操作
- **THEN** SHALL 从 manifest 读取已有 dimensions，不触发 Planning Agent

#### Scenario: 向后兼容
- **WHEN** 读取没有 dimensions 字段的旧 manifest
- **THEN** SHALL 使用对应类型(soul/world)的基础维度作为默认值
