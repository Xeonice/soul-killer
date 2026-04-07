## MODIFIED Requirements

### Requirement: Chronicle 目录结构
每个世界 SHALL 在 `~/.soulkiller/worlds/<name>/history/` 维度目录下维护 chronicle 数据。timeline 数据 SHALL 存放在单个文件 `history/timeline.md`，events detail 数据 SHALL 存放在子目录 `history/events/<stem>.md`。旧的 `chronicle/` 顶级子目录 SHALL 不再使用。两种数据可独立存在，缺失任一不构成错误。

#### Scenario: 完整 history chronicle 结构
- **WHEN** 一个新世界完成 distill 并产出编年史
- **THEN** 文件系统 SHALL 包含 `worlds/<name>/history/timeline.md`（单文件）和 `worlds/<name>/history/events/<stem>.md`（多文件）
- **AND** 不存在 `worlds/<name>/chronicle/` 目录

#### Scenario: 老世界无 history 目录
- **WHEN** 加载一个不含 `history/` 目录的老世界
- **THEN** 系统 SHALL 视 chronicle timeline 和 events 均为空，**不**抛出错误
- **AND** 后续 context assembly、export packaging 也 SHALL 优雅处理空 chronicle

#### Scenario: 仅有 events 无 timeline.md
- **WHEN** `history/events/` 存在但 `history/timeline.md` 不存在
- **THEN** `loadChronicleTimeline` 返回空数组
- **AND** `loadChronicleEvents` 正常返回 events 数组

### Requirement: Timeline 单文件格式
`history/timeline.md` SHALL 是一个带 frontmatter 的 markdown 文件，frontmatter 包含 `type: chronicle-timeline`、`dimension: history`、`mode: always`。body 以 `# <标题>` 开头，每个 timeline 条目用 `## ` 二级标题分段。每段的第一行可选使用 `> ref: ./events/<stem>.md` 引用对应 events detail 文件，`> sort_key: <number>`、`> display_time: "<label>"`、`> importance: <level>` 等元数据行紧随其后，再是一行条目正文。解析器 SHALL 将每个 `## ` 段落转换为一个 `WorldEntry` 对象（mode: always、scope: chronicle、dimension: history）。

#### Scenario: 解析 timeline.md
- **WHEN** `history/timeline.md` 包含 3 个 `## ` 段落
- **THEN** `loadChronicleTimeline` 返回 3 个 WorldEntry 对象
- **AND** 每个 entry 的 mode 为 `'always'`、scope 为 `'chronicle'`、dimension 为 `'history'`

#### Scenario: 解析段落的 sort_key 元数据
- **WHEN** 一个 `## ` 段落下方含 `> sort_key: 208`
- **THEN** 对应 entry 的 meta.sort_key 为 `208`

#### Scenario: 解析段落的 display_time 元数据
- **WHEN** 一个段落下方含 `> display_time: "208 年"`
- **THEN** 对应 entry 的 meta.display_time 为 `"208 年"`

#### Scenario: 解析 ref 为 event_ref
- **WHEN** 一个段落下方含 `> ref: ./events/battle-of-chibi.md`
- **THEN** 对应 entry 的 meta.event_ref 为 `"battle-of-chibi"`（解析为 stem）

#### Scenario: name 从段落标题推断
- **WHEN** 一个段落标题为 `## 208 — 赤壁之战` 但没有显式 name 元数据
- **THEN** 对应 entry 的 meta.name 从 ref 推断（如有），否则从标题的 kebab-case 化推断

### Requirement: Chronicle 双层语义
Chronicle 由**底色层**（timeline）和**详情层**（events）组成。底色层存储在 `history/timeline.md` 单文件中，每个段落是一行事件描述，always 注入；详情层存储在 `history/events/` 目录下，每个文件是完整的事件描述，按 keyword 触发召回。

#### Scenario: 底色 entry 的形态
- **WHEN** 从 `history/timeline.md` 加载一个 entry
- **THEN** 该 entry meta 的 `mode` SHALL 为 `'always'`
- **AND** `scope` SHALL 为 `'chronicle'`
- **AND** body 是一行简短事件描述（典型长度 < 100 字符）

