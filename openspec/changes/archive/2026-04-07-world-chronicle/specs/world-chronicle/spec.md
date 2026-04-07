## ADDED Requirements

### Requirement: Chronicle 目录结构
每个世界 SHALL 在 `~/.soulkiller/worlds/<name>/chronicle/` 下维护两个子目录：`timeline/` 和 `events/`。两个目录可独立存在，缺失任一不构成错误。

#### Scenario: 完整 chronicle 目录
- **WHEN** 一个新世界完成 distill 并产出编年史
- **THEN** 文件系统 SHALL 包含 `worlds/<name>/chronicle/timeline/<slug>.md` 和 `worlds/<name>/chronicle/events/<slug>.md`

#### Scenario: 老世界无 chronicle 目录
- **WHEN** 加载一个不含 `chronicle/` 目录的老世界
- **THEN** 系统 SHALL 视 chronicle timeline 和 events 均为空，**不**抛出错误
- **AND** 后续 context assembly、export packaging 也 SHALL 优雅处理空 chronicle

### Requirement: Chronicle 双层语义
Chronicle 由**底色层**（timeline）和**详情层**（events）组成。底色层的每个 entry SHALL 是紧凑的一行事件描述，always 注入；详情层的每个 entry SHALL 是完整的事件描述，按 keyword 触发召回。

#### Scenario: 底色 entry 的形态
- **WHEN** 读取 `chronicle/timeline/2020-arasaka-nuke.md`
- **THEN** 该 entry meta 的 `mode` SHALL 为 `'always'`
- **AND** `scope` SHALL 为 `'chronicle'`
- **AND** body 是一行简短事件描述（典型长度 < 100 字符）

#### Scenario: 详情 entry 的形态
- **WHEN** 读取 `chronicle/events/2020-arasaka-nuke.md`
- **THEN** 该 entry meta 的 `mode` SHALL 为 `'keyword'`
- **AND** `scope` SHALL 为 `'chronicle'`
- **AND** `keywords` 字段非空
- **AND** body 是完整段落描述

### Requirement: Timeline 与 Events 的关联
底色 entry 通过 `event_ref` frontmatter 字段引用对应的详情 event slug。当 timeline 与 events 子目录中存在同名 `.md` 文件时，系统 SHALL 自动建立关联，无需显式声明 `event_ref`。

#### Scenario: 同名自动关联
- **WHEN** `chronicle/timeline/2020-arasaka-nuke.md` 与 `chronicle/events/2020-arasaka-nuke.md` 同时存在
- **THEN** 系统 SHALL 把 timeline entry 视为引用 events 中的同名 entry，无论 `event_ref` 是否显式填写

#### Scenario: 仅有底色无详情
- **WHEN** 只存在 `chronicle/timeline/<slug>.md`，无对应 events 文件
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
系统 SHALL 提供 `loadChronicleTimeline(worldName)` 和 `loadChronicleEvents(worldName)` 函数，分别返回对应目录下所有 entry 的数组。两者签名与 `loadAllEntries` 一致，目录不存在时返回空数组。

#### Scenario: loadChronicleTimeline 返回类型
- **WHEN** 调用 `loadChronicleTimeline('night-city')`
- **THEN** 返回 `WorldEntry[]`，每个元素含 meta（含 sort_key、display_time）和 content

#### Scenario: 空目录返回空数组
- **WHEN** 世界 `night-city` 的 `chronicle/timeline/` 目录不存在
- **THEN** `loadChronicleTimeline('night-city')` SHALL 返回 `[]`，不抛错

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
导出 skill 时，packager SHALL 将 `worlds/<name>/chronicle/timeline/*.md` 和 `worlds/<name>/chronicle/events/*.md` 复制到 skill 归档的 `world/chronicle/timeline/` 和 `world/chronicle/events/` 路径下。chronicle 子目录不存在时跳过，不报错。

#### Scenario: 完整 chronicle 打包
- **WHEN** 一个有 5 个 timeline + 4 个 events 的世界被打包
- **THEN** 解压后的 `.skill` 归档 SHALL 包含 5 个 `world/chronicle/timeline/*.md` 和 4 个 `world/chronicle/events/*.md`

#### Scenario: 老世界打包
- **WHEN** 一个不含 chronicle 目录的老世界被打包
- **THEN** 归档 SHALL 不包含 `world/chronicle/` 路径
- **AND** 打包流程不报错
