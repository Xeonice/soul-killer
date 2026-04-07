## ADDED Requirements

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

### Requirement: Sort key 字段语义
每个 chronicle entry SHALL 在 frontmatter 中包含 `sort_key: number` 字段，作为时间轴上的纯数值位置。系统 SHALL 仅使用 sort_key 做排序，不解析其语义。display_time 字段独立承担"显示给 LLM 看的时间字符串"的职责。

#### Scenario: 按 sort_key 排序
- **WHEN** 加载 chronicle/timeline/ 中的所有 entry
- **THEN** 系统 SHALL 按 sort_key 升序排序后再注入

#### Scenario: 异世界历法
- **WHEN** 一个 chronicle entry 的 sort_key 为 5.0、display_time 为 "第五次圣杯战争开战日"
- **THEN** 系统 SHALL 接受并按 5.0 参与排序
- **AND** 注入到 LLM 的文本 SHALL 显示 display_time 字符串而非数字

#### Scenario: sort_key 缺失或非数值
- **WHEN** 一个 chronicle entry 的 frontmatter 中没有 sort_key 或值不是数字
- **THEN** 系统 SHALL 视该 entry 的 sort_key 为正无穷（排在末尾）
- **AND** 不报错，仍然加载

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

### Requirement: Sort key 推断标记
当 distill agent 无法从源数据中提取明确的时间信息时，SHALL 使用回退值并在 frontmatter 中加 `sort_key_inferred: false` 标记。该标记告知用户此 entry 的时间位置不可信，建议在交互式审查中修正。

#### Scenario: 推断成功的 entry
- **WHEN** distill 从原文识别出 "2020 年" 并产出 sort_key 2020
- **THEN** 生成的 entry frontmatter SHALL **不** 含 `sort_key_inferred` 字段（默认视为 true）

#### Scenario: 推断失败的 entry
- **WHEN** distill 无法定位事件的时间，使用 cluster 索引作为回退 sort_key
- **THEN** 生成的 entry frontmatter SHALL 含 `sort_key_inferred: false`
- **AND** 交互式审查 SHALL 把这些 entry 优先展示给用户

### Requirement: Skill 打包包含 chronicle
导出 skill 时，packager SHALL 将 `worlds/<name>/history/timeline.md` 和 `worlds/<name>/history/events/*.md` 复制到 skill 归档对应路径（`world/history/timeline.md` 和 `world/history/events/*.md`）。timeline.md 不存在或 events 目录为空时跳过，不报错。

#### Scenario: 完整 chronicle 打包
- **WHEN** 一个带 timeline.md + 4 个 events 的世界被打包
- **THEN** 解压后的 `.skill` 归档 SHALL 包含 `world/history/timeline.md` 和 4 个 `world/history/events/*.md`

#### Scenario: 老世界打包
- **WHEN** 一个不含 `history/` 目录的老世界被打包
- **THEN** 归档 SHALL 不包含 `world/history/` 路径
- **AND** 打包流程不报错
