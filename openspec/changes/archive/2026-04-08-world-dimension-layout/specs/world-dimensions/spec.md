## MODIFIED Requirements

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
