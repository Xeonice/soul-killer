## ADDED Requirements

### Requirement: supplementWorld prop 外部补充模式入口
WorldCreateWizard SHALL 接受可选的 `supplementWorld?: string` prop。当提供时，SHALL 加载已有世界的 manifest，设置 supplementMode，初始步骤直接跳到 `data-sources`，跳过 type-select/name/display-name/description/tags/confirm。

#### Scenario: 通过 prop 进入补充模式
- **WHEN** 渲染 `<WorldCreateWizard supplementWorld="night-city" />`
- **THEN** 加载 night-city 的 manifest，直接显示数据源选择步骤

#### Scenario: 补充模式完成后追加 entries
- **WHEN** 补充模式完成蒸馏和审查
- **THEN** 新 entries 追加到已有世界，manifest.entry_count 更新
