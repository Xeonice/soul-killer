# world-distill Specification

## Purpose
定义世界蒸馏系统，将原始数据源通过多阶段流程（Ingest → Classify → Cluster → Extract → Review）转化为结构化的世界条目。
## Requirements
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

### Requirement: Chunk 分类阶段
系统 SHALL 使用 LLM 为每个 chunk 分配 scope 标签（background/rule/lore/atmosphere/irrelevant）和 dimension 标签（WorldDimension 或 irrelevant）。标记为 `irrelevant` 的 chunk SHALL 被过滤掉不进入后续阶段。分类 prompt SHALL 根据 WorldClassification 调整（FICTIONAL_UNIVERSE 强调虚构设定元素，REAL_SETTING 强调真实信息）。

#### Scenario: 分类结果包含 dimension
- **WHEN** LLM 对一段关于"夜之城六个区域"的 chunk 进行分类
- **THEN** 返回 `{ scope: 'lore', dimension: 'geography' }`

#### Scenario: 真实世界分类 prompt 调整
- **WHEN** WorldClassification 为 REAL_SETTING
- **THEN** 分类 prompt 引导 LLM 关注真实地理、组织、历史事件等

### Requirement: Chunk 聚合阶段
系统 SHALL 使用 TF-IDF 相似度（复用 LocalEngine 的 tokenize + cosineSimilarity）计算 chunk 间相似度，阈值 > 0.3 的归为同一 cluster。

#### Scenario: 相似 chunk 聚合
- **WHEN** chunk A 和 chunk B 的 TF-IDF 相似度为 0.45
- **THEN** A 和 B 被归为同一 cluster

#### Scenario: 不相似 chunk 独立
- **WHEN** chunk A 和 chunk C 的相似度为 0.15
- **THEN** A 和 C 分属不同 cluster

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

### Requirement: 交互式审查
蒸馏完成后 SHALL 默认进入交互式审查，逐条展示生成的条目，用户可以选择：接受（a）、编辑（e）、跳过（s）、合并到其他条目（m）。提供 `--no-review` 标志跳过审查直接写入。

#### Scenario: 默认审查流程
- **WHEN** 蒸馏生成 10 个条目且未传 `--no-review`
- **THEN** 逐条展示条目元数据和内容，等待用户对每个条目做出决定

#### Scenario: 跳过审查
- **WHEN** 蒸馏命令带 `--no-review` 标志
- **THEN** 所有生成的条目直接写入 entries 目录

### Requirement: 蒸馏进度事件
WorldDistiller SHALL 继承 EventEmitter，在每个阶段发出进度事件，包含 `phase`（classify/cluster/extract/review）、`current`、`total` 和 `message`。

#### Scenario: 进度通知
- **WHEN** 分类阶段处理第 5 个 chunk（共 20 个）
- **THEN** 发出事件 `{ phase: "classify", current: 5, total: 20, message: "..." }`

### Requirement: World Evolve
系统 SHALL 支持对已存在的世界增量添加数据源（world evolve）。新生成的条目与已有条目同名时 SHALL 提示用户选择保留旧版/替换/合并。Evolve 完成后 SHALL 递增世界版本号。

#### Scenario: Evolve 新增条目
- **WHEN** 对已有 5 个条目的世界 evolve，生成 3 个新条目（名字都不重复）
- **THEN** 世界最终有 8 个条目，版本号递增

#### Scenario: Evolve 条目名冲突
- **WHEN** evolve 生成的条目 "megacorps" 与已有条目同名
- **THEN** 提示用户选择：保留旧版 / 替换为新版 / 合并两者内容

### Requirement: 蒸馏接受 WorldClassification 参数
`WorldDistiller.distill()` SHALL 接受可选的 `classification?: WorldClassification` 参数，用于调整分类阶段的 LLM prompt。当未提供时 SHALL 使用默认 prompt。

#### Scenario: 带 classification 的蒸馏
- **WHEN** 调用 `distiller.distill(worldName, sourcePath, 'markdown', 'FICTIONAL_UNIVERSE')`
- **THEN** 分类阶段的 prompt 针对虚构世界设定优化

