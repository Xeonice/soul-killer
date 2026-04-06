# Soul Capture Agent

### Requirement: UNKNOWN_ENTITY fallback behavior
WHEN 搜索结果不足以进行有意义的提取时，agent SHALL 通过 reportFindings 返回空 extractions 和 UNKNOWN_ENTITY 分类。

#### Scenario: 搜索无果触发 UNKNOWN_ENTITY
- **WHEN** agent 多次搜索后未找到关于目标的有意义信息
- **THEN** agent 调用 reportFindings，classification 为 UNKNOWN_ENTITY，extractions 为空数组
- **AND** 系统 SHALL 将用户引导至手动数据源选择模式

---

### Requirement: OpenRouter via Vercel AI SDK

The agent SHALL use OpenRouter as its LLM provider through the Vercel AI SDK.

#### Scenario: LLM provider configuration

- WHEN the agent initializes
- THEN it MUST use @ai-sdk/openai with a custom baseURL pointing to OpenRouter
- THEN API authentication MUST use the configured OpenRouter API key

---

### Requirement: Tavily API key optional

The Tavily API key SHALL be optional. When absent, the agent is skipped entirely.

#### Scenario: No Tavily API key configured

- WHEN the Tavily API key is not present in configuration
- THEN the soul capture agent MUST NOT be invoked
- THEN the system SHALL proceed directly to manual data source selection mode

#### Scenario: Tavily API key present

- WHEN the Tavily API key is present in configuration
- THEN the soul capture agent SHALL be invoked as the first step of the /create flow

---

### Requirement: Search results include full page content
After DuckDuckGo search returns URLs, the agent SHALL use the page extractor to fetch full content for the top 3 results, replacing snippets with full Markdown content.

#### Scenario: Full content replaces snippet
- **WHEN** DuckDuckGo returns 5 results with snippets
- **THEN** the top 3 URLs are fetched in parallel using the page extractor
- **AND** results with successfully extracted content use the full content instead of the snippet
- **AND** results where extraction failed keep the original snippet

#### Scenario: Tavily results with short content
- **WHEN** Tavily returns a result with content shorter than 200 characters
- **THEN** the page extractor is triggered for that URL to get full content

---

### Requirement: Conditional agent invocation

The Soul Capture Agent SHALL only be invoked when `soulType` is `public`. When `soulType` is `personal`, the agent SHALL NOT be invoked.

#### Scenario: Personal soul skips agent

- **WHEN** a soul is created with `soulType: personal`
- **THEN** the `captureSoul()` function SHALL NOT be called
- **THEN** the flow SHALL proceed directly to data source selection or distillation

#### Scenario: Public soul triggers agent

- **WHEN** a soul is created with `soulType: public`
- **THEN** the `captureSoul()` function SHALL be called with the name and optional hint

---

### Requirement: Hint parameter in captureSoul
`captureSoul()` 函数 SHALL 接受可选的 `hint?: string` 参数。hint SHALL 作为额外上下文拼接到 agent 的 user message 中，帮助 LLM 更准确地定位目标。内部 SHALL 通过 `strategy.buildUserMessage(name, hint)` 生成 user message。

#### Scenario: 带 hint 的搜索
- **WHEN** 调用 `captureSoul('V', config, undefined, 'Cyberpunk 2077 主角')`
- **THEN** strategy.buildUserMessage 生成包含 hint 的 user message，传入通用 agent

---

### Requirement: Agent extracts and uses English name
Agent SHALL 在搜索过程中自主识别并使用目标的英文名进行后续搜索。此行为由 system prompt 引导，不再依赖代码逻辑提取。

#### Scenario: 中文名映射到英文
- **WHEN** 用户输入 "强尼银手"，agent 从 Wikipedia 搜索结果中发现 "Johnny Silverhand"
- **THEN** agent 自主使用 "Johnny Silverhand" 进行后续英文搜索

---

### Requirement: Search result confirmation before proceeding

After Agent search completes with valid results, the system SHALL pause at a `search-confirm` step to let the user verify the target before continuing.

#### Scenario: Successful search triggers confirmation

