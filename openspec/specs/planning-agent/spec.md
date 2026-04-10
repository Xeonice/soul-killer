# planning-agent Specification

## Purpose
TBD - created by archiving change dynamic-dimensions. Update Purpose after archive.
## Requirements
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

### Requirement: Planning Agent 生成 qualityCriteria
Planning Agent 的输出 SHALL 为每个维度（含 base 和 extension）包含 qualityCriteria 和 minArticles。当 type 为 'world' 时，每个维度的 qualityCriteria SHALL 包含一条 meta 信息排斥条目，确保 quality scoring 阶段能够降低 meta 内容的评分。

#### Scenario: prompt 包含质量标准生成要求
- **WHEN** 构造 planning prompt
- **THEN** SHALL 要求每个维度生成 2-4 条文章质量标准
- **AND** SHALL 要求指定 minArticles（required 维度 3-5，supplementary 维度 2-3）

#### Scenario: world 类型的 qualityCriteria 包含 meta 排斥
- **WHEN** type 为 'world' 且构造 planning prompt
- **THEN** SHALL 在 qualityCriteria 指导中要求包含一条关于排除作品制作/发行/改编信息的条目

#### Scenario: 输出 JSON 包含新字段
- **WHEN** 解析 Planning Agent 输出
- **THEN** extensions 的每个维度 SHALL 包含 qualityCriteria 数组和 minArticles 数字
- **AND** adjustments SHALL 可选覆盖 base 维度的 qualityCriteria 和 minArticles

