## ADDED Requirements

### Requirement: ToolLoopAgent 驱动的自主搜索循环
系统 SHALL 使用 AI SDK v6 的 `ToolLoopAgent` 类实现 soul capture 的搜索循环。Agent SHALL 自主决定搜索关键词、搜索工具、搜索顺序，直到收集到足够信息或达到步数上限。

#### Scenario: Agent 自主搜索虚构角色
- **WHEN** captureSoul 被调用，目标为 "强尼银手"
- **THEN** agent 自主发起搜索（可能先搜 Wikipedia，再搜 fandom wiki）
- **AND** agent 根据中间结果调整后续搜索关键词（如发现英文名 "Johnny Silverhand" 后用英文继续搜索）
- **AND** agent 判断信息足够后调用 reportFindings 终止循环

#### Scenario: Agent 自主搜索公众人物
- **WHEN** captureSoul 被调用，目标为 "Elon Musk"
- **THEN** agent 自主选择搜索访谈、发言、新闻等方向
- **AND** agent 收集到足够信息后通过 reportFindings 报告分类为 PUBLIC_ENTITY

#### Scenario: Agent 处理未知目标
- **WHEN** captureSoul 被调用，目标为一个无法找到信息的名字
- **THEN** agent 在多次搜索无果后调用 reportFindings
- **AND** reportFindings 中 classification 为 UNKNOWN_ENTITY，extractions 为空数组

### Requirement: 搜索工具集
Agent SHALL 拥有以下 tool 供自主调用：search（统一搜索，单一 query 参数）、extractPage（提取页面完整内容）、planSearch（生成搜索计划）、checkCoverage（检查维度覆盖度）、reportFindings（报告结果并终止循环）。搜索后端根据 config.search.provider 自动选择 SearXNG/Exa/Tavily，自动聚合多源结果（包括 Wikipedia）。

#### Scenario: 简化后的搜索调用
- **WHEN** LLM 调用 search tool
- **THEN** 只需传入 query 字符串
- **AND** 搜索后端根据 config.search.provider 自动选择 SearXNG/Exa/Tavily
- **AND** 返回包含多源内容的结果数组

#### Scenario: search tool 使用 SearXNG
- **WHEN** config.search.provider 为 searxng 且 SearXNG 容器可用
- **THEN** 搜索请求发送到本地 SearXNG 实例
- **AND** 对前 5 条内容 < 300 字符的结果自动提取全文

#### Scenario: search tool 使用 Exa
- **WHEN** config.search.provider 为 exa 且 exa_api_key 存在
- **THEN** 调用 Exa searchAndContents API
- **AND** 结果已包含全文，不需要额外提取

#### Scenario: search tool 使用 Tavily
- **WHEN** config.search.provider 为 tavily 且 tavily_api_key 存在
- **THEN** 调用 Tavily API（advanced + include_raw_content）
- **AND** 结果已包含全文

#### Scenario: planSearch 工具调用
- **WHEN** agent 完成初始侦察后
- **THEN** 调用 planSearch tool，传入侦察结果摘要
- **AND** tool 返回维度×查询的搜索计划

#### Scenario: checkCoverage 工具调用
- **WHEN** agent 在采集阶段搜索了若干轮后
- **THEN** 调用 checkCoverage tool，传入已收集的 extractions
- **AND** tool 返回各维度覆盖状态和建议

#### Scenario: extractPage 工具调用
- **WHEN** agent 发现某个 URL 的摘要内容不够详细
- **THEN** agent 调用 extractPage tool，传入 url 字符串
- **AND** tool 返回该页面的完整 markdown 内容

#### Scenario: reportFindings 终止循环
- **WHEN** LLM 调用 reportFindings
- **THEN** 循环停止，extractions 中每条 SHALL 包含 dimension 字段

### Requirement: reportFindings 终止 tool
`reportFindings` tool SHALL 没有 execute 函数。当 LLM 调用它时，agent loop 自动停止。其 inputSchema SHALL 包含 classification、origin（可选）、summary、extractions 数组。extractions 每项 SHALL 包含 dimension 字段（SoulDimension 类型）。

#### Scenario: reportFindings 停止循环
- **WHEN** LLM 调用 reportFindings tool
- **THEN** ToolLoopAgent 循环立即停止（因为 tool 无 execute 函数）
- **AND** reportFindings 的参数可通过 result.staticToolCalls 获取

