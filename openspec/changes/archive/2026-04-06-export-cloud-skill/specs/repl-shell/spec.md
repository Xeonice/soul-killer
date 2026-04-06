# REPL Shell

## ADDED Requirements

### Requirement: /export 命令路由

REPL 的 handleInput 命令路由 SHALL 新增 `export` case，渲染 ExportCommand 组件并设置 interactiveMode。

#### Scenario: 路由 /export 命令

- **WHEN** 用户输入 `/export`
- **THEN** handleInput SHALL 匹配 "export" case
- **AND** 设置 `interactiveMode: true`
- **AND** 渲染 ExportCommand 组件
