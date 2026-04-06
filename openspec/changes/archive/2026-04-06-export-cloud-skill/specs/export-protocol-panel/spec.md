# Export Protocol Panel

Agent 交互式可视化面板，支持进度轨迹与活动区交替展示 Export Agent 的操作进度和用户交互。

## ADDED Requirements

### Requirement: 两区域面板布局

ExportProtocolPanel SHALL 分为两个视觉区域：上方的**进度轨迹**（ProgressTrail）展示已完成的步骤摘要，下方的**活动区**（ActiveZone）展示当前正在进行的步骤。两个区域使用统一的赛博朋克视觉风格（PRIMARY/ACCENT/DIM 配色、▓ 前缀、单线边框）。

#### Scenario: 首次渲染

- **WHEN** ExportProtocolPanel 首次挂载
- **THEN** 进度轨迹为空
- **AND** 活动区显示 Agent 初始化状态（spinner + "EXPORT PROTOCOL 启动中"）

#### Scenario: 步骤推进后的布局

- **WHEN** 已完成 Soul 选择和 World 选择步骤
- **AND** 当前正在分析 Soul + World
- **THEN** 进度轨迹显示两个已完成步骤的摘要
- **AND** 活动区显示分析进度

### Requirement: 进度轨迹（ProgressTrail）

进度轨迹 SHALL 以折叠列表形式展示已完成的步骤。每个步骤显示为一行：`▓ {步骤描述} ✓`，下方可选展示关键结果摘要（`▸ {摘要}`）。

#### Scenario: 展开模式（前 4 步）

- **WHEN** 已完成步骤数量 ≤ 4
- **THEN** 每个步骤 SHALL 完整展示描述行和摘要行

#### Scenario: 折叠模式（5+ 步）

- **WHEN** 已完成步骤数量 > 4
- **THEN** 前面的步骤 SHALL 折叠为单行摘要（如 `▓ 分身: V · 世界: 赛博朋克 2077 ✓`）
- **AND** 最近 2 个完成步骤保持展开

### Requirement: 活动区 — Tool 调用进度

当 Agent 调用非交互式 tool（list_souls、list_worlds、read_soul、read_world）时，活动区 SHALL 显示 spinner + tool 名称 + 参数摘要。tool 完成后显示 ✓ + 结果摘要。

#### Scenario: tool 执行中

- **WHEN** 收到 `tool_start({ tool: "read_soul", args: { name: "V" } })` 事件
- **THEN** 活动区显示 `▸ 📖 read_soul("V") ⠹`（spinner 动画）

#### Scenario: tool 执行完成

- **WHEN** 收到 `tool_end({ tool: "read_soul", result_summary: "identity + style + 4 behaviors" })` 事件
- **THEN** 活动区显示 `▸ 📖 read_soul("V") → identity + style + 4 behaviors ✓`

### Requirement: 活动区 — 内嵌选择组件

当 Agent 调用 `ask_user` 且提供了 options 时，活动区 SHALL 渲染内嵌选择组件，支持上下箭头导航和 Enter 确认。

#### Scenario: 渲染选项列表

- **WHEN** 收到 `ask_user_start({ question: "选择分身", options: [{label: "V", description: "公共 · v0.3.0"}, {label: "Johnny", description: "公共 · v0.1.0"}] })` 事件
- **THEN** 活动区 SHALL 渲染带边框的选择组件
- **AND** 显示 question 作为标题
- **AND** 每个选项显示 label（PRIMARY 色），description 显示在下方（DIM 色）
- **AND** 当前选中项前显示 ❯ 标记

#### Scenario: 用户做出选择

- **WHEN** 用户按 Enter 确认选择
- **THEN** 选择组件消失
- **AND** 该步骤转入进度轨迹，摘要为用户的选择结果

### Requirement: 活动区 — 内嵌文本输入

当 Agent 调用 `ask_user` 且 `allow_free_input: true` 时，活动区 SHALL 渲染文本输入框。

#### Scenario: 文本输入

- **WHEN** 收到 `ask_user_start({ question: "描述剧情方向", allow_free_input: true })` 事件
- **THEN** 活动区 SHALL 渲染文本输入框（带光标提示）
- **AND** 显示 question 作为标题

### Requirement: 活动区 — 打包进度

当 Agent 调用 `package_skill` 时，活动区 SHALL 逐步展示打包的各个子步骤。

#### Scenario: 打包过程中

- **WHEN** 收到 `tool_start({ tool: "package_skill" })` 事件
- **THEN** 活动区 SHALL 显示打包子步骤列表：
  - `✓ 复制 Soul 文件` / `▸ 复制 Soul 文件 ⠹` / `○ 复制 Soul 文件`
  - `✓ 复制 World 文件` / `▸ 复制 World 文件 ⠹` / `○ 复制 World 文件`
  - `✓ 生成 story-spec.md` / `▸ 生成 story-spec.md ⠹` / `○ 生成 story-spec.md`
  - `✓ 生成 SKILL.md` / `▸ 生成 SKILL.md ⠹` / `○ 生成 SKILL.md`

### Requirement: 活动区 — 完成结果面板

当导出完成时，活动区 SHALL 显示结果面板，展示输出目录路径和文件结构树。

#### Scenario: 导出完成

- **WHEN** 收到 `complete({ output_dir, files })` 事件
- **THEN** 活动区 SHALL 显示带边框的结果面板
- **AND** 显示输出目录路径
- **AND** 以树形结构列出文件（SKILL.md、soul/、world/、story-spec.md）
- **AND** 显示提示"将此目录复制到 .claude/skills/ 即可使用"

### Requirement: 面板标题与状态栏

面板 SHALL 显示固定标题 `[SOULKILLER] EXPORT PROTOCOL`，底部状态栏显示当前可用的快捷键提示（如 `↑/↓ 选择 Enter 确认 Esc 取消`）。

#### Scenario: 非交互状态

- **WHEN** 活动区显示 Agent 操作进度（非用户交互）
- **THEN** 底部状态栏显示 `Esc 取消`

#### Scenario: 选择状态

- **WHEN** 活动区显示选择组件
- **THEN** 底部状态栏显示 `↑/↓ 选择  Enter 确认  Esc 取消`

#### Scenario: 文本输入状态

- **WHEN** 活动区显示文本输入框
- **THEN** 底部状态栏显示 `Enter 提交  Esc 取消`
