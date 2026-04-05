## MODIFIED Requirements

### Requirement: toolChoice 强制工具调用
Agent SHALL 设置 `toolChoice: 'auto'`，由 LLM 自行决定是否调用工具。System prompt SHALL 包含明确指令引导 LLM 每步优先调用工具而非生成纯文本。

#### Scenario: LLM 自主调用工具
- **WHEN** agent 执行任意一步
- **THEN** LLM 根据 prompt 引导优先调用工具
- **AND** 如果 LLM 生成纯文本而非 tool call，循环正常终止并走 fallback 逻辑

### Requirement: 三阶段流程控制
Agent 不再通过 `prepareStep` 的 `activeTools` 控制阶段。所有 5 个工具每步都可见。阶段行为 SHALL 通过 system prompt 引导：侦察（先搜索）→ 规划（调 planSearch）→ 采集（按计划搜索 + checkCoverage）。

#### Scenario: 所有工具始终可见
- **WHEN** agent 执行任意一步
- **THEN** LLM 可以看到全部 5 个工具（search、extractPage、planSearch、checkCoverage、reportFindings）

#### Scenario: prompt 引导阶段行为
- **WHEN** agent 开始执行
- **THEN** system prompt 指导 LLM 前 2 步用 search，第 3 步调 planSearch，之后按计划搜索

### Requirement: Doom Loop 检测
Agent SHALL 通过 `prepareStep` 检测连续 3 次相同 tool + 相同参数的调用。检测到时 SHALL 强制 LLM 调用 reportFindings。最后一步（step >= 29）同样强制 reportFindings。

#### Scenario: 检测到重复搜索
- **WHEN** agent 连续 3 步调用 search 且参数完全相同
- **THEN** prepareStep 返回 `{ toolChoice: { type: 'tool', toolName: 'reportFindings' } }`

#### Scenario: 最后一步强制报告
- **WHEN** stepNumber >= 29
- **THEN** prepareStep 强制 toolChoice 为 reportFindings

#### Scenario: forced toolChoice 模型不支持时的降级
- **WHEN** 模型不支持 forced toolChoice 导致错误
- **THEN** 循环终止，fallback 到 UNKNOWN_ENTITY
