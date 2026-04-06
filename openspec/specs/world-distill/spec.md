## ADDED Requirements

### Requirement: World 蒸馏流程
系统 SHALL 提供 `WorldDistiller` 类，接收数据源路径，通过四阶段流程生成世界条目：Ingest（数据适配）→ Classify（LLM scope 分类）→ Cluster（相似 chunk 聚合）→ Extract（LLM 条目生成）。

#### Scenario: 从 markdown 数据源蒸馏
- **WHEN** 调用 `worldDistiller.distill("night-city", "./cyberpunk-docs/", "markdown")`
- **THEN** 通过 IngestPipeline 读取数据、LLM 分类每个 chunk、聚合相似 chunk、为每个 cluster 生成一个 entry，最终写入 `~/.soulkiller/worlds/night-city/entries/`

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
系统 SHALL 使用 LLM 为每个 cluster 生成一个 entry，包含：name（英文 kebab-case）、keywords（触发关键词列表）、mode（推荐的触发模式）、priority（推荐的优先级）、scope（继承自分类阶段或使用维度默认映射）、dimension（WorldDimension，继承自分类阶段）和 content（条目正文）。

#### Scenario: 生成带 dimension 的 entry
- **WHEN** cluster 的维度标注为 `systems`
- **THEN** 生成的 entry meta 包含 `dimension: 'systems'`，scope 默认为 `'rule'`（可被 LLM 覆盖）

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

### Requirement: GeneratedEntry 包含 dimension
`GeneratedEntry` 接口的 meta 字段 SHALL 包含可选的 `dimension?: WorldDimension`。蒸馏生成的 entry SHALL 自动带上 dimension 标注。

#### Scenario: 蒸馏产出带 dimension
- **WHEN** 蒸馏完成后返回 GeneratedEntry 数组
- **THEN** 每个 entry 的 meta.dimension 有值（WorldDimension 类型）
