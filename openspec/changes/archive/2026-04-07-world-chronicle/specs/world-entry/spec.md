## MODIFIED Requirements

### Requirement: Entry 文件格式
每个世界条目 SHALL 是一个 `.md` 文件，使用 YAML frontmatter 描述元数据。Frontmatter SHALL 包含：`name`（string）、`keywords`（string[]）、`priority`（number, 0-1000）、`mode`（`"always"` | `"keyword"` | `"semantic"`）、`scope`（`"background"` | `"rule"` | `"lore"` | `"atmosphere"` | `"chronicle"`）。Frontmatter MAY 包含可选字段 `dimension`（WorldDimension string）、`sort_key`（number，仅 chronicle 使用）、`display_time`（string，仅 chronicle 使用）、`event_ref`（string，仅 chronicle timeline 使用）、`sort_key_inferred`（boolean，仅 chronicle 使用，缺省视为 true）。

普通 entry 位于 `entries/` 目录下；chronicle entry 位于 `chronicle/timeline/` 或 `chronicle/events/` 目录下。

#### Scenario: 解析 keyword 模式条目
- **WHEN** 读取包含 `mode: keyword` 和 `keywords: ["荒坂", "Arasaka"]` frontmatter 的 entry 文件
- **THEN** 解析结果包含 `mode: "keyword"`，`keywords` 为 `["荒坂", "Arasaka"]`，body 为 frontmatter 之后的 markdown 内容

#### Scenario: 解析带 dimension 的条目
- **WHEN** 读取包含 `dimension: geography` 的 entry 文件
- **THEN** 解析结果包含 `dimension: 'geography'`，其他字段正常解析

#### Scenario: 解析 chronicle scope 条目
- **WHEN** 读取包含 `scope: chronicle`、`sort_key: 2020.613`、`display_time: "2020 年 8 月"` 的 entry 文件
- **THEN** 解析结果 meta 的 `scope` SHALL 为 `'chronicle'`
- **AND** `sort_key` SHALL 为 `2020.613`（number 类型）
- **AND** `display_time` SHALL 为 `"2020 年 8 月"`（string 类型）

#### Scenario: 解析带 event_ref 的底色条目
- **WHEN** 读取 `chronicle/timeline/2020-arasaka-nuke.md`，frontmatter 含 `event_ref: 2020-arasaka-nuke`
- **THEN** 解析结果 meta 的 `event_ref` SHALL 为 `'2020-arasaka-nuke'`

### Requirement: Entry CRUD 操作
系统 SHALL 提供 `addEntry`、`loadEntry`、`loadAllEntries`、`removeEntry`、`updateEntry` 函数操作普通 entry（位于 `entries/`）。系统 SHALL 额外提供 `addChronicleEntry`、`loadChronicleTimeline`、`loadChronicleEvents`、`removeChronicleEntry` 函数操作 chronicle entry（位于 `chronicle/timeline/` 和 `chronicle/events/`）。

#### Scenario: 添加普通条目
- **WHEN** 调用 `addEntry(worldName, { name: "megacorps", mode: "keyword", ... }, content)`
- **THEN** 创建文件 `~/.soulkiller/worlds/<worldName>/entries/megacorps.md`

#### Scenario: 加载所有普通条目
- **WHEN** 世界 "night-city" 的 `entries/` 目录下有 3 个 `.md` 文件
- **THEN** `loadAllEntries("night-city")` 返回 3 个 Entry 对象，且 chronicle 子目录不参与该枚举

#### Scenario: 添加 chronicle timeline 条目
- **WHEN** 调用 `addChronicleEntry(worldName, 'timeline', meta, content)`，meta.scope 为 `'chronicle'`
- **THEN** 创建文件 `chronicle/timeline/<meta.name>.md`

#### Scenario: 添加 chronicle events 条目
- **WHEN** 调用 `addChronicleEntry(worldName, 'events', meta, content)`
- **THEN** 创建文件 `chronicle/events/<meta.name>.md`

#### Scenario: 加载 timeline
- **WHEN** 世界的 `chronicle/timeline/` 下有 5 个 `.md` 文件
- **THEN** `loadChronicleTimeline(worldName)` 返回 5 个 WorldEntry 对象

#### Scenario: 老世界无 chronicle 目录
- **WHEN** 世界的 `chronicle/` 目录不存在
- **THEN** `loadChronicleTimeline` 和 `loadChronicleEvents` 均返回空数组，不报错

### Requirement: Entry scope 分类
条目的 `scope` 字段 SHALL 决定其在 context 中的语义角色：
- `background`：世界背景，注入靠前位置
- `rule`：世界规则/约束，注入靠前位置
- `lore`：知识条目，按需召回
- `atmosphere`：氛围暗示，影响回复风格
- `chronicle`：编年史条目，底色 entry 在 background+rule 之后聚合注入；详情 entry 走 keyword 召回

#### Scenario: chronicle 底色注入位置
- **WHEN** context assembler 处理 chronicle 底色条目（mode: always, scope: chronicle）
- **THEN** SHALL 将其按 sort_key 升序聚合，作为一个独立块注入在 background+rule 之后、soul identity 之前

#### Scenario: chronicle 详情注入路径
- **WHEN** context assembler 处理 chronicle 详情条目（mode: keyword, scope: chronicle）
- **THEN** SHALL 走与 lore 相同的 keyword 触发链路（不参与 chronicle 底色聚合）

#### Scenario: 不同 scope 的注入位置
- **WHEN** context assembler 处理条目时
- **THEN** `background` 和 `rule` scope 的条目放在 soul files 之前
- **AND** `lore` scope 的条目按 keyword/semantic 触发后放在 soul files 之后
- **AND** `atmosphere` scope 的条目放在 context 末尾
