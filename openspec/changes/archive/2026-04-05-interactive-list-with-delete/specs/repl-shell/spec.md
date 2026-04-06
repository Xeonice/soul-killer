## ADDED Requirements

### Requirement: /list 交互式 Soul 列表
`/list` SHALL 进入交互式 Soul 列表，显示所有本地 Soul 的名称和 chunk 数。用户通过方向键选择、Enter 进入子操作菜单、ESC 退出。

#### Scenario: 展示 Soul 列表
- **WHEN** 用户执行 `/list` 且有 2 个本地 Soul
- **THEN** 显示交互式列表，每个 Soul 显示 name 和 chunk_count

#### Scenario: 空列表
- **WHEN** 用户执行 `/list` 且无本地 Soul
- **THEN** 显示空列表提示

### Requirement: Soul 子操作菜单
选中 Soul 后 SHALL 显示子操作菜单：详情、加载、进化、删除。ESC 返回列表。

#### Scenario: 子操作菜单展示
- **WHEN** 用户选中 "alice"
- **THEN** 显示子操作菜单（详情/加载/进化/删除）

### Requirement: Soul 详情查看
选择「详情」SHALL 展示 Soul 的 manifest 信息和 soul files 概览。

#### Scenario: 查看详情
- **WHEN** 用户选择「详情」
- **THEN** 显示 name、display_name、soulType、tags、chunk_count、evolve_history

### Requirement: Soul 加载
选择「加载」SHALL 触发 onUse 回调加载该 Soul。

#### Scenario: 加载 Soul
- **WHEN** 用户选择「加载」
- **THEN** 调用 onUse(soulName, soulDir)，退出列表

### Requirement: Soul 进化
选择「进化」SHALL 渲染 CreateCommand 补充模式。

#### Scenario: 进化 Soul
- **WHEN** 用户选择「进化」
- **THEN** 渲染 CreateCommand(supplementSoul={name, dir})

### Requirement: Soul 删除
选择「删除」SHALL 显示确认提示，确认后删除 Soul 目录并返回列表。

#### Scenario: 删除确认
- **WHEN** 用户选择「删除」
- **THEN** 显示确认提示（Soul 名称 + 确认/取消选项）

#### Scenario: 确认删除
- **WHEN** 用户在确认提示选择「确认」
- **THEN** 删除 Soul 目录，返回列表（列表刷新）

#### Scenario: 取消删除
- **WHEN** 用户在确认提示选择「取消」
- **THEN** 返回子操作菜单
