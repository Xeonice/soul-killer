## MODIFIED Requirements

### Requirement: World 蒸馏流程
系统 SHALL 提供 `WorldDistiller` 类，接收数据源路径，通过分阶段流程生成世界条目：Ingest（数据适配）→ Classify（LLM scope 分类）→ Cluster（相似 chunk 聚合）→ Extract（LLM 条目生成，history 维度走三 Pass）→ Review（去重和质量过滤）→ IndexRefresh（为每个维度刷新 `_index.md`）。history 维度的 Extract 步骤 SHALL 走独立的三 Pass 流程（见 `history-timeline-distill` 能力），其他维度沿用现有单 pass extract。

#### Scenario: 从 markdown 数据源蒸馏
- **WHEN** 调用 `worldDistiller.distill("night-city", "./cyberpunk-docs/", "markdown")`
- **THEN** 通过 IngestPipeline 读取数据、LLM 分类每个 chunk、聚合相似 chunk、按维度路由（history 走三 Pass、其他走单 pass extract）、review 去重、按维度写入对应子目录、最后刷新每个维度的 `_index.md`

#### Scenario: history 维度走三 Pass
- **WHEN** extract 阶段处理 history 维度
- **THEN** SHALL 调用 `runHistoryThreePass()` 而非 `extractEntries` 的 history 分支
- **AND** 产出写入 `history/timeline.md`、`history/events/*.md`、`history/*.md`

#### Scenario: 其他维度走单 pass extract
- **WHEN** extract 阶段处理 factions、figures 等非 history 维度
- **THEN** SHALL 调用原有的 `extractEntries` 逻辑
- **AND** 产出写入对应的 `<dimension>/*.md`

### Requirement: 条目生成阶段
系统 SHALL 使用 LLM 为每个 cluster 生成一个 entry，包含：name（英文 kebab-case）、keywords（触发关键词列表）、mode（推荐的触发模式）、priority（推荐的优先级）、scope（继承自分类阶段或使用维度默认映射）、dimension（WorldDimension，继承自分类阶段）和 content（条目正文）。对于 history 维度，Extract 阶段 SHALL 走三 Pass 流程产出 timeline + events + 非事件 entry 三类产物。

#### Scenario: 生成带 dimension 的 entry
- **WHEN** cluster 的维度标注为 `systems`
- **THEN** 生成的 entry meta 包含 `dimension: 'systems'`，scope 默认为 `'rule'`（可被 LLM 覆盖）
- **AND** 写入 `systems/<name>.md`

#### Scenario: history cluster 走三 Pass
- **WHEN** cluster 的维度标注为 `history`
- **THEN** SHALL 不走普通 extract 分支
- **AND** 交给 `runHistoryThreePass` 处理

### Requirement: GeneratedEntry 包含 chronicleType
`GeneratedEntry` 接口 SHALL 包含可选字段 `chronicleType?: 'timeline' | 'events'`。当 `chronicleType === 'timeline'` 时，`writeEntries` SHALL 将该 entry 合并到 `history/timeline.md` 单文件；当 `chronicleType === 'events'` 时 SHALL 写入 `history/events/<name>.md`；缺省时 SHALL 根据 `meta.dimension` 写入对应的 `<dimension>/<name>.md`。

#### Scenario: chronicleType=timeline 合并到单文件
- **WHEN** GeneratedEntry 的 chronicleType 为 `'timeline'`
- **THEN** writeEntries SHALL 调用合并函数更新 `history/timeline.md`（按 sort_key 插入或按 stem 查重）
- **AND** 不创建独立的 timeline 文件

#### Scenario: chronicleType=events 写入 events 目录
- **WHEN** GeneratedEntry 的 chronicleType 为 `'events'`
- **THEN** writeEntries SHALL 创建 `history/events/<name>.md`
- **AND** frontmatter 的 scope 为 chronicle、mode 为 keyword

#### Scenario: 缺省 chronicleType 按 dimension 写入
- **WHEN** GeneratedEntry 的 chronicleType 为 undefined
- **THEN** writeEntries SHALL 根据 `meta.dimension` 写入 `<dimension>/<name>.md`
- **AND** dimension 缺失时走 `inferDimensionFromScope` 兜底

