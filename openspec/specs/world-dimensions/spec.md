## ADDED Requirements

### Requirement: World 维度定义
系统 SHALL 定义 `WorldDimension` 类型，包含 9 个搜索维度：`geography`（空间）、`history`（时间）、`factions`（势力）、`systems`（体系）、`society`（社会）、`culture`（文化）、`species`（族群）、`figures`（人物）、`atmosphere`（氛围）。

#### Scenario: 维度类型完整性
- **WHEN** 导入 `WorldDimension` 类型
- **THEN** 可用值为 `'geography' | 'history' | 'factions' | 'systems' | 'society' | 'culture' | 'species' | 'figures' | 'atmosphere'`

### Requirement: 维度优先级
每个维度 SHALL 有 `WorldDimensionPriority`（`'required' | 'important' | 'supplementary'`）。geography/history/factions 为 `required`；systems/society/culture/species 为 `important`；figures/atmosphere 为 `supplementary`。

#### Scenario: 查询维度优先级
- **WHEN** 读取 `WORLD_DIMENSIONS.geography.priority`
- **THEN** 返回 `'required'`

#### Scenario: 查询 supplementary 维度
- **WHEN** 读取 `WORLD_DIMENSIONS.atmosphere.priority`
- **THEN** 返回 `'supplementary'`

### Requirement: 维度描述
每个维度 SHALL 包含 `description`（中文描述字符串）用于 UI 展示和搜索引导。

#### Scenario: geography 描述
- **WHEN** 读取 `WORLD_DIMENSIONS.geography.description`
- **THEN** 返回包含"空间"、"地点"等关键词的描述字符串

### Requirement: 维度到 scope 默认映射
每个维度 SHALL 包含 `distillTarget` 字段，映射到 EntryScope（`'background' | 'rule' | 'lore' | 'atmosphere'`）。geography/history → background；systems → rule；factions/society/culture/species/figures → lore；atmosphere → atmosphere。

#### Scenario: systems 维度默认映射到 rule scope
- **WHEN** 读取 `WORLD_DIMENSIONS.systems.distillTarget`
- **THEN** 返回 `'rule'`

#### Scenario: figures 维度默认映射到 lore scope
- **WHEN** 读取 `WORLD_DIMENSIONS.figures.distillTarget`
- **THEN** 返回 `'lore'`

### Requirement: 维度信号检测
系统 SHALL 为每个维度提供 `WORLD_DIMENSION_SIGNALS`（正则表达式数组），用于从文本内容中检测维度信号。信号 SHALL 支持中英文匹配。

#### Scenario: 检测 geography 信号
- **WHEN** 文本包含 "located in" 或 "位于"
- **THEN** geography 维度的信号正则匹配成功

#### Scenario: 检测 species 信号
- **WHEN** 文本包含 "种族" 或 "race" 或 "species"
- **THEN** species 维度的信号正则匹配成功

### Requirement: 搜索模板
系统 SHALL 为每种 WorldClassification（FICTIONAL_UNIVERSE/REAL_SETTING）提供每个维度的搜索查询模板。模板 SHALL 支持 `{name}`、`{localName}`、`{origin}` 占位符替换。history 维度的 queries 数组 SHALL 包含 7 条模板（原有 5 条 + 2 条新增的 timeline-bias query）：
- 原有：`'{name} timeline events'`、`'{name} history lore'`、`'{name} wiki chronology'`、`'{localName} 历史 时间线'`、`'{localName} 大事件'`
- 新增：`'{localName} 年表'`、`'timeline of {name}'`

新增 query 的目的是提升搜到结构化年表类素材（中文百科的"年表"、Wikipedia 的 "Timeline of" 页面）的命中率，为 history distill 的三 Pass 流程提供更适合抽取时间锚点的原文。

#### Scenario: FICTIONAL_UNIVERSE 的 geography 搜索模板
- **WHEN** 调用 `generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Night City', '夜之城', 'Cyberpunk 2077')`
- **THEN** geography 维度的 queries 包含替换后的搜索词，如 "Night City map locations districts regions"

#### Scenario: REAL_SETTING 的 factions 搜索模板
- **WHEN** 调用 `generateWorldSearchPlan('REAL_SETTING', 'Alibaba', '阿里巴巴', '')`
- **THEN** factions 维度的 queries 包含 "Alibaba organizations departments structure"

#### Scenario: history 维度包含新增 timeline query
- **WHEN** 调用 `generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Three Kingdoms', '三国', '')`
- **THEN** history 维度的 queries 列表长度为 7
- **AND** 包含替换后的 `"三国 年表"`
- **AND** 包含替换后的 `"timeline of Three Kingdoms"`

#### Scenario: history 维度模板在真实世界上的应用
- **WHEN** 调用 `generateWorldSearchPlan('REAL_SETTING', 'Meiji Restoration', '明治维新', '')`
- **THEN** history 维度的 queries 包含 `"明治维新 年表"` 和 `"timeline of Meiji Restoration"`

### Requirement: 搜索计划生成
系统 SHALL 提供 `generateWorldSearchPlan()` 函数，根据 classification、englishName、localName、origin 生成完整的搜索计划，包含所有 9 个维度的查询列表。UNKNOWN_SETTING 分类 SHALL 返回空维度列表。

#### Scenario: 生成搜索计划
- **WHEN** 调用 `generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Middle Earth', '中土世界', 'Lord of the Rings')`
- **THEN** 返回包含 9 个维度的搜索计划，每个维度有 2-3 个查询

#### Scenario: UNKNOWN_SETTING 返回空计划
- **WHEN** 调用 `generateWorldSearchPlan('UNKNOWN_SETTING', '', '', '')`
- **THEN** 返回空维度列表

### Requirement: Coverage 分析
系统 SHALL 提供 `analyzeWorldCoverage()` 函数，分析提取结果的维度覆盖率。SHALL 返回每个维度的覆盖计数、总覆盖数、required 覆盖数、是否可以 report（至少 4 个维度覆盖，其中至少 2 个 required）以及建议文本。

#### Scenario: 覆盖足够可以 report
- **WHEN** extractions ���盖了 geography、history、factions、systems 四个维度
- **THEN** `canReport` 为 true（4 维度��盖，2 个 required）

#### Scenario: 覆盖不足
- **WHEN** extractions 只覆盖了 atmosphere、figures 两个维度
- **THEN** `canReport` 为 false，suggestion 提示缺少 required 维度
