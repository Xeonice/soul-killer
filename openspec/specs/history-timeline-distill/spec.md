# history-timeline-distill Specification

## Purpose
定义 history 维度专属的三 Pass distill 流程，取代旧版的"普通 extract + 可选 chronicle 字段"机制。三 Pass 分别负责 timeline 列穷尽、事件 detail 并发扩写、以及非事件性长期内容提取，确保 history 数据兼具时间线完整性与分析深度。

## Requirements

### Requirement: History 维度的三 Pass distill 流程
History 维度的 distill SHALL 走独立的三 Pass 流程 `runHistoryThreePass()`，不复用其他维度的单 pass `extract`。三个 Pass 依次为：Pass A（Timeline 提取）、Pass B（事件 detail 扩写）、Pass C（非事件性内容提取）。其他 8 个维度的 distill 行为 SHALL 保持单 pass extract 不变。

#### Scenario: history 维度走三 Pass
- **WHEN** WorldDistiller 处理 history 维度的 chunks
- **THEN** SHALL 调用 `runHistoryThreePass(worldName, chunks, model, agentLog)`
- **AND** SHALL 不调用现有的 `extractEntries` 或带 chronicle 字段的 extract 逻辑

#### Scenario: 非 history 维度不受影响
- **WHEN** WorldDistiller 处理 factions、figures、geography 等维度
- **THEN** SHALL 继续走现有的单 pass `extract` 流程
- **AND** prompt、输出格式、产物路径按原逻辑处理（只是写入位置改为 `<dimension>/*.md`）

### Requirement: Pass A — Timeline 列表提取
Pass A SHALL 用一次 LLM 调用从所有 history chunks 中提取**每一个**带时间锚点的事件。prompt SHALL 明确要求"列穷尽、不分析、不挑选"，禁止 LLM 输出分析性文字。LLM 输出 SHALL 为 JSON 数组，每个元素包含以下字段：
- `name`: kebab-case 英文事件标识
- `display_time`: 原文字面时间标签（保留原文措辞）
- `sort_key`: 在本世界内单调递增的数值
- `one_line`: 一行事件描述（< 100 字符）
- `source_excerpt`: 触发该条目的原文片段（用于 Pass B 的 detail 扩写）
- `sort_key_inferred`: boolean，LLM 无法从原文确定时间时 SHALL 设为 `false`
- `importance`: `'high' | 'medium' | 'low'`，用于 runtime token 预算截断

#### Scenario: Pass A 输出完整时间线
- **WHEN** history chunks 包含 10 个带年份的事件
- **THEN** Pass A 的 LLM 输出 SHALL 是 10 个条目的 JSON 数组
- **AND** 每个条目都有完整的 name/display_time/sort_key/one_line/source_excerpt/importance 字段

#### Scenario: Pass A 拒绝写分析
- **WHEN** history chunks 包含长段的制度分析文字
- **THEN** Pass A 的 one_line 字段 SHALL 不超过 100 字符
- **AND** 不包含因果分析、不包含"由于…导致…"类描述
- **AND** 这类分析性内容应留给 Pass C

#### Scenario: sort_key 无法确定
- **WHEN** LLM 无法从原文准确提取时间
- **THEN** 生成的条目 SHALL 含 `sort_key_inferred: false`
- **AND** sort_key 为 LLM 根据上下文推断的相对序号

### Requirement: Pass B — 事件 detail 扩写
Pass B SHALL 对 Pass A 产出的**每个**条目分别调用一次 LLM 扩写，生成 5-10 句话的完整事件描述（起因、经过、影响）。Pass B SHALL 以 Pass A 的 `source_excerpt` 和原 chunk 上下文为输入。Pass B 的 LLM 调用 SHALL 可并发执行，并发度与现有 `distillFromCache` 一致（默认 CONCURRENCY=5）。

#### Scenario: Pass B 为每个 timeline 条目生成 detail
- **WHEN** Pass A 产出 10 个条目
- **THEN** Pass B SHALL 发起 10 次 LLM 调用（可并发）
- **AND** 每次调用产出一个对应的 detail 字符串

