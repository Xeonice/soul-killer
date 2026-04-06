## ADDED Requirements

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