### Requirement: `_index.md` 自动刷新
`WorldDistiller.distill()` 和 `evolve()` 在 writeEntries 完成后 SHALL 调用 `refreshDimensionIndexes(worldName)`，为所有非空维度子目录重新生成 `_index.md` 文件。`_index.md` 内容包含：frontmatter（`type: dimension-index`、`dimension: <name>`、`entry_count: <n>`）和 markdown 表格（列：name、priority、mode、一句话摘要）。作者手工编辑 entry 后 SHALL 不自动刷新，仅在下次 distill/evolve 时刷新。

#### Scenario: distill 后生成 _index.md
- **WHEN** distill 完成并写入 5 个 factions entry 和 3 个 figures entry
- **THEN** `factions/_index.md` 包含 5 行表格
- **AND** `figures/_index.md` 包含 3 行表格
- **AND** 两个 _index.md 的 entry_count frontmatter 正确

#### Scenario: evolve 后刷新 _index.md
- **WHEN** evolve 向 factions 新增 2 个 entry（原有 5 个）
- **THEN** `factions/_index.md` 被重新生成，包含 7 行表格
- **AND** entry_count 为 7

#### Scenario: 手工编辑不触发刷新
- **WHEN** 作者手工修改某 entry 的 content（不通过 distill/evolve）
- **THEN** 对应维度的 `_index.md` 不被自动刷新
- **AND** 保持上次 distill/evolve 时的内容

### Requirement: Chronicle 识别阶段
World distiller SHALL 在 history 维度的 extract 阶段走**三 Pass 流程**提取时间线数据（见 `history-timeline-distill` 能力）。Pass A 列穷尽所有带时间锚点的事件（不做"重大事件"的门槛筛选）；Pass B 为每个 timeline 条目扩写 5-10 句的 detail；Pass C 处理非事件性的 history 内容（长期趋势、制度演变）。

#### Scenario: Pass A 列穷尽
- **WHEN** history chunks 包含 20 个带年份的事件
- **THEN** Pass A 的 LLM 输出 SHALL 是 20 个条目（不挑选"重大"与否）
- **AND** 所有条目 SHALL 被写入 `history/timeline.md`

#### Scenario: Pass B 扩写 detail
- **WHEN** Pass A 产出 20 个条目
- **THEN** Pass B SHALL 为每个条目生成独立的 `history/events/<name>.md`
- **AND** 每个文件的 body 长度为 5-10 句

#### Scenario: Pass C 处理非事件内容
- **WHEN** history chunks 包含"士族崛起"等长期趋势内容
- **THEN** Pass C SHALL 产出普通 entry，写入 `history/<name>.md`（非 events 子目录）

## REMOVED Requirements

### Requirement: Sort key 自动推断
**Reason**: 原需求描述的是单 pass extract 中通过 `buildChronicleGuidance()` prompt 让 LLM 附加 chronicle 字段、由 `expandChroniclePair` 拆对的机制。新版中 sort_key 由 Pass A 的专用 prompt 直接产出（每个条目必须有 sort_key），推断逻辑内化在 Pass A 的 LLM 调用中，不再是一个独立的"chronicle pair 附加"步骤。
**Migration**: Pass A 的 prompt 明确要求 LLM 输出 sort_key 和 sort_key_inferred 字段，无法确定时间时标 `sort_key_inferred: false`。review UI 继续识别该标记提示用户校正。

### Requirement: Display time 字段生成
**Reason**: 同上，display_time 字段的生成从"extract 阶段附加在 chronicle 字段内"迁移为"Pass A 的 JSON 输出的顶层字段"。行为不变，但归属重新整理到 `history-timeline-distill` 能力下。
**Migration**: Pass A 的 prompt 明确要求输出 display_time，保留原文字面时间标签。

### Requirement: GeneratedEntry 包含 dimension
**Reason**: 该需求已被升级——新布局下 dimension **不再是可选**，所有 GeneratedEntry 必须携带 dimension，缺失时走 inferDimensionFromScope 兜底。已合并到 `world-entry` 的"Entry dimension 字段"需求中。
**Migration**: 代码中所有 `GeneratedEntry` 的构造点 SHALL 显式传 dimension，distill 的 extract 阶段 SHALL 在输出前校验所有 entry 都有 dimension 字段。
