## MODIFIED Requirements

### Requirement: /world 交互式子菜单
系统 SHALL 提供 `/world` 命令，进入两层交互式菜单。顶层菜单 SHALL 显示两个选项：「创建」和「管理」。用户通过方向键选择、Enter 进入、ESC 退出。当没有已安装世界时，「管理」选项 SHALL 显示为禁用状态。

#### Scenario: 顶层菜单展示
- **WHEN** 用户执行 `/world`
- **THEN** 显示「创建」和「管理」两个选项

#### Scenario: 无已安装世界时管理禁用
- **WHEN** 用户执行 `/world` 且无已安装世界
- **THEN** 「管理」选项显示为禁用状态

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
选中世界后 SHALL 显示子操作菜单，包含：详情、条目、蒸馏、进化、绑定、解绑。绑定/解绑需要已加载 Soul，未加载时 SHALL 显示为禁用。ESC SHALL 返回世界列表。

#### Scenario: 子操作菜单展示
- **WHEN** 用户选中 "night-city"
- **THEN** 显示子操作菜单，标题为 "night-city — Night City"，包含详情/条目/蒸馏/进化/绑定/解绑

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

## REMOVED Requirements

### Requirement: 查看世界列表（菜单 → 列表）
**Reason**: 合并到「管理」选项中，列表现在是世界选择的一部分
**Migration**: 使用「管理」进入世界列表

### Requirement: 查看世界详情（菜单 → 详情）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 详情

### Requirement: 添加条目（菜单 → 条目）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 条目

### Requirement: 绑定世界（菜单 → 绑定）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 绑定

### Requirement: 解绑世界（菜单 → 解绑）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 解绑

### Requirement: 蒸馏世界（菜单 → 蒸馏）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 蒸馏

### Requirement: 进化世界（菜单 → 进化）
**Reason**: 合并到子操作菜单中
**Migration**: 「管理」→ 选世界 → 进化
