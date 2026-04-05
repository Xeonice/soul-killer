## ADDED Requirements

### Requirement: /world 交互式子菜单
系统 SHALL 提供 `/world` 命令，进入交互式子菜单模式（类似 `/config`）。菜单 SHALL 显示所有可用操作（创建、列表、详情、条目、绑定、解绑、蒸馏、进化），用户通过方向键选择、Enter 进入、ESC 退出。所有参数 SHALL 通过后续交互步骤收集，不需要在命令行中预先指定。

#### Scenario: 进入世界管理菜单
- **WHEN** 用户输入 `/world`
- **THEN** 显示交互式子菜单，包含 8 个操作选项，可用方向键导航

#### Scenario: ESC 退出菜单
- **WHEN** 用户在菜单中按 ESC
- **THEN** 退出世界管理，返回主 REPL

### Requirement: 创建世界（菜单 → 创建）
用户选择「创建」后 SHALL 直接进入 `WorldCreateWizard` 组件，不再由菜单层收集世界名称。Wizard 组件自包含管理整个创建流程。

#### Scenario: 从菜单进入创建
- **WHEN** 用户在菜单选择「创建」
- **THEN** 直接渲染 WorldCreateWizard（不先收集名称），Wizard 内部从 name 步骤开始

#### Scenario: 创建完成返回菜单
- **WHEN** 创建向导完成或取消
- **THEN** 返回世界管理主菜单

### Requirement: 查看世界列表（菜单 → 列表）
用户选择「列表」后 SHALL 直接展示所有已安装世界的摘要信息。

#### Scenario: 列出世界
- **WHEN** 用户在菜单选择「列表」
- **THEN** 显示所有世界的 name、display_name、entry_count、version

### Requirement: 查看世界详情（菜单 → 详情）
用户选择「详情」后 SHALL 展示已安装世界的选择列表（方向键选择），选中后显示该世界的元数据和条目。

#### Scenario: 交互式查看详情
- **WHEN** 用户在菜单选择「详情」，在世界选择列表中选择 "night-city"
- **THEN** 显示 night-city 的元数据、条目列表

### Requirement: 添加条目（菜单 → 条目）
用户选择「条目」后 SHALL 先展示世界选择列表，选中后进入 WorldEntryCommand 交互式收集条目信息。

#### Scenario: 交互式添加条目
- **WHEN** 用户在菜单选择「条目」，选择世界 "night-city"
- **THEN** 进入向导收集 entry name、mode、scope、keywords、priority、content

### Requirement: 绑定世界（菜单 → 绑定）
用户选择「绑定」后 SHALL 先展示世界选择列表，选中后进入 WorldBindCommand 收集 order。需要已加载 soul，未加载时菜单项 SHALL 显示为禁用状态并附提示文字。

#### Scenario: 交互式绑定
- **WHEN** 用户已 `/use johnny`，在菜单选择「绑定」，选择世界 "night-city"
- **THEN** 进入向导收集 priority order 后创建 binding

#### Scenario: 未加载 soul 时绑定项禁用
- **WHEN** 用户未执行 `/use`，查看菜单
- **THEN** 「绑定」和「解绑」选项显示为灰色，附 "需先 /use 加载分身" 提示

### Requirement: 解绑世界（菜单 → 解绑）
用户选择「解绑」后 SHALL 展示世界选择列表，选中后立即解绑。同样需要已加载 soul。

#### Scenario: 交互式解绑
- **WHEN** 用户在菜单选择「解绑」，选择世界 "night-city"
- **THEN** 删除对应的 binding 文件

### Requirement: 蒸馏世界（菜单 → 蒸馏）
用户选择「蒸馏」后 SHALL 交互式收集：世界名称 → 数据源路径（支持 Tab 路径补全）。收集完成后进入蒸馏流程。

#### Scenario: 交互式蒸馏
- **WHEN** 用户在菜单选择「蒸馏」，输入世界名 "night-city"，输入路径 "./novel.md"
- **THEN** 执行蒸馏流程，显示进度，完成后进入审查

### Requirement: 进化世界（菜单 → 进化）
用户选择「进化」后 SHALL 先展示已有世界选择列表，选中后收集数据源路径，然后执行增量蒸馏。

#### Scenario: 交互式进化
- **WHEN** 用户在菜单选择「进化」，选择世界 "night-city"，输入路径 "./dlc.md"
- **THEN** 蒸馏新数据，与已有条目合并，处理冲突后递增版本号

### Requirement: 操作完成后返回菜单
每个子操作完成后 SHALL 自动返回世界管理主菜单，而不是退出到主 REPL。用户需要按 ESC 才退出到主 REPL。

#### Scenario: 创建完成后返回
- **WHEN** 创建世界操作完成
- **THEN** 自动回到世界管理主菜单

### Requirement: 命令注册与补全
`/world` SHALL 注册到 command-registry 并支持 slash 补全。

#### Scenario: 命令补全
- **WHEN** 用户输入 `/wor` 并按 tab
- **THEN** 补全为 `/world`
