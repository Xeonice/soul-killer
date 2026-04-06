## MODIFIED Requirements

### Requirement: /evolve 命令路由
`/evolve` 不带子命令时 SHALL 渲染 `CreateCommand(supplementSoul={name, dir})`，进入 Soul 补充模式。`/evolve status` 和 `/evolve rollback` 子命令 SHALL 保持不变。

#### Scenario: /evolve 进入补充模式
- **WHEN** 用户执行 `/evolve`（已加载 Soul）
- **THEN** 渲染 CreateCommand 补充模式，显示数据源选择

#### Scenario: /evolve status 保持不变
- **WHEN** 用户执行 `/evolve status`
- **THEN** 渲染 EvolveStatusCommand（行为不变）
