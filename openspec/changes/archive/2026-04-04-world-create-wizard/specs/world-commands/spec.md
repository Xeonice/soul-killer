## MODIFIED Requirements

### Requirement: /world 交互式子菜单
系统 SHALL 提供 `/world` 命令，进入交互式子菜单模式。菜单中「创建」选项 SHALL 直接进入 `WorldCreateWizard` 组件，不再由菜单层收集世界名称。Wizard 组件自包含管理整个创建流程。

#### Scenario: 从菜单进入创建
- **WHEN** 用户在菜单选择「创建」
- **THEN** 直接渲染 WorldCreateWizard（不先收集名称），Wizard 内部从 name 步骤开始

#### Scenario: 创建完成返回菜单
- **WHEN** 创建向导完成或取消
- **THEN** 返回世界管理主菜单
