## MODIFIED Requirements

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