#### Scenario: Pass B 并发执行
- **WHEN** Pass A 产出 15 个条目
- **THEN** Pass B SHALL 以最多 5 个并发执行 LLM 调用
- **AND** 总耗时约为 3 个批次的时间

#### Scenario: Pass B 单个调用失败不中断整体
- **WHEN** Pass B 中某一次 LLM 调用抛错
- **THEN** 该条目的 detail 为空字符串或兜底占位文本
- **AND** 其他条目继续处理
- **AND** 错误记录到 agentLog

### Requirement: Pass C — 非事件性 history 内容提取
Pass C SHALL 用一次 LLM 调用处理 history chunks 中**不是单一事件**的内容（长期趋势、制度演变、时代背景分析等）。prompt SHALL 沿用现有单 pass extract 的"论文模式"（5-10 句分析、解释 WHY 和 HOW）。Pass C 的 prompt SHALL 明确告知 LLM "Pass A 已经负责提取所有时点事件，你只需要处理非事件性的长期内容"，让 LLM 自觉避开时点事件。

#### Scenario: Pass C 产出非事件 entry
- **WHEN** history chunks 包含"士族阶层在东汉末年的崛起"这类长期性内容
- **THEN** Pass C SHALL 产出一个普通 entry，包含完整的分析段落
- **AND** 该 entry 被写入 `history/<name>.md`（而非 `history/events/`）

#### Scenario: Pass C 输入为空时跳过
- **WHEN** history chunks 已被 Pass A 完全消费（全部是事件）
- **THEN** Pass C 的 LLM 可以返回空数组
- **AND** 不产出任何 entry，不报错

#### Scenario: Pass C 与 Pass A 重叠
- **WHEN** Pass C 的 LLM 产出内容与 Pass A 的某事件在主题上重叠
- **THEN** review 阶段的去重逻辑 SHALL 识别并合并/删除重复
- **AND** 这是可接受的 trade-off（避免 chunk-level diff 的复杂度）

### Requirement: Pass A 输出写入 timeline.md 单文件
Pass A 的产物 SHALL 作为**单个** `history/timeline.md` 文件写入，而非多个小文件。文件格式：
- frontmatter 包含 `type: chronicle-timeline`、`dimension: history`、`mode: always`
- body 用 `# <世界名>编年史` 作为标题
- 每个 timeline 条目用 `## <display_time> — <一句话名称>` 作为段落标题
- 段落下方用 `> ref: ./events/<name>.md` 和 `> sort_key: <number>` 和 `> importance: <level>` 等元数据行
- 段落正文为 `one_line` 内容

#### Scenario: timeline.md 的文件结构
- **WHEN** Pass A 产出 3 个条目 [官渡之战、赤壁之战、夷陵之战]
- **THEN** `history/timeline.md` SHALL 包含 3 个 `## ` 段落
- **AND** 每段都有 `> ref:` 和 `> sort_key:` 元数据行
- **AND** 段落正文按 sort_key 升序排列

#### Scenario: timeline.md 的 frontmatter
- **WHEN** 写入新的 `history/timeline.md`
- **THEN** frontmatter 包含 `type: chronicle-timeline`
- **AND** `dimension: history`
- **AND** `mode: always`

### Requirement: Pass B 输出写入 history/events/
Pass B 的每个 detail 产物 SHALL 作为独立的 `.md` 文件写入 `history/events/<name>.md`。每个文件的 frontmatter SHALL 继承对应 Pass A 条目的 `name`、`sort_key`、`display_time`、`sort_key_inferred`（如有），并设置 `mode: keyword`、`scope: chronicle`、`dimension: history`、`priority: 800`（与现有 chronicle events 行为一致）。

#### Scenario: events 文件的路径
- **WHEN** Pass A 条目 name 为 "battle-of-chibi"
- **THEN** Pass B 产出 `worlds/<name>/history/events/battle-of-chibi.md`
- **AND** frontmatter 的 mode 为 keyword、scope 为 chronicle

