## MODIFIED Requirements

### Requirement: 搜索工具集
Agent SHALL 拥有以下 tool 供自主调用：search（统一搜索）、extractPage（提取页面完整内容）、planSearch（生成搜索计划）、checkCoverage（检查维度覆盖度）、reportFindings（报告结果并终止循环）。

#### Scenario: search 工具调用
- **WHEN** agent 决定搜索
- **THEN** 调用 search tool，传入 query、source（"web"|"wikipedia"）、lang

#### Scenario: planSearch 工具调用
- **WHEN** agent 完成初始侦察后
- **THEN** 调用 planSearch tool，传入侦察结果摘要
- **AND** tool 返回维度×查询的搜索计划

#### Scenario: checkCoverage 工具调用
- **WHEN** agent 在采集阶段搜索了若干轮后
- **THEN** 调用 checkCoverage tool，传入已收集的 extractions
- **AND** tool 返回各维度覆盖状态和建议

#### Scenario: reportFindings 终止循环
- **WHEN** LLM 调用 reportFindings
- **THEN** 循环停止，extractions 中每条 SHALL 包含 dimension 字段

### Requirement: 三阶段流程控制
Agent SHALL 通过 prepareStep 实现三阶段流程：侦察（step 0-1，只能 search）→ 规划（step 2，强制 planSearch）→ 采集（step 3+，全部工具可用）。

#### Scenario: 侦察阶段限制
- **WHEN** stepNumber 为 0 或 1
- **THEN** activeTools 仅包含 search
- **AND** LLM 不能调用 planSearch、checkCoverage 或 reportFindings

#### Scenario: 规划阶段强制
- **WHEN** stepNumber 为 2
- **THEN** toolChoice 强制为 planSearch
- **AND** LLM 必须调用 planSearch 生成搜索计划

#### Scenario: 采集阶段全开放
- **WHEN** stepNumber ≥ 3
- **THEN** activeTools 包含全部 5 个 tool
- **AND** LLM 可自主选择搜索、检查覆盖或报告

### Requirement: System Prompt
Agent 的 instructions SHALL 包含 6 维度灵魂模型描述，告知 LLM 每个维度代表什么信息、优先级如何。prompt SHALL 引导 LLM 在采集阶段按 planSearch 返回的计划搜索，并在搜索若干轮后调用 checkCoverage 检查进度。

#### Scenario: Prompt 包含维度框架
- **WHEN** agent 初始化
- **THEN** system prompt 中 SHALL 列出 6 个维度的名称、描述和优先级

#### Scenario: Prompt 引导覆盖检查
- **WHEN** agent 在采集阶段
- **THEN** system prompt 指导 agent 每搜索 3-4 轮后调用 checkCoverage

### Requirement: reportFindings extractions 维度标注
reportFindings 的 inputSchema 中 extractions 数组的每个元素 SHALL 新增 dimension 字段（SoulDimension 类型），标注该条数据属于哪个维度。

#### Scenario: 标注维度
- **WHEN** LLM 调用 reportFindings
- **THEN** 每条 extraction 的 dimension 字段 SHALL 为 6 个维度之一
- **AND** LLM 根据内容判断最匹配的维度