### Requirement: World 蒸馏 AgentLogger 集成
WorldDistiller 的 `distill()` 和 `distillFromCache()` 方法 SHALL 接受可选的 `agentLog?: AgentLogger` 参数。当传入时，所有 LLM 调用（classifyChunks、extractEntries、distillFromCache per-dimension、reviewEntries）SHALL 通过 AgentLogger 记录阶段、batch、耗时和输出长度。日志格式 SHALL 与 Soul Distill（extractor.ts）的记录模式一致。

#### Scenario: distill 方法记录完整日志
- **WHEN** 调用 `distiller.distill(worldName, sourcePath, adapterType, classification, dimensions, agentLog)` 且 agentLog 不为空
- **THEN** 日志文件 SHALL 包含 distillStart（模型、chunk 数）、每个 classify batch 的 distillBatch 记录、cluster 阶段的 distillPhase 记录、每个 extract 维度的 distillBatch 记录、review 阶段的 distillBatch 记录、以及 distillEnd 摘要

#### Scenario: distillFromCache 方法记录完整日志
- **WHEN** 调用 `distiller.distillFromCache(worldName, sessionDir, dimensionPlan, agentLog)` 且 agentLog 不为空
- **THEN** 日志文件 SHALL 包含每个维度的 distillBatch 记录和 review 阶段的记录

#### Scenario: agentLog 未传入时无副作用
- **WHEN** 调用 distill 或 distillFromCache 且 agentLog 为 undefined
- **THEN** 行为与修改前完全一致，不产生任何日志文件

### Requirement: World 蒸馏错误日志记录
WorldDistiller 中所有 `catch` 块 SHALL 在 agentLog 存在时记录错误信息（通过 `agentLog.toolInternal`）。catch 块 SHALL 保持不抛出异常的原有行为。

#### Scenario: classifyChunks JSON 解析失败记录日志
- **WHEN** classifyChunks 中 LLM 返回非法 JSON 且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息（包含原始 response 摘要）
- **AND** 该 batch 的 chunks 按 fallback 逻辑分类为 lore（行为不变）

#### Scenario: extractEntries JSON 解析失败记录日志
- **WHEN** extractEntries 中某维度的 LLM 返回非法 JSON 且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息
- **AND** 该维度使用 fallback entry（行为不变）

#### Scenario: distillFromCache 某维度失败记录日志
- **WHEN** distillFromCache 中某维度的 generateText 抛出异常且 agentLog 已传入
- **THEN** agentLog 记录 ERROR 信息（包含维度名和错误消息）
- **AND** 该维度返回空数组（行为不变）

### Requirement: 调用方创建 AgentLogger
world-distill.tsx 和 world-create-wizard.tsx 中调用 WorldDistiller 的位置 SHALL 创建 AgentLogger 实例并传入 distill/distillFromCache 方法。AgentLogger 的 prompt 参数 SHALL 标明 "World Distill: {worldName}"。

#### Scenario: world-distill 命令创建日志
- **WHEN** 用户执行 `/world` → 管理 → 蒸馏
- **THEN** 蒸馏完成后 `~/.soulkiller/logs/agent/` 下 SHALL 存在对应的日志文件

#### Scenario: world-create-wizard 蒸馏步骤创建日志
- **WHEN** 用户通过世界创建向导进入蒸馏步骤
- **THEN** 蒸馏完成后 `~/.soulkiller/logs/agent/` 下 SHALL 存在对应的日志文件

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

### Requirement: 交互式审查显示 chronicle 推断标记
交互式审查 SHALL 在展示 entry 元数据时高亮 `sort_key_inferred: false` 的条目，提示用户该 entry 的时间位置不可信，建议手动校正。

#### Scenario: 推断失败 entry 标注
- **WHEN** 审查阶段展示一个 sort_key_inferred 为 false 的 chronicle entry
- **THEN** UI SHALL 显示醒目标记（如 ⚠️ 或文本提示）告知用户该 sort_key 是兜底值