#### Scenario: reportFindings 包含完整分类信息和维度标注
- **WHEN** LLM 调用 reportFindings
- **THEN** 参数 SHALL 包含 classification（四种类型之一）、summary（一段话描述）、extractions（收集到的信息数组）
- **AND** 每条 extraction 的 dimension 字段 SHALL 为 6 个维度之一

### Requirement: 三阶段流程控制
Agent SHALL 通过 prepareStep 实现三阶段流程：侦察（step 0-1，search + extractPage）→ 规划（step 2，强制 planSearch）→ 采集（step 3+，全部工具可用）。

#### Scenario: 侦察阶段限制
- **WHEN** stepNumber 为 0 或 1
- **THEN** activeTools 包含 search 和 extractPage
- **AND** LLM 不能调用 planSearch、checkCoverage 或 reportFindings

#### Scenario: 规划阶段强制
- **WHEN** stepNumber 为 2
- **THEN** toolChoice 强制为 planSearch
- **AND** LLM 必须调用 planSearch 生成搜索计划

#### Scenario: 采集阶段全开放
- **WHEN** stepNumber ≥ 3
- **THEN** activeTools 包含全部 5 个 tool
- **AND** LLM 可自主选择搜索、检查覆盖或报告

### Requirement: 步数控制与终止条件
Agent SHALL 配置 `stopWhen: [stepCountIs(30), hasToolCall('reportFindings')]`。循环在以下任一条件满足时停止：达到 30 步、reportFindings 被调用。

#### Scenario: 30 步上限
- **WHEN** agent 已执行 30 步但仍未调用 reportFindings
- **THEN** 循环强制停止

#### Scenario: reportFindings 提前终止
- **WHEN** agent 在第 8 步调用 reportFindings
- **THEN** 循环在第 8 步停止，不继续执行后续步骤

### Requirement: toolChoice 强制工具调用
Agent SHALL 设置 `toolChoice: 'required'`，确保 LLM 每步都必须调用一个 tool。

#### Scenario: 每步都必须用工具
- **WHEN** agent 执行任意一步
- **THEN** LLM 必须调用可用 tool 中的一个
- **AND** 不会出现纯文本回复导致的提前退出

### Requirement: Doom Loop 检测
Agent SHALL 通过 `prepareStep` 检测连续 3 次相同 tool + 相同参数的调用。检测到时 SHALL 强制 LLM 调用 reportFindings。

#### Scenario: 检测到重复搜索
- **WHEN** agent 连续 3 步调用 search 且参数完全相同
- **THEN** prepareStep 返回 `{ toolChoice: { type: 'tool', toolName: 'reportFindings' } }`
- **AND** LLM 被强制调用 reportFindings 终止循环

#### Scenario: 最后一步强制报告
- **WHEN** stepNumber >= 29（最后一步）
- **THEN** prepareStep 强制 toolChoice 为 reportFindings

### Requirement: System Prompt
Agent 的 instructions SHALL 包含 6 维度模型描述、搜索策略指导（侦察→规划→采集）、信息偏好（引用、观点、性格特征）、终止条件指导（覆盖 3+ 维度且必需 2+）。搜索指令简化为引导 LLM 直接用 search tool 搜索，搜索引擎自动聚合多源（包括 Wikipedia）。

#### Scenario: Prompt 包含维度框架
- **WHEN** agent 初始化
- **THEN** system prompt 中 SHALL 列出 6 个维度的名称、描述和优先级

#### Scenario: 简化的搜索引导
- **WHEN** agent 开始执行
- **THEN** system prompt 指导 LLM 直接用 search tool 搜索
- **AND** 不再提及 wikipedia source 选项

#### Scenario: Prompt 引导覆盖检查
- **WHEN** agent 在采集阶段
- **THEN** system prompt 指导 agent 每搜索 3-4 轮后调用 checkCoverage

### Requirement: Progress 事件映射
Agent SHALL 通过 fullStream 事件将 AI SDK 流式事件映射为 `CaptureProgress` 类型，保持与现有 UI 的兼容性。

#### Scenario: 搜索工具调用映射为 tool_call 事件
- **WHEN** agent 的某一步调用了 search tool
- **THEN** 发送 `{ type: 'tool_call', tool: 'search', query: '...' }` 和 `{ type: 'tool_result', tool: 'search', resultCount: N }`

#### Scenario: planSearch/checkCoverage 映射
- **WHEN** agent 调用 planSearch 或 checkCoverage
- **THEN** 发送对应的 tool_call 和 tool_result 事件

#### Scenario: reportFindings 映射为 complete 事件
- **WHEN** agent 调用 reportFindings
- **THEN** 依次发送 classification 事件、chunks_extracted 事件、phase complete 事件
