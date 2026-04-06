## MODIFIED Requirements

### Requirement: Chunk 分类阶段
系统 SHALL 使用 LLM 为每个 chunk 分配 scope 标签（background/rule/lore/atmosphere/irrelevant）和 dimension 标签（WorldDimension 或 irrelevant）。标记为 `irrelevant` 的 chunk SHALL 被过滤掉不进入后续阶段。分类 prompt SHALL 根据 WorldClassification 调整（FICTIONAL_UNIVERSE 强调虚构设定元素，REAL_SETTING 强调真实信息）。

#### Scenario: 分类结果包含 dimension
- **WHEN** LLM 对一段关于"夜之城六个区域"的 chunk 进行分类
- **THEN** 返回 `{ scope: 'lore', dimension: 'geography' }`

#### Scenario: 真实世界分类 prompt 调整
- **WHEN** WorldClassification 为 REAL_SETTING
- **THEN** 分类 prompt 引导 LLM 关注真实地理、组织、历史事件等

### Requirement: 条目生成阶段
系统 SHALL 使用 LLM 为每个 cluster 生成一个 entry，包含：name（英文 kebab-case）、keywords（触发关键词列表）、mode（推荐的触发模式）、priority（推荐的优先级）、scope（继承自分类阶段或使用维度默认映射）、dimension（WorldDimension，继承自分类阶段）和 content（条目正文）。

#### Scenario: 生成带 dimension 的 entry
- **WHEN** cluster 的维度标注为 `systems`
- **THEN** 生成的 entry meta 包含 `dimension: 'systems'`，scope 默认为 `'rule'`（可被 LLM 覆盖）

## ADDED Requirements

### Requirement: 蒸馏接受 WorldClassification 参数
`WorldDistiller.distill()` SHALL 接受可选的 `classification?: WorldClassification` 参数，用于调整分类阶段的 LLM prompt。当未提供时 SHALL 使用默认 prompt。

#### Scenario: 带 classification 的蒸馏
- **WHEN** 调用 `distiller.distill(worldName, sourcePath, 'markdown', 'FICTIONAL_UNIVERSE')`
- **THEN** 分类阶段的 prompt 针对虚构世界设定优化

### Requirement: GeneratedEntry 包含 dimension
`GeneratedEntry` 接口的 meta 字段 SHALL 包含可选的 `dimension?: WorldDimension`。蒸馏生成的 entry SHALL 自动带上 dimension 标注。

#### Scenario: 蒸馏产出带 dimension
- **WHEN** 蒸馏完成后返回 GeneratedEntry 数组
- **THEN** 每个 entry 的 meta.dimension 有值（WorldDimension 类型）