#### Scenario: 详情 entry 的形态
- **WHEN** 读取 `history/events/arasaka-nuke.md`
- **THEN** 该 entry meta 的 `mode` SHALL 为 `'keyword'`
- **AND** `scope` SHALL 为 `'chronicle'`
- **AND** `keywords` 字段非空
- **AND** body 是完整段落描述

### Requirement: Timeline 与 Events 的关联
底色 entry 通过 `> ref: ./events/<stem>.md` 元数据行显式引用对应的详情 events 文件（通过 ref 解析出的 stem 写入 `meta.event_ref`）。当 `> ref:` 缺失但 events 子目录中存在同 stem 文件时，系统 SHALL 回退到同名匹配。

#### Scenario: 显式 ref 关联
- **WHEN** timeline.md 的某段含 `> ref: ./events/arasaka-nuke.md`，`history/events/arasaka-nuke.md` 存在
- **THEN** 该 timeline entry 的 event_ref 为 `"arasaka-nuke"`
- **AND** runtime 将其与对应 events entry 绑定

#### Scenario: 同名回退关联
- **WHEN** timeline.md 的某段无 `> ref:` 但段落推断的 name 为 `arasaka-nuke`，且 `history/events/arasaka-nuke.md` 存在
- **THEN** 系统 SHALL 自动关联，无需显式 `> ref:`

#### Scenario: 仅有底色无详情
- **WHEN** 只存在 timeline.md 的某段，无对应 events 文件
- **THEN** 该底色事件 SHALL 仍然可以被注入
- **AND** 不会因为缺少详情而报错

### Requirement: Chronicle 加载 API
系统 SHALL 提供 `loadChronicleTimeline(worldName): WorldEntry[]` 和 `loadChronicleEvents(worldName): WorldEntry[]` 函数。`loadChronicleTimeline` SHALL 解析 `history/timeline.md` 单文件并按 `## ` 段落切分；`loadChronicleEvents` SHALL 枚举 `history/events/*.md`。两者在对应文件/目录不存在时 SHALL 返回空数组。

#### Scenario: loadChronicleTimeline 返回类型
- **WHEN** 调用 `loadChronicleTimeline('night-city')`
- **THEN** 返回 `WorldEntry[]`，每个元素含 meta（含 sort_key、display_time、event_ref）和 content

#### Scenario: 单文件不存在返回空数组
- **WHEN** 世界 `night-city` 的 `history/timeline.md` 文件不存在
- **THEN** `loadChronicleTimeline('night-city')` SHALL 返回 `[]`，不抛错

#### Scenario: events 目录不存在返回空数组
- **WHEN** 世界 `night-city` 的 `history/events/` 目录不存在
- **THEN** `loadChronicleEvents('night-city')` SHALL 返回 `[]`，不抛错

### Requirement: Skill 打包包含 chronicle
导出 skill 时，packager SHALL 将 `worlds/<name>/history/timeline.md` 和 `worlds/<name>/history/events/*.md` 复制到 skill 归档对应路径（`world/history/timeline.md` 和 `world/history/events/*.md`）。timeline.md 不存在或 events 目录为空时跳过，不报错。

#### Scenario: 完整 chronicle 打包
- **WHEN** 一个带 timeline.md + 4 个 events 的世界被打包
- **THEN** 解压后的 `.skill` 归档 SHALL 包含 `world/history/timeline.md` 和 4 个 `world/history/events/*.md`

#### Scenario: 老世界打包
- **WHEN** 一个不含 `history/` 目录的老世界被打包
- **THEN** 归档 SHALL 不包含 `world/history/` 路径
- **AND** 打包流程不报错

## REMOVED Requirements

### Requirement: Chronicle 目录结构（旧版）
**Reason**: 旧版要求 chronicle 数据存放在顶级 `chronicle/timeline/` 和 `chronicle/events/` 两个独立子目录。新版将 chronicle 归入 `history/` 维度目录下，并把 timeline 从多文件改为单文件聚合。
**Migration**: 现存两个测试 world 直接删除重建。已导出的 `.skill` 包需要重新导出（Phase 1 LLM 读取路径从 `world/chronicle/timeline/` 改为 `world/history/timeline.md`）。
