# distill-from-cache Specification

## Purpose
TBD - created by archiving change quality-filter-pipeline. Update Purpose after archive.
## Requirements
### Requirement: distillFromCache 读取合格文章全文
distillFromCache SHALL 读取过滤后的缓存全文，不再硬截断到 8000 chars。

#### Scenario: 全文输入
- **WHEN** 读取维度缓存
- **THEN** SHALL 拼接所有合格文章的全文
- **AND** 如果总长度超过 150K chars，SHALL 按评分从高到低截取

#### Scenario: 超长文章分章节提取
- **WHEN** 单篇文章超过 30K chars
- **THEN** SHALL 先 LLM 识别章节结构
- **AND** SHALL 只保留与当前维度相关的章节内容
- **AND** 不相关章节 SHALL 被丢弃以控制总长度

### Requirement: distill prompt 防幻觉
distillFromCache 的 LLM prompt SHALL 包含目标名称锚定和防幻觉约束。

#### Scenario: prompt 约束
- **WHEN** 构造 distill prompt
- **THEN** SHALL 包含目标世界名称和分类
- **AND** SHALL 要求只从提供的文章中提取，不得编造
- **AND** SHALL 要求信息不足时生成更少 entries 而非编造

### Requirement: distillFromCache 方法
WorldDistiller SHALL 提供 distillFromCache 方法，从维度缓存目录直接生成 entry，跳过 classify/cluster。

#### Scenario: 按维度并行蒸馏
- **WHEN** 调用 distillFromCache(worldName, sessionDir, dimensionPlan)
- **THEN** SHALL 读取 sessionDir 中每个 {dimension}.json 文件
- **AND** SHALL 按维度并行调用 LLM 深度阅读并生成 entry（并发上限 5）

#### Scenario: 单维度蒸馏
- **WHEN** 处理某个维度的文章集合
- **THEN** SHALL 将所有文章全文拼接（截断到 8000 chars）作为 LLM 输入
- **AND** LLM SHALL 生成 2-5 个 entry，每个 5-10 句
- **AND** entry SHALL 包含 name、keywords、priority、mode、content

#### Scenario: review 去重
- **WHEN** 所有维度蒸馏完成
- **THEN** SHALL 执行 review 阶段合并重复 entry

#### Scenario: 兼容 markdown 数据源
- **WHEN** 数据源是 markdown/URL（无维度标注）
- **THEN** SHALL 走现有 distill 方法（classify → cluster → extractEntries）

