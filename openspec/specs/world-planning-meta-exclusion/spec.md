# world-planning-meta-exclusion Specification

## Purpose
TBD - created by syncing change world-planning-meta-filter. Update Purpose after archive.
## Requirements
### Requirement: Planning Agent prompt 包含世界内信息目标声明
`buildPlanningPrompt()` 生成的 prompt SHALL 包含一个明确的段落，定义搜索目标为"故事世界内部的事实"，并列举必须排除的 meta 信息类型（发售日期、平台移植、声优阵容、制作公司、播出时间表、评价、周边等）。

#### Scenario: prompt 包含 meta 排斥清单
- **WHEN** `buildPlanningPrompt()` 被调用且 type 为 'world'
- **THEN** 返回的 prompt SHALL 包含关于排除 release dates, voice actors, production studios, broadcast schedules 等 meta 信息的明确指令

#### Scenario: soul 类型不受影响
- **WHEN** `buildPlanningPrompt()` 被调用且 type 为 'soul'
- **THEN** 返回的 prompt SHALL 不包含世界内信息目标声明（soul capture 不存在此问题）

### Requirement: classification 条件分支策略
`buildPlanningPrompt()` SHALL 基于 `classification` 参数为 `REAL_SETTING` 类世界生成更严格的搜索限定指令。

#### Scenario: REAL_SETTING 启用限定词策略
- **WHEN** classification 为 `REAL_SETTING`
- **THEN** prompt SHALL 要求 Planning Agent 在每条 query 中附加 "故事内/剧情/设定/in-story" 等限定词，并优先使用角色名+事件描述而非纯作品标题搜索

#### Scenario: FICTIONAL_UNIVERSE 保持宽松策略
- **WHEN** classification 为 `FICTIONAL_UNIVERSE`
- **THEN** prompt SHALL 不要求额外的限定词（幻想世界的 query 天然指向世界内信息）

#### Scenario: UNKNOWN_SETTING 走保守路径
- **WHEN** classification 为 `UNKNOWN_SETTING`
- **THEN** prompt SHALL 按 `REAL_SETTING` 的严格策略处理

### Requirement: WORLD_DIMENSION_TEMPLATES qualityCriteria 包含 meta 排斥条目
`WORLD_DIMENSION_TEMPLATES` 中每个维度的 `qualityCriteria` 数组 SHALL 包含一条关于排除作品 meta 信息的默认条目。

#### Scenario: 每个模板维度有 meta 排斥 criteria
- **WHEN** 读取 WORLD_DIMENSION_TEMPLATES 的任意维度
- **THEN** 该维度的 qualityCriteria 数组 SHALL 包含至少一条明确的 meta 排斥描述

#### Scenario: 排斥条目被传递到 quality scoring
- **WHEN** Planning Agent 使用模板生成搜索计划
- **THEN** 输出的 qualityCriteria SHALL 继承或包含等效的 meta 排斥条目
