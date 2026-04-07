## ADDED Requirements

### Requirement: Planning Agent 输出全动态维度列表
Planning Agent SHALL 从维度模版中选择适合的维度，自由增删，输出完整的维度列表。

#### Scenario: 可以不选用不适合的模版维度
- **WHEN** 某个模版维度（如 species）对当前目标不适用
- **THEN** Planning Agent SHALL 可以不将其包含在输出中
- **AND** 不受"base 维度不可删除"的约束

#### Scenario: 输出完整维度列表
- **WHEN** Planning Agent 返回结果
- **THEN** SHALL 包含 6-15 个维度
- **AND** 每个维度 SHALL 包含完整的 name, display, description, priority, signals, queries, qualityCriteria, minArticles

#### Scenario: prompt 以模版为参考
- **WHEN** 构造 Planning Agent prompt
- **THEN** SHALL 将维度模版标注为"参考"而非"必须保留"
- **AND** SHALL 提示核心维度（如 history, geography）通常应保留
