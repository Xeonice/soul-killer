## REMOVED Requirements

### Requirement: Auto-classify target type
**Reason**: 分类不再作为独立步骤存在。LLM 在自主搜索过程中自然形成分类判断，通过 reportFindings tool 返回分类结果。
**Migration**: 分类信息从 `result.staticToolCalls[0].args.classification` 获取。

### Requirement: 4-step soul capture workflow
**Reason**: 固定 4 步管线（deterministic_search → llm_classify → strategy_deep_search → convert_chunks）被 ToolLoopAgent 自主循环替代。
**Migration**: 使用 `agent-tool-loop` capability 中定义的 ToolLoopAgent 循环。

### Requirement: DIGITAL_CONSTRUCT gathering strategy
**Reason**: 硬编码的分类→策略映射不再需要。LLM 根据 system prompt 自主决定搜索方向。
**Migration**: 搜索策略指导集成在 agent 的 system prompt 中。

### Requirement: PUBLIC_ENTITY gathering strategy
**Reason**: 同上。
**Migration**: 搜索策略指导集成在 agent 的 system prompt 中。

### Requirement: HISTORICAL_RECORD gathering strategy
**Reason**: 同上。
**Migration**: 搜索策略指导集成在 agent 的 system prompt 中。

### Requirement: Agent uses manual loop with realtime progress
**Reason**: 手动 agent loop 被 ToolLoopAgent 替代。Progress 事件通过 onStepFinish 回调发送。
**Migration**: 使用 ToolLoopAgent 的 onStepFinish 回调映射 CaptureProgress 事件。

### Requirement: Agent uses classification-specific search queries
**Reason**: 预定义搜索查询模板不再需��。LLM 自主决定搜索关键词。
**Migration**: 搜索策略指导集成在 agent 的 system prompt 中。

### Requirement: Two-round search strategy
**Reason**: 两轮搜索策略被 LLM 自主多步搜索替代���LLM 可以自由决定搜索轮次和策略切换时机。
**Migration**: 无需特定迁移，ToolLoopAgent 自然支持多步搜索。

## MODIFIED Requirements

### Requirement: UNKNOWN_ENTITY fallback behavior
WHEN 搜索结果不足以进行有意义的提取时，agent SHALL 通过 reportFindings 返回空 extractions 和 UNKNOWN_ENTITY 分类。

#### Scenario: 搜索无果触发 UNKNOWN_ENTITY
- **WHEN** agent 多次搜索后未找到关于目标的有意义信息
- **THEN** agent 调用 reportFindings，classification 为 UNKNOWN_ENTITY，extractions 为空数组
- **AND** 系统 SHALL 将用户引导至手动数据源选择模式

### Requirement: Hint parameter in captureSoul
`captureSoul()` 函数 SHALL 接受可选的 `hint?: string` 参数。hint SHALL 作为额外上下文拼接到 agent 的 user message 中，帮助 LLM 更准确地定位目标。

#### Scenario: Hint 作为上下文传递给 agent
- **WHEN** `captureSoul("大卫·马丁内斯", config, onProgress, "cyberpunk edge runner 的主角")` 被调用
- **THEN** agent 的 user message 中包含 hint 信息
- **AND** LLM 利用 hint 来引导初始搜索方向

### Requirement: Agent extracts and uses English name
Agent SHALL 在搜索过程中自主识别并使用目标的英文名进行后续搜索。此行为由 system prompt 引导，不再依赖代码逻辑提取。

#### Scenario: 中文名映射到英文
- **WHEN** 用户输入 "强尼银手"，agent 从 Wikipedia 搜索结果中发现 "Johnny Silverhand"
- **THEN** agent 自主使用 "Johnny Silverhand" 进行后续英文搜索

### Requirement: Max iterations prevent infinite loop
Agent 的 ToolLoopAgent SHALL 配置 `stopWhen: stepCountIs(30)`，确保循环不会无限执行。

#### Scenario: 30 步上限
- **WHEN** agent 已执行 30 步
- **THEN** 循环强制停止，无论 LLM 是否调用了 reportFindings
