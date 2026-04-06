## MODIFIED Requirements

### Requirement: 创建世界（菜单 → 创建）
用户选择「创建」后 SHALL 直接进入重构后的 `WorldCreateWizard` 组件。Wizard 组件自包含管理整个创建流程，包含类型选择、Tags 输入、AI 搜索、多数据源组合、蒸馏面板、Bind 引导等全部步骤。

#### Scenario: 进入创建向导
- **WHEN** 用户在 /world 菜单选择「创建」
- **THEN** 渲染重构后的 WorldCreateWizard，包含完整的类型选择和 AI 搜索能力
