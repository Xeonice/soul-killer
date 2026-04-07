## ADDED Requirements

### Requirement: World 蒸馏 AgentLogger 集成
WorldDistiller 的 `distill()` 和 `distillFromCache()` 方法 SHALL 接受可选的 `agentLog?: AgentLogger` 参数。当传入时，所有 LLM 调用（classifyChunks、extractEntries、distillFromCache per-dimension、reviewEntries）SHALL 通过 AgentLogger 记录阶段、batch、耗时和输出长度。日志格式 SHALL 与 Soul Distill（extractor.ts）的记录模式一致。

#### Scenario: distill 方法记录完整日志
- **WHEN** 调用 `distiller.distill(worldName, sourcePath, adapterType, classification, dimensions, agentLog)` 且 agentLog 不为空
- **THEN** 日志文件 SHALL 包含 distillStart（模型、chunk 数）、每个 classify batch 的 distillBatch 记录、cluster 阶段的 distillPhase 记录、每个 extract 维度的 distillBatch 记录、review 阶段的 distillBatch 记录、以及 distillEnd 摘要

#### Scenario: distillFromCache 方法记录完整日志
- **WHEN** 调用 `distiller.distillFromCache(worldName, sessionDir, dimensionPlan, agentLog)` 且 agentLog 不为空
- **THEN** 日志文件 SHALL 包含每个维度的 distillBatch 记录和 review 阶段的记录

#### Scenario: agentLog 未传入时无副作用
- **WHEN** 调用 distill 或 distillFromCache 且 agentLog 为 undefined
- **THEN** 行为与修改前完全一致，不产生任何日志文件

### Requirement: World 蒸馏错误日志记录
WorldDistiller 中所有 `catch` 块 SHALL 在 agentLog 存在时记录错误信息（通过 `agentLog.toolInternal`）。catch 块 SHALL 保持不抛出异常的原有行为。

#### Scenario: classifyChunks JSON 解析失败记录日志
- **WHEN** classifyChunks 中 LLM 返回非法 JSON 且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息（包含原始 response 摘要）
- **AND** 该 batch 的 chunks 按 fallback 逻辑分类为 lore（行为不变）

#### Scenario: extractEntries JSON 解析失败记录日志
- **WHEN** extractEntries 中某维度的 LLM 返回非法 JSON 且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息
- **AND** 该维度使用 fallback entry（行为不变）

#### Scenario: distillFromCache 某维度失败记录日志
- **WHEN** distillFromCache 中某维度的 generateText 抛出异常且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息（包含维度名和错误消息）
- **AND** 该维度返回空数组（行为不变）

### Requirement: 调用方创建 AgentLogger
world-distill.tsx 和 world-create-wizard.tsx 中调用 WorldDistiller 的位置 SHALL 创建 AgentLogger 实例并传入 distill/distillFromCache 方法。AgentLogger 的 prompt 参数 SHALL 标明 "World Distill: {worldName}"。

#### Scenario: world-distill 命令创建日志
- **WHEN** 用户执行 `/world` → 管理 → 蒸馏
- **THEN** 蒸馏完成后 `~/.soulkiller/logs/agent/` 下 SHALL 存在对应的日志文件

#### Scenario: world-create-wizard 蒸馏步骤创建日志
- **WHEN** 用户通过世界创建向导进入蒸馏步骤
- **THEN** 蒸馏完成后 `~/.soulkiller/logs/agent/` 下 SHALL 存在对应的日志文件
