## ADDED Requirements

### Requirement: CaptureStrategy 接口
系统 SHALL 定义 `CaptureStrategy` 接口，包含以下方法：`type`（'soul' | 'world'）、`systemPrompt`（string）、`buildUserMessage(name, hint?)`、`getClassificationLabels()`、`getDimensionDefs()`、`generateSearchPlan(classification, englishName, localName, origin)`、`analyzeCoverage(extractions)`、`processResult(rawResult)`。

#### Scenario: Soul 策略实现 CaptureStrategy
- **WHEN** 创建 `SoulCaptureStrategy` 实例
- **THEN** 其 type 为 `'soul'`，systemPrompt 包含 Soul 6 维度的搜索指引

### Requirement: 通用 capture agent 循环
系统 SHALL 提供 `runCaptureAgent(strategy, name, config, onProgress?, hint?)` 函数，封装 ToolLoopAgent 配置、stream 消费、doom loop 检测、progress 事件发送等共享逻辑。Soul 和 World 的 capture 函数 SHALL 委托给此通用函数。

#### Scenario: captureSoul 委托给通用 agent
- **WHEN** 调用 `captureSoul(name, config, onProgress)`
- **THEN** 内部调用 `runCaptureAgent(new SoulCaptureStrategy(), name, config, onProgress)`

### Requirement: SoulCaptureStrategy 提取
现�� `captureSoul` 的系统提示词、维度定义、搜索模板、coverage 分析 SHALL 提取为 `SoulCaptureStrategy` 类，不改变行为。

#### Scenario: 重构后 captureSoul 行为不变
- **WHEN** 使用重构后的 captureSoul 搜索 "Johnny Silverhand"
- **THEN** 返回结果与重构前行为一致（相同的 classification、chunk 格式、progress 事件）

## MODIFIED Requirements

### Requirement: Hint parameter in captureSoul
`captureSoul()` 函数 SHALL 接受可选的 `hint?: string` 参数。hint SHALL 作为额外上下文拼接到 agent �� user message 中��帮助 LLM 更准确地定位目标。内部 SHALL 通��� `strategy.buildUserMessage(name, hint)` 生成 user message。

#### Scenario: 带 hint 的搜索
- **WHEN** 调用 `captureSoul('V', config, undefined, 'Cyberpunk 2077 主角')`
- **THEN** strategy.buildUserMessage 生成包含 hint 的 user message，传入通用 agent