- **WHEN** Agent search completes with classification other than UNKNOWN_ENTITY
- **THEN** the system SHALL transition to `search-confirm` step
- **THEN** the system SHALL NOT auto-proceed to data-sources or distillation

#### Scenario: UNKNOWN_ENTITY skips confirmation

- **WHEN** Agent search completes with UNKNOWN_ENTITY classification
- **THEN** the system SHALL transition directly to data-sources step (existing behavior)

---

### Requirement: Max iterations prevent infinite loop
Agent 的 ToolLoopAgent SHALL 配置 `stopWhen: stepCountIs(30)`，确保循环不会无限执行。

#### Scenario: 30 步上限
- **WHEN** agent 已执行 30 步
- **THEN** 循环强制停止，无论 LLM 是否调用了 reportFindings

---

### Requirement: Agent loop event processing
The `captureSoul` function SHALL create an `AgentLogger` instance at the start of execution and integrate it with the `fullStream` event loop. It SHALL return the logger instance via `CaptureResult.agentLog` without closing it, so the caller can extend the log with distillation data.

#### Scenario: Full logging integration
- **WHEN** `captureSoul` is called and completes a 12-step agent loop
- **THEN** an `AgentLogger` is created at the start, all 12 steps are logged with their events, and `writeResult()` + `writeAnalysis()` are called before the function returns

#### Scenario: AgentLogger returned in CaptureResult
- **WHEN** `captureSoul` returns a result
- **THEN** `CaptureResult.agentLog` contains the open `AgentLogger` instance (not closed)

#### Scenario: AgentLogger passed to tools
- **WHEN** `createAgentTools` is called
- **THEN** the `AgentLogger` instance is passed via the options parameter

#### Scenario: text-delta events captured
- **WHEN** the model emits `text-delta` events during a step
- **THEN** `agentLog.modelOutput(text)` is called for each delta

---

### Requirement: Agent emits search plan progress event
The `captureSoul` function SHALL emit a `search_plan` progress event when the `planSearch` tool completes, containing the dimension list with priorities.

#### Scenario: planSearch result triggers event
- **WHEN** the planSearch tool returns a result with 6 dimensions
- **THEN** `onProgress` is called with `{ type: 'search_plan', dimensions: [{ dimension, priority }...] }`

---

### Requirement: CaptureStrategy 接口
系统 SHALL 定义 `CaptureStrategy` 接口，包含以下方法：`type`（'soul' | 'world'）、`systemPrompt`（string）、`buildUserMessage(name, hint?)`、`getClassificationLabels()`、`getDimensionDefs()`、`generateSearchPlan(classification, englishName, localName, origin)`、`analyzeCoverage(extractions)`、`processResult(rawResult)`。

#### Scenario: Soul 策略实现 CaptureStrategy
- **WHEN** 创建 `SoulCaptureStrategy` 实例
- **THEN** 其 type 为 `'soul'`，systemPrompt 包含 Soul 6 维度的搜索指引

---

### Requirement: 通用 capture agent 循环
系统 SHALL 提供 `runCaptureAgent(strategy, name, config, onProgress?, hint?)` 函数，封装 ToolLoopAgent 配置、stream 消费、doom loop 检测、progress 事件发送等共享逻辑。Soul 和 World 的 capture 函数 SHALL 委托给此通用函数。

#### Scenario: captureSoul 委托给通用 agent
- **WHEN** 调用 `captureSoul(name, config, onProgress)`
- **THEN** 内部调用 `runCaptureAgent(new SoulCaptureStrategy(), name, config, onProgress)`

---

### Requirement: SoulCaptureStrategy 提取
现有 `captureSoul` 的系统提示词、维度定义、搜索模板、coverage 分析 SHALL 提取为 `SoulCaptureStrategy` 类，不改变行为。

#### Scenario: 重构后 captureSoul 行为不变
- **WHEN** 使用重构后的 captureSoul 搜索 "Johnny Silverhand"
- **THEN** 返回结果与重构前行为一致（相同的 classification、chunk 格式、progress 事件）
