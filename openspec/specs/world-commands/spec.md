# world-commands Specification

## Purpose
定义 World 系统的 CLI 命令集，包括世界的创建、管理、绑定和蒸馏操作的交互式界面。
## Requirements
### Requirement: /world 交互式子菜单
系统 SHALL 提供 `/world` 命令，进入两层交互式菜单。顶层菜单 SHALL 显示两个选项：「创建」和「管理」。用户通过方向键选择、Enter 进入、ESC 退出。当没有已安装世界时，「管理」选项 SHALL 显示为禁用状态。

#### Scenario: 顶层菜单展示
- **WHEN** 用户执行 `/world`
- **THEN** 显示「创建」和「管理」两个选项

#### Scenario: 无已安装世界时管理禁用
- **WHEN** 用户执行 `/world` 且无已安装世界
- **THEN** 「管理」选项显示为禁用状态

#### Scenario: ESC 退出菜单
- **WHEN** 用户在菜单中按 ESC
- **THEN** 退出世界管理，返回主 REPL

### Requirement: 创建世界（菜单 → 创建）
用户选择「创建」后 SHALL 直接进入 `WorldCreateWizard` 组件。Wizard 组件自包含管理整个创建流程。

#### Scenario: 进入创建向导
- **WHEN** 用户在顶层菜单选择「创建」
- **THEN** 渲染 WorldCreateWizard

### Requirement: 世界选择列表（菜单 → 管理）
用户选择「管理」后 SHALL 进入世界选择列表。列表 SHALL 显示所有已安装世界的名称、显示名和条目数。用户通过方向键选择、Enter 选中世界、ESC 返回顶层菜单。

#### Scenario: 展示世界列表
- **WHEN** 用户选择「管理」且有 2 个已安装世界
- **THEN** 列表显示 2 个世界，每个显示 name、display_name 和 entry_count

#### Scenario: 选中世界
- **WHEN** 用户在世界列表中按 Enter 选中 "night-city"
- **THEN** 进入 night-city 的子操作菜单

#### Scenario: ESC 返回顶层
- **WHEN** 用户在世界列表中按 ESC
- **THEN** 返回顶层菜单

### Requirement: 子操作菜单（选中世界后）
选中世界后 SHALL 显示子操作菜单，包含：详情、条目、蒸馏（数据导入）、绑定、解绑。「蒸馏」操作 SHALL 渲染 `WorldCreateWizard(supplementWorld=worldName)` 进入补充模式，而非独立的 WorldDistillCommand。绑定/解绑需要已加载 Soul，未加载时 SHALL 显示为禁用。ESC SHALL 返回世界列表。

#### Scenario: 子操作菜单展示
- **WHEN** 用户选中 "night-city"
- **THEN** 显示子操作菜单，标题为 "night-city — Night City"，包含详情/条目/蒸馏/绑定/解绑

#### Scenario: 蒸馏操作进入 wizard 补充模式
- **WHEN** 用户在子操作菜单选择「蒸馏」
- **THEN** 渲染 WorldCreateWizard，supplementWorld 设为当前选中世界的 name，直接显示数据源选择

#### Scenario: 无 Soul 时绑定禁用
- **WHEN** 子操作菜单展示且无已加载 Soul
- **THEN** 绑定和解绑选项显示为禁用

#### Scenario: ESC 返回世界列表
- **WHEN** 用户在子操作菜单中按 ESC
- **THEN** 返回世界选择列表

### Requirement: 操作完成后返回子操作菜单
每个子操作完成后 SHALL 自动返回当前世界的子操作菜单，而不是退出到主 REPL 或顶层菜单。用户可以连续对同一个世界执行多个操作。

#### Scenario: 详情查看后返回
- **WHEN** 用户查看完世界详情后按 ESC
- **THEN** 返回当前世界的子操作菜单

### Requirement: 命令注册与补全
`/world` SHALL 注册到 command-registry 并支持 slash 补全。

#### Scenario: 命令补全
- **WHEN** 用户输入 `/wor` 并按 tab
- **THEN** 补全为 `/world`

### Requirement: World 删除操作
子操作菜单 SHALL 包含「删除」选项。选择后 SHALL 显示确认提示，确认后调用 deleteWorld() 删除世界并返回世界列表。

#### Scenario: 删除确认
- **WHEN** 用户在子操作菜单选择「删除」
- **THEN** 显示确认提示（世界名称 + entry 数 + 确认/取消选项）

#### Scenario: 确认删除
- **WHEN** 用户在确认提示选择「确认」
- **THEN** 删除世界目录，返回世界列表（列表刷新）

#### Scenario: 取消删除
- **WHEN** 用户在确认提示选择「取消」
- **THEN** 返回子操作菜单

### Requirement: World action menu bind/unbind entries
The world action menu SHALL replace the separate "bind" and "unbind" entries with a single "绑定管理" entry that does not require a loaded soul.

#### Scenario: Action menu shows bind management
- **WHEN** the action menu is displayed for a selected world
- **THEN** a single "绑定管理" action is shown (not separate bind/unbind), and it is always enabled regardless of whether a soul is loaded

#### Scenario: Bind management launches checkbox UI
- **WHEN** the user selects "绑定管理" from the action menu
- **THEN** the WorldBindCommand is rendered with only the worldName prop (no soulDir or action)

