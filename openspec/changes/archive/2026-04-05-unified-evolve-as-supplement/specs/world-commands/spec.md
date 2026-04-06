## MODIFIED Requirements

### Requirement: 子操作菜单（选中世界后）
选中世界后 SHALL 显示子操作菜单，包含：详情、条目、蒸馏（数据导入）、绑定、解绑。「蒸馏」操作 SHALL 渲染 `WorldCreateWizard(supplementWorld=worldName)` 进入补充模式，而非独立的 WorldDistillCommand。

#### Scenario: 蒸馏操作进入 wizard 补充模式
- **WHEN** 用户在子操作菜单选择「蒸馏」
- **THEN** 渲染 WorldCreateWizard，supplementWorld 设为当前选中世界的 name，直接显示数据源选择
