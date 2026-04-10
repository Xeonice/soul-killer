## ADDED Requirements

### Requirement: Plan 确认交互

Planning Agent 成功输出 plan 后、Execution Agent 启动前，runExportAgent SHALL 暂停并通过 UI 展示 plan 详情，等待用户确认。

#### Scenario: 用户确认继续

- **WHEN** Planning Agent 成功返回 plan
- **THEN** SHALL 发送 `{ type: 'phase', phase: 'plan_review' }` 事件
- **AND** SHALL 发送 plan 数据到 UI 层展示
- **AND** 用户按 Enter 后 SHALL 启动 Execution Agent

#### Scenario: 用户取消

- **WHEN** 用户在 plan 确认界面按 Esc
- **THEN** SHALL 不启动 Execution Agent
- **AND** SHALL 发送 `{ type: 'error', error: '用户取消了导出' }` 或等价的取消信号

### Requirement: Plan 确认在代码层而非 agent 循环内

Plan 确认交互 SHALL 由 runExportAgent 函数在两个循环之间的代码层处理，不由 Planning Agent 通过 ask_user 工具触发。

#### Scenario: 确认逻辑位置

- **WHEN** Planning Agent 的 submit_plan 成功返回
- **THEN** Planning Agent 循环 SHALL 立即结束
- **AND** 确认等待 SHALL 在 runExportAgent 函数体内、两个 ToolLoopAgent 实例之间执行

### Requirement: Plan 确认 UI 布局

plan_review 阶段的 UI SHALL 展示角色编排表和故事方向摘要，让用户在执行前预览 agent 的创意决策。

#### Scenario: plan_review 渲染内容

- **WHEN** ExportProtocolPanel 进入 plan_review 阶段
- **THEN** SHALL 展示以下信息：
  - 类型方向（genre_direction）
  - 基调方向（tone_direction）
  - 共享轴名（shared_axes）
  - Flag 数量
  - 角色编排表（name / role / specific_axes_direction）
- **AND** 底部 SHALL 显示 "Enter 继续执行 · Esc 取消"

#### Scenario: plan_review ActiveZone 类型

- **WHEN** reducePanelEvent 收到 plan 确认事件
- **THEN** activeZone SHALL 切换为 `{ type: 'plan_review', plan: ExportPlanSummary }`
