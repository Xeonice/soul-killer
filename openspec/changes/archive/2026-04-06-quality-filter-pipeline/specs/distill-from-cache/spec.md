## ADDED Requirements

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
