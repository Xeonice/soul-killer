## MODIFIED Requirements

### Requirement: Entry 文件格式
每个世界条目 SHALL 是一个 `.md` 文件，使用 YAML frontmatter 描述元数据。Frontmatter SHALL 包含：`name`（string）、`keywords`（string[]）、`priority`（number, 0-1000）、`mode`（`"always"` | `"keyword"` | `"semantic"`）、`scope`（`"background"` | `"rule"` | `"lore"` | `"atmosphere"` | `"chronicle"`）。Frontmatter SHALL 包含 `dimension`（WorldDimension string）字段——新布局下 dimension 决定 entry 的存储子目录，旧版本允许 dimension 为 undefined 的兼容性被移除。Frontmatter MAY 包含可选字段 `sort_key`（number，仅 chronicle 使用）、`display_time`（string，仅 chronicle 使用）、`event_ref`（string，仅 chronicle timeline 使用）、`sort_key_inferred`（boolean，仅 chronicle 使用，缺省视为 true）、`importance`（`'high' | 'medium' | 'low'`，仅 chronicle timeline 使用）。

普通 entry 位于 `<dimension>/<name>.md`（按维度子目录划分）；history 维度的事件 detail 位于 `history/events/<name>.md`；history 维度的 timeline 聚合文件位于 `history/timeline.md`（单文件，非 frontmatter+body 的 entry）。

#### Scenario: 解析 keyword 模式条目
- **WHEN** 读取包含 `mode: keyword` 和 `keywords: ["荒坂", "Arasaka"]` frontmatter 的 entry 文件
- **THEN** 解析结果包含 `mode: "keyword"`，`keywords` 为 `["荒坂", "Arasaka"]`，body 为 frontmatter 之后的 markdown 内容

#### Scenario: 解析带 dimension 的条目
- **WHEN** 读取 `geography/night-city-districts.md`，frontmatter 含 `dimension: geography`
- **THEN** 解析结果包含 `dimension: 'geography'`，其他字段正常解析
- **AND** 文件路径与 frontmatter 的 dimension 一致

#### Scenario: 解析 chronicle scope 条目
- **WHEN** 读取 `history/events/arasaka-nuke.md`，frontmatter 含 `scope: chronicle`、`sort_key: 2020.613`、`display_time: "2020 年 8 月"`
- **THEN** 解析结果 meta 的 `scope` SHALL 为 `'chronicle'`
- **AND** `sort_key` SHALL 为 `2020.613`（number 类型）
- **AND** `display_time` SHALL 为 `"2020 年 8 月"`（string 类型）

### Requirement: Entry CRUD 操作
系统 SHALL 提供 `addEntry`、`loadEntry`、`loadAllEntries`、`removeEntry`、`updateEntry` 函数操作普通 entry。`addEntry` SHALL 根据 `meta.dimension` 将文件写入 `<worldDir>/<dimension>/<name>.md`；当 `meta.dimension` 缺失时 SHALL 通过 `inferDimensionFromScope(meta.scope)` 兜底。`loadAllEntries` SHALL 遍历所有维度子目录枚举 entry，并跳过所有 `_` 前缀文件和 `history/events/` 子目录（events 走 `loadChronicleEvents`）和 `history/timeline.md` 单文件（timeline 走 `loadChronicleTimeline`）。系统 SHALL 额外提供 `addChronicleEntry`、`loadChronicleTimeline`、`loadChronicleEvents`、`removeChronicleEntry` 函数操作 chronicle 相关数据。

#### Scenario: 添加带 dimension 的条目
- **WHEN** 调用 `addEntry("night-city", { name: "megacorps", dimension: "factions", ... }, content)`
- **THEN** 创建文件 `~/.soulkiller/worlds/night-city/factions/megacorps.md`

#### Scenario: 缺失 dimension 的兜底
- **WHEN** 调用 `addEntry("night-city", { name: "mood", scope: "atmosphere", ... }, content)` 且 meta 无 dimension
- **THEN** 使用 `inferDimensionFromScope('atmosphere') = 'atmosphere'`
- **AND** 创建文件 `worlds/night-city/atmosphere/mood.md`

#### Scenario: loadAllEntries 遍历所有维度子目录
- **WHEN** 世界 "night-city" 的 `factions/` 有 3 个 entry、`figures/` 有 2 个 entry、`history/` 有 1 个非事件 entry
- **THEN** `loadAllEntries("night-city")` 返回 6 个 Entry 对象

#### Scenario: loadAllEntries 跳过 _ 前缀文件
- **WHEN** `factions/` 目录下有 `cao-wei-central.md`、`shu-han-court.md` 和 `_index.md`
- **THEN** `loadAllEntries` 返回的 factions entry 为 2 个（不含 `_index.md`）

#### Scenario: loadAllEntries 跳过 events 和 timeline.md
- **WHEN** 世界有 `history/late-han-trends.md`、`history/events/battle-of-chibi.md`、`history/timeline.md`
- **THEN** `loadAllEntries` 返回的 history entry 只有 `late-han-trends`（1 个）
- **AND** `history/events/*` 由 `loadChronicleEvents` 负责
- **AND** `history/timeline.md` 由 `loadChronicleTimeline` 负责

#### Scenario: 添加 chronicle timeline 条目
- **WHEN** 调用 `addChronicleEntry(worldName, 'timeline', meta, content)`
- **THEN** 更新 `history/timeline.md` 单文件（合并或追加对应段落）

#### Scenario: 添加 chronicle events 条目
- **WHEN** 调用 `addChronicleEntry(worldName, 'events', meta, content)`
- **THEN** 创建文件 `history/events/<meta.name>.md`

#### Scenario: 加载 timeline
- **WHEN** 世界的 `history/timeline.md` 含 5 个 `## ` 段落
- **THEN** `loadChronicleTimeline(worldName)` 返回 5 个 WorldEntry 对象（每个段落解析为一个 entry）

#### Scenario: 老世界无 history 目录
- **WHEN** 世界的 `history/` 目录不存在
- **THEN** `loadChronicleTimeline` 和 `loadChronicleEvents` 均返回空数组，不报错

### Requirement: Entry dimension 字段
EntryMeta SHALL 包含必需的 `dimension: WorldDimension` 字段（新布局下不再允许 undefined）。该字段决定 entry 的存储子目录和语义分类。classify 阶段若 LLM 未返回 dimension SHALL 通过 `inferDimensionFromScope` 兜底补全，不允许最终写入的 entry 缺失 dimension。

#### Scenario: 带 dimension 的 entry frontmatter
- **WHEN** 读取包含 `dimension: geography` frontmatter 的 entry 文件
- **THEN** 解析结果的 meta 包含 `dimension: 'geography'`

#### Scenario: classify 缺失 dimension 走兜底
- **WHEN** LLM 在 classify 阶段未返回 dimension 字段
- **THEN** distill 流程 SHALL 调用 `inferDimensionFromScope(scope)` 补全
- **AND** review 阶段 SHALL 记录一行日志："N entries had inferred dimension"

#### Scenario: dimension 写入 frontmatter
- **WHEN** 调用 `addEntry(worldName, { ...meta, dimension: 'systems' }, content)`
- **THEN** 生成的 .md 文件 frontmatter 包含 `dimension: systems`
- **AND** 文件位于 `systems/` 子目录下
