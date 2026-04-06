## ADDED Requirements

### Requirement: 世界管理 E2E 测试覆盖
系统 SHALL 提供 E2E 测试覆盖 `/world` 管理操作的完整链路。测试 SHALL 使用 TestTerminal PTY 进行真实 CLI 交互。

#### Scenario: 创建世界后列表可见
- **WHEN** 通过 `/world` → 创建 创建了 "test-world"（fictional-original + 空数据源）
- **THEN** `/world` → 管理 的世界列表中包含 "test-world"

#### Scenario: 选世界查看详情
- **WHEN** 在世界列表中选中 "test-world" → 详情
- **THEN** 显示世界的 display_name、description、entry 列表

#### Scenario: 选世界添加条目
- **WHEN** 在子操作菜单选择「条目」并输入条目信息
- **THEN** 条目成功添加到世界

#### Scenario: 选世界蒸馏
- **WHEN** 在子操作菜单选择「蒸馏」并提供 markdown 路径
- **THEN** 蒸馏面板展示进度，完成后条目写入世界

#### Scenario: 选世界绑定
- **WHEN** 已加载 Soul，在子操作菜单选择「绑定」
- **THEN** 世界成功绑定到当前 Soul
