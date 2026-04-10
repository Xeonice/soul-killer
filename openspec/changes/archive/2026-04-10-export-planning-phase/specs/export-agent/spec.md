## MODIFIED Requirements

### Requirement: 终止条件

Agent SHALL 以 finalize_export 成功调用结束流程。

#### Scenario: 成功终止

- **WHEN** finalize_export 成功执行（builder.build() 无异常且 packageSkill 成功）
- **THEN** agent SHALL 立即停止
- **AND** stopWhen 条件 SHALL 通过 `finalizeSucceeded` flag 判断，而非 `hasToolCall('finalize_export')`

#### Scenario: finalize_export 失败后重试

- **WHEN** finalize_export 执行失败（如 "Character 'X' missing set_character_axes call"）
- **THEN** agent SHALL 不停止
- **AND** agent SHALL 在下一轮看到 `{ error }` 并修正后重试 finalize_export
- **AND** `finalizeSucceeded` flag SHALL 保持 false 直到 finalize_export 成功

#### Scenario: 异常终止兜底

- **WHEN** stream 结束但 finalizeSucceeded 为 false
- **THEN** SHALL 发出 error 事件并在消息中附带 agent log 路径
- **AND** 错误消息 SHALL 包含已执行的步数

#### Scenario: Watchdog 超时

- **WHEN** 90 秒内 stream 无任何事件
- **THEN** SHALL abort 并发出超时错误

### Requirement: 双循环架构

runExportAgent SHALL 拆分为 Planning Agent 循环 → Plan 确认 → Execution Agent 循环的三阶段流程。

#### Scenario: 正常三阶段流程

- **WHEN** 调用 runExportAgent
- **THEN** SHALL 先运行 Planning Agent 获取 plan
- **AND** Planning Agent 成功后 SHALL 暂停等待用户确认
- **AND** 用户确认后 SHALL 启动 Execution Agent 并传入 plan

#### Scenario: Planning Agent 失败时不进入执行

- **WHEN** Planning Agent 未能成功产出 plan
- **THEN** SHALL 直接报错给用户
- **AND** SHALL 不启动 Execution Agent

#### Scenario: 用户取消时不进入执行

- **WHEN** 用户在 plan 确认界面按 Esc
- **THEN** SHALL 不启动 Execution Agent

### Requirement: Execution Agent 接收 plan

Execution Agent 的 initial prompt SHALL 包含 Planning Agent 产出的 plan JSON 以及完整的 soul/world 数据。

#### Scenario: Execution Agent initial prompt

- **WHEN** 启动 Execution Agent
- **THEN** initial prompt SHALL 包含一个 "# 执行计划" 块，内容为 plan JSON
- **AND** initial prompt SHALL 仍然包含完整的 soul/world 数据
- **AND** system prompt SHALL 强调按 plan 的方向执行

### Requirement: System prompt 引导分阶段调用

Export Agent 的 SYSTEM_PROMPT（Execution Agent 版本）SHALL 明确指引 agent 按 plan 方向调用工具。

#### Scenario: Prompt 引用 plan

- **WHEN** 构造 Execution Agent 的 SYSTEM_PROMPT
- **THEN** SHALL 说明 initial prompt 中包含已确认的执行计划
- **AND** SHALL 指引 agent 按 plan 的 genre_direction 填充 set_story_metadata
- **AND** SHALL 指引 agent 按 plan 的 characters 列表逐一执行 add_character + set_character_axes
- **AND** SHALL 强调不可跳过 plan 中的任何角色

## ADDED Requirements

### Requirement: ExportPhase 扩展

ExportPhase 类型 SHALL 新增 `planning` 和 `plan_review` 两个阶段。

#### Scenario: ExportPhase 完整定义

- **WHEN** 定义 ExportPhase 类型
- **THEN** SHALL 为 `'initiating' | 'planning' | 'plan_review' | 'selecting' | 'analyzing' | 'configuring' | 'packaging' | 'complete' | 'error'`

### Requirement: ExportPlan 类型导出

export-agent 模块 SHALL 导出 `ExportPlan` 和 `ExportPlanCharacter` 类型供 UI 层使用。

#### Scenario: 类型可导入

- **WHEN** UI 层 import ExportPlan
- **THEN** SHALL 能从 `../../agent/export-agent.js` 导入 `ExportPlan` 类型

### Requirement: Plan 确认进度事件

runExportAgent SHALL 通过 onProgress 发送 plan 确认相关事件。

#### Scenario: plan_review 事件

- **WHEN** Planning Agent 成功返回 plan
- **THEN** SHALL 发送 `{ type: 'phase', phase: 'plan_review' }` 事件
- **AND** SHALL 发送 `{ type: 'plan_ready', plan: ExportPlan }` 事件供 UI 展示

#### Scenario: plan_confirmed 事件

- **WHEN** 用户确认 plan
- **THEN** SHALL 发送 `{ type: 'plan_confirmed' }` 事件
- **AND** 随后发送 `{ type: 'phase', phase: 'analyzing' }` 进入执行阶段
