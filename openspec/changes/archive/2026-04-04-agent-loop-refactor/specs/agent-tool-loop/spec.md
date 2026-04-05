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
Agent SHALL 拥有以下 tool 供自主调用：webSearch（网页搜索）、wikipedia（维基百科搜索，支持多语言）、extractPage（提取页面完整内容）、reportFindings（报告结果并终止循环）。

#### Scenario: webSearch 工具调用
- **WHEN** agent 决定搜索网页
- **THEN** agent 调用 webSearch tool，传入 query 字符串
- **AND** tool 返回 results 数组，每项包含 title、url、content

#### Scenario: wikipedia 工具调用
- **WHEN** agent 决定搜索维基百科
- **THEN** agent 调用 wikipedia tool，传入 query 和可选的 lang 参数（"en"|"zh"|"ja"）
- **AND** tool 返回 results 数组，每项包含 title、url、extract

#### Scenario: extractPage 工具调用
- **WHEN** agent 发现某个 URL 的摘要内容不够详细
- **THEN** agent 调用 extractPage tool，传入 url 字符串
- **AND** tool 返回该页面的完整 markdown 内容

### Requirement: reportFindings 终止 tool
`reportFindings` tool SHALL 没有 execute 函数。当 LLM 调用它时，agent loop 自动停止。其 inputSchema SHALL 包含 classification、origin（可选）、summary、extractions 数组。

#### Scenario: reportFindings 停止循环
- **WHEN** LLM 调用 reportFindings tool
- **THEN** ToolLoopAgent 循环立即停止（因为 tool 无 execute 函数）
- **AND** reportFindings 的参数可通过 result.staticToolCalls 获取

#### Scenario: reportFindings 包含完整分类信息
- **WHEN** LLM 调用 reportFindings
- **THEN** 参数 SHALL 包含 classification（四种类型之一）、summary（一段话描述）、extractions（收集到的信息数组）

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
- **THEN** LLM 必须调用 webSearch、wikipedia、extractPage 或 reportFindings 中的一个
- **AND** 不会出现纯文本回复导致的提前退出

### Requirement: Doom Loop 检测
Agent SHALL 通过 `prepareStep` 检测连续 3 次相同 tool + 相同参数的调用。检测到时 SHALL 强制 LLM 调用 reportFindings。

#### Scenario: 检测到重复搜索
- **WHEN** agent 连续 3 步调用 webSearch 且参数完全相同
- **THEN** prepareStep 返回 `{ toolChoice: { type: 'tool', toolName: 'reportFindings' } }`
- **AND** LLM 被强制调用 reportFindings 终止循环

#### Scenario: 最后一步强制报告
- **WHEN** stepNumber >= 29（最后一步）
- **THEN** prepareStep 强制 toolChoice 为 reportFindings

### Requirement: System Prompt
Agent 的 instructions SHALL 描述 Soulkiller Protocol 的角色和任务，包含搜索策略指导（先广搜后深搜）、多语言搜索建议、信息偏好（引用、观点、性格特征）、终止条件指导。

#### Scenario: Prompt 引导搜索策略
- **WHEN** agent 开始执行
- **THEN** system prompt 告知 agent 先用广泛搜索确定目标身份
- **AND** 根据目标类型选择深搜方向（虚构角色→wiki/fandom，公众人物→访谈/发言）

#### Scenario: Prompt 包含终止指导
- **WHEN** agent 在搜索过程中
- **THEN** system prompt 指导 agent 在收集 8+ 条实质信息时调用 reportFindings
- **AND** 在 3+ 次搜索无新结果时调用 reportFindings

### Requirement: Progress 事件映射
Agent SHALL 通过 `onStepFinish` 回调将 AI SDK 步骤事件映射为 `CaptureProgress` 类型，保持与现有 UI 的兼容性。

#### Scenario: 搜索工具调用映射为 tool_call 事件
- **WHEN** agent 的某一步调用了 webSearch tool
- **THEN** 发送 `{ type: 'tool_call', tool: 'search', query: '...' }` 和 `{ type: 'tool_result', tool: 'search', resultCount: N }`

#### Scenario: reportFindings 映射为 complete 事件
- **WHEN** agent 调用 reportFindings
- **THEN** 依次发送 classification 事件、chunks_extracted 事件、phase complete 事件
