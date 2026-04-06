# Soul Milestones Dimension

milestones 搜索维度：覆盖角色的关键事件时间线、转折点、成长阶段和标志性成就。

## ADDED Requirements

### Requirement: milestones 维度定义

`soul-dimensions.ts` SHALL 新增 `milestones` 维度，优先级为 `important`，蒸馏目标为 `milestones.md`。描述为"关键事件时间线、转折点、成长阶段、标志性成就"。

#### Scenario: 维度注册

- **WHEN** DIMENSIONS record 被访问
- **THEN** SHALL 包含 `milestones` 键
- **AND** priority 为 `important`
- **AND** distillTarget 为 `milestones.md`

### Requirement: milestones 信号检测

DIMENSION_SIGNALS SHALL 为 milestones 定义正则模式，匹配时间线/事件/转折点相关内容。

#### Scenario: 英文内容信号匹配

- **WHEN** chunk 内容包含 "timeline"、"key events"、"turning point"、"milestone"、"major battle" 或 "story arc"
- **THEN** analyzeCoverage SHALL 将该 chunk 计入 milestones 维度

#### Scenario: 中文内容信号匹配

- **WHEN** chunk 内容包含"时间线"、"关键事件"、"转折点"、"里程碑"、"重大战役"、"经历"、"编年"
- **THEN** analyzeCoverage SHALL 将该 chunk 计入 milestones 维度

### Requirement: milestones 搜索模板

搜索模板 SHALL 按 classification 差异化定义 milestones 维度的查询。

#### Scenario: DIGITAL_CONSTRUCT 搜索

- **WHEN** classification 为 DIGITAL_CONSTRUCT
- **THEN** milestones 搜索模板 SHALL 包含时间线/关键事件/故事弧/重大战斗相关查询

#### Scenario: PUBLIC_ENTITY 搜索

- **WHEN** classification 为 PUBLIC_ENTITY
- **THEN** milestones 搜索模板 SHALL 包含生涯时间线/关键决策/里程碑相关查询
