## MODIFIED Requirements

### Requirement: Panel visual identity
The panel SHALL display with a Cyberpunk-themed visual style. Panel SHALL support two modes via `mode` prop: `'soul'`（标题 "SOULKILLER PROTOCOL"）和 `'world'`（标题 "WORLDFORGE PROTOCOL"）。默认为 `'soul'`（向后兼容）。

#### Scenario: Soul 模式标题
- **WHEN** panel 的 mode 为 `'soul'` 或未指定
- **THEN** 面板标题显示 "SOULKILLER PROTOCOL"

#### Scenario: World 模式标题
- **WHEN** panel 的 mode 为 `'world'`
- **THEN** 面板标题显示 "WORLDFORGE PROTOCOL"

### Requirement: Panel displays search plan dimensions
The protocol panel SHALL display a dimension priority indicator after classification is revealed, showing each dimension with a visual marker for its priority level. Soul 模式显示 6 个 Soul 维度，World 模式显示 9 个 World 维度。维度列表和标签 SHALL 由 props 传入（`classificationLabels` 和 `searchPlan`），不再硬编码。

#### Scenario: World 模式展示 9 维度
- **WHEN** panel mode 为 `'world'`，searchPlan 包含 9 个维度
- **THEN** 面板展示 9 个维度的优先级指示器

#### Scenario: Soul 模式展示 6 维度（向后兼容）
- **WHEN** panel mode 为 `'soul'`，searchPlan 包含 6 个维度
- **THEN** 面板展示 6 个维度的优先级指示器

### Requirement: UNKNOWN_ENTITY malfunction display
The panel SHALL display a distinct malfunction-style output for unknown targets. Soul 模式显示 UNKNOWN_ENTITY，World 模式显示 UNKNOWN_SETTING。classification 标签 SHALL 由 `classificationLabels` prop 传入而非硬编码。

#### Scenario: World 模式 UNKNOWN_SETTING 显示
- **WHEN** panel mode 为 `'world'`，phase 为 `'unknown'`
- **THEN** 显示 UNKNOWN_SETTING malfunction 面板

## ADDED Requirements

### Requirement: 泛化 Props 接口
Panel SHALL 使用泛化的 Props 接口：`classification` 为 `string`（不再绑定 TargetClassification 类型），新增 `classificationLabels: Record<string, string>` prop 由调用方传入分类标签映射，新增 `mode: 'soul' | 'world'` prop（默认 `'soul'`）。

#### Scenario: World 调用方传入分类标签
- **WHEN** 以 `mode='world'`、`classificationLabels={ FICTIONAL_UNIVERSE: 'FICTIONAL UNIVERSE', ... }` 调用 panel
- **THEN** panel 使用传入的标签映射展示 classification