#### Scenario: events 与 timeline 的绑定
- **WHEN** `history/timeline.md` 的某段含 `> ref: ./events/battle-of-chibi.md`
- **THEN** 对应的 `history/events/battle-of-chibi.md` SHALL 存在
- **AND** 两者通过文件名 stem 匹配

### Requirement: Pass C 输出写入 history/
Pass C 的产物 SHALL 作为普通 entry 写入 `history/<name>.md`（不进入 `events/` 子目录，不进入 `timeline.md`）。frontmatter SHALL 符合普通 entry 格式，`scope` 默认为 `background`（history 维度的 distillTarget），`dimension` 为 `history`。

#### Scenario: Pass C entry 的路径
- **WHEN** Pass C 产出一个 name 为 "late-han-aristocracy-rise" 的 entry
- **THEN** 创建文件 `worlds/<name>/history/late-han-aristocracy-rise.md`
- **AND** frontmatter 的 dimension 为 history、scope 为 background

#### Scenario: Pass C entry 不进 events 目录
- **WHEN** Pass C 产出任何 entry
- **THEN** 该 entry SHALL 不被写入 `history/events/`
- **AND** 加载时不被 `loadChronicleEvents` 枚举

### Requirement: 删除旧的 chronicle pair 机制
`buildChronicleGuidance()` 和 `expandChroniclePair()` 函数 SHALL 被删除。旧的"普通 extract + 可选 chronicle 字段"机制 SHALL 完全被三 Pass 替代。

#### Scenario: 旧函数不再存在
- **WHEN** 代码审查
- **THEN** `src/world/distill.ts` 中不再存在 `buildChronicleGuidance` 或 `expandChroniclePair` 函数
- **AND** `isHistoryDim` 分支中不再有"给 prompt 塞 chronicle guidance"的逻辑

### Requirement: Timeline.md 的合并策略
首次 distill 时 `history/timeline.md` SHALL 全量重写。evolve 时 SHALL 按以下规则合并：
- 新条目（stem 不存在于现有 timeline.md）按 `sort_key` 插入到正确位置
- 冲突条目（stem 已存在于现有 timeline.md）SHALL 保留作者现有版本，不覆盖
- 冲突发生时 SHALL 在 agentLog 中记录 warn 级日志，列出所有冲突的 stem

#### Scenario: 首次 distill 全量写
- **WHEN** history/timeline.md 不存在，distill 产出 5 个条目
- **THEN** 创建新的 timeline.md，包含 5 个段落

#### Scenario: evolve 增量插入
- **WHEN** 现有 timeline.md 有 5 个条目（sort_key 184/200/208/220/234），evolve 产出 2 个新条目（sort_key 196、252）
- **THEN** 合并后 timeline.md 包含 7 个段落
- **AND** 按 sort_key 升序排列：184, 196, 200, 208, 220, 234, 252

#### Scenario: evolve 冲突保留作者版本
- **WHEN** 作者手工编辑过 timeline.md 中 "battle-of-chibi" 段落，evolve 产出同 stem 的新版本
- **THEN** 合并后 timeline.md 仍保留作者编辑的版本
- **AND** agentLog 记录 warn："Chronicle conflict: battle-of-chibi kept author version"

### Requirement: 搜索 query 微调
`WORLD_DIMENSION_TEMPLATES` 中 `history` 维度的 `queries` 数组 SHALL 追加 2 条针对结构化年表的 query 模板：`'{localName} 年表'` 和 `'timeline of {name}'`。其他维度的 queries 保持不变。

#### Scenario: history query 数量增加
- **WHEN** 读取 `WORLD_DIMENSION_TEMPLATES` 中 history 维度的 queries
- **THEN** queries 数组包含原有 5 条 + 新增 2 条 = 7 条模板

#### Scenario: 新 query 在 plan 生成中被使用
- **WHEN** 调用 `generateWorldSearchPlan('FICTIONAL_UNIVERSE', 'Three Kingdoms', '三国', '')`
- **THEN** history 维度的 queries 包含 "三国 年表" 和 "timeline of Three Kingdoms"
