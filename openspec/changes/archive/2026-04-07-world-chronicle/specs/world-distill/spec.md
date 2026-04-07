## ADDED Requirements

### Requirement: Chronicle 识别阶段
World distiller SHALL 在 history 维度 cluster 处理过程中额外执行**重大事件识别**：从 history 类 chunks 中识别符合"重大事件"标准的内容（涉及具体时间锚点 + 影响范围超出个人 + 在叙事中被反复引用），并产出成对的 chronicle 条目（一个 timeline + 一个 events）。其余 history 内容继续作为 background entry 输出。

#### Scenario: 重大事件被识别
- **WHEN** history 维度的某个 cluster 包含明确年份和势力级别影响的内容
- **THEN** distiller SHALL 产出一对同名 chronicle 条目：
  - timeline 条目（mode: always, scope: chronicle, body 是一行紧凑描述）
  - events 条目（mode: keyword, scope: chronicle, body 是完整段落）
- **AND** 两个条目的 name 字段相同

#### Scenario: 普通历史内容仍走 background
- **WHEN** history 维度的某个 cluster 内容是"夜之城的历史背景概述"，没有具体事件锚点
- **THEN** distiller SHALL 产出普通 background entry，不产出 chronicle 条目

### Requirement: Sort key 自动推断
Distiller SHALL 为每个 chronicle 条目自动推断 sort_key 数值。优先从原文识别明确年份/纪年；若失败则使用相对定位（基于上下文中已识别事件的相对顺序）；最终兜底使用 cluster 索引并标记 `sort_key_inferred: false`。

#### Scenario: 从年份推断
- **WHEN** chunk 内容含 "2020 年 8 月 13 日"
- **THEN** sort_key SHALL 大约为 2020.6（年份 + 月份小数）
- **AND** 不设置 `sort_key_inferred` 字段（默认 true）

#### Scenario: 推断失败兜底
- **WHEN** 一个事件的 chunk 内容没有任何明确时间标记
- **THEN** sort_key SHALL 使用 cluster 索引（确保排序稳定）
- **AND** frontmatter SHALL 含 `sort_key_inferred: false`

### Requirement: Display time 字段生成
Distiller SHALL 为每个 chronicle 条目生成 `display_time` 字符串，作为给 LLM 看的人类可读时间标签。该字段独立于 sort_key，包含原文中的时间表述（"2020 年 8 月"、"第四纪元 3019 年"、"圣杯战争前夜"）。

#### Scenario: 地球纪年 display_time
- **WHEN** chunk 含 "2020 年 8 月"
- **THEN** 生成的 chronicle 条目的 display_time SHALL 为 `"2020 年 8 月"` 或同义表述

#### Scenario: 异世界历法 display_time
- **WHEN** chunk 含 "第五次圣杯战争"
- **THEN** display_time SHALL 保留这种世界专属表述

### Requirement: GeneratedEntry 包含 chronicleType
`GeneratedEntry` 接口 SHALL 新增可选字段 `chronicleType?: 'timeline' | 'event'`。当字段存在时，该 entry 写入对应的 `chronicle/timeline/` 或 `chronicle/events/` 目录；缺省时写入 `entries/`。

#### Scenario: chronicleType 决定写入目录
- **WHEN** GeneratedEntry 的 chronicleType 为 `'timeline'`
- **THEN** 写入阶段 SHALL 调用 `addChronicleEntry(worldName, 'timeline', meta, content)`
- **AND** 文件最终位于 `chronicle/timeline/<name>.md`

#### Scenario: 缺省 chronicleType 走旧路径
- **WHEN** GeneratedEntry 的 chronicleType 为 undefined
- **THEN** 写入阶段 SHALL 调用 `addEntry(worldName, meta, content)`
- **AND** 文件位于 `entries/<name>.md`

### Requirement: 交互式审查显示 chronicle 推断标记
交互式审查 SHALL 在展示 entry 元数据时高亮 `sort_key_inferred: false` 的条目，提示用户该 entry 的时间位置不可信，建议手动校正。

#### Scenario: 推断失败 entry 标注
- **WHEN** 审查阶段展示一个 sort_key_inferred 为 false 的 chronicle entry
- **THEN** UI SHALL 显示醒目标记（如 ⚠️ 或文本提示）告知用户该 sort_key 是兜底值
