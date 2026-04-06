# Export Command

`/export` 命令注册、入口组件和 interactiveMode 集成。

## ADDED Requirements

### Requirement: /export 命令注册

系统 SHALL 在 command registry 中注册 `/export` 命令，描述为"导出 Soul + World 为 Cloud Skill"。

#### Scenario: 命令注册

- **WHEN** REPL 启动
- **THEN** `/export` SHALL 出现在 command registry 中
- **AND** `/help` 输出中列出 `/export` 及其描述

#### Scenario: Tab 补全

- **WHEN** 用户输入 `/exp` 并按 Tab
- **THEN** 自动补全为 `/export`

### Requirement: /export 入口组件

`/export` 命令 SHALL 渲染 ExportCommand 组件，该组件初始化 Export Agent 并挂载 ExportProtocolPanel。组件进入 interactiveMode（隐藏主 TextInput，避免 ink useInput 广播冲突）。

#### Scenario: 进入导出模式

- **WHEN** 用户执行 `/export`
- **THEN** app.tsx SHALL 设置 `interactiveMode: true`
- **AND** 渲染 ExportCommand 组件
- **AND** ExportCommand 初始化 Export Agent 并开始 Agent loop

#### Scenario: 导出完成后退出

- **WHEN** Export Agent 完成导出（或用户按 Esc 取消）
- **THEN** ExportCommand SHALL 调用 onComplete 回调
- **AND** app.tsx 恢复 `interactiveMode: false`
- **AND** 返回主 REPL prompt

#### Scenario: 导出过程中 Esc 取消

- **WHEN** 用户在导出过程中按 Esc
- **THEN** Export Agent loop SHALL 被中止
- **AND** 显示"导出已取消"
- **AND** 退出 interactiveMode 返回主 prompt
