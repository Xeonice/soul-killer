# Soul Capabilities Dimension

capabilities 搜索维度：覆盖角色的能力、技能、属性数值、装备和专业知识。

## ADDED Requirements

### Requirement: capabilities 维度定义

`soul-dimensions.ts` SHALL 新增 `capabilities` 维度，优先级为 `important`，蒸馏目标为 `capabilities.md`。描述为"能力、技能、属性数值、装备、专业知识"。

#### Scenario: 维度注册

- **WHEN** DIMENSIONS record 被访问
- **THEN** SHALL 包含 `capabilities` 键
- **AND** priority 为 `important`
- **AND** distillTarget 为 `capabilities.md`

### Requirement: capabilities 信号检测

DIMENSION_SIGNALS SHALL 为 capabilities 定义正则模式，匹配能力/技能/属性/装备相关内容。

#### Scenario: 英文内容信号匹配

- **WHEN** chunk 内容包含 "abilities"、"powers"、"skills"、"stats"、"weapons"、"equipment" 或 "noble phantasm"
- **THEN** analyzeCoverage SHALL 将该 chunk 计入 capabilities 维度

#### Scenario: 中文内容信号匹配

- **WHEN** chunk 内容包含"能力"、"技能"、"属性"、"宝具"、"武器"、"装备"、"法术"、"方法论"
- **THEN** analyzeCoverage SHALL 将该 chunk 计入 capabilities 维度

### Requirement: capabilities 搜索模板

搜索模板 SHALL 按 classification 差异化定义 capabilities 维度的查询。

#### Scenario: DIGITAL_CONSTRUCT 搜索

- **WHEN** classification 为 DIGITAL_CONSTRUCT
- **THEN** capabilities 搜索模板 SHALL 包含能力/技能/属性/武器/装备相关查询

#### Scenario: PUBLIC_ENTITY 搜索

- **WHEN** classification 为 PUBLIC_ENTITY
- **THEN** capabilities 搜索模板 SHALL 包含专业技能/方法论/核心能力相关查询

#### Scenario: HISTORICAL_RECORD 搜索

- **WHEN** classification 为 HISTORICAL_RECORD
- **THEN** capabilities 搜索模板 SHALL 包含才能/成就/专长相关查询
