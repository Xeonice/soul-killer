## ADDED Requirements

### Requirement: DimensionDef 统一接口
系统 SHALL 定义 `DimensionDef` 接口，Soul 和 World 的维度定义均遵循此接口。

#### Scenario: DimensionDef 包含完整字段
- **WHEN** 定义一个维度
- **THEN** SHALL 包含 name(kebab-case)、display(人类可读)、description(给 LLM 的描述)、priority、source('base'|'extension')、signals(关键词数组)、queries(搜索模板数组)、distillTarget(scope)

#### Scenario: Soul 和 World 基础维度均实现 DimensionDef
- **WHEN** 定义 SOUL_BASE_DIMENSIONS 和 WORLD_BASE_DIMENSIONS
- **THEN** 每个维度 SHALL 遵循 DimensionDef 接口
- **AND** source SHALL 固定为 'base'

### Requirement: DimensionPlan 统一接口
系统 SHALL 定义 `DimensionPlan` 接口，包含分类信息和完整的维度列表(基础+扩展)。

#### Scenario: DimensionPlan 结构
- **WHEN** Planning Agent 生成维度计划
- **THEN** SHALL 返回 DimensionPlan，包含 classification、englishName、localName、origin、dimensions 数组
- **AND** dimensions 数组 SHALL 包含所有基础维度(可能已调整) + 扩展维度

### Requirement: signals 关键词转正则
系统 SHALL 提供 `signalsToRegex(signals: string[]): RegExp[]` 工具函数。

#### Scenario: CJK 关键词直接匹配
- **WHEN** signals 包含中文关键词如 "战役"
- **THEN** 生成的正则 SHALL 直接匹配该关键词(无 word boundary)

#### Scenario: 英文关键词 word boundary
- **WHEN** signals 包含英文关键词如 "military"
- **THEN** 生成的正则 SHALL 使用 `\b` word boundary 匹配
