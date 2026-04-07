## ADDED Requirements

### Requirement: per-dimension merge-then-expand 提取
WorldDistiller 的 extractEntries SHALL 按维度合并 chunks 后生成 entry，而非按 cluster 逐个生成。

#### Scenario: 同维度 chunks 合并
- **WHEN** extractEntries 处理 classified chunks
- **THEN** SHALL 按 dimension 分组，将同维度所有 chunks 合并为一个输入文本
- **AND** 每个维度 SHALL 生成 2-5 个 entry

#### Scenario: entry 深度要求
- **WHEN** extract prompt 指导 LLM 生成 entry
- **THEN** prompt SHALL 要求每个 entry 包含 5-10 句话
- **AND** SHALL 要求解释因果关系、机制和影响
- **AND** SHALL 禁止输出单句 entry

#### Scenario: 合并后输入长度
- **WHEN** 将同维度 chunks 合并为输入文本
- **THEN** 输入文本 SHALL 截断到 8000 字符（从当前 4000 提升）

#### Scenario: extract prompt 返回 JSON 数组
- **WHEN** LLM 根据 extract prompt 生成 entry
- **THEN** SHALL 返回 JSON 数组格式，每个元素包含 name、display_name、keywords、mode、priority、content
- **AND** 解析失败时 SHALL fallback 为将整个维度文本作为单个 entry

### Requirement: review 阶段合并重复 entry
WorldDistiller SHALL 在 extractEntries 后执行 reviewEntries 阶段，识别并合并重复 entry。

#### Scenario: 识别重复 entry
- **WHEN** reviewEntries 将所有 entry 发送给 LLM
- **THEN** LLM SHALL 返回需要合并的 entry 对和需要删除的浅层 entry

#### Scenario: 合并执行
- **WHEN** review 返回合并指令
- **THEN** SHALL 将被合并的 entry 对合并为一个 entry
- **AND** 保留内容更丰富的一方的 meta 信息

#### Scenario: 删除浅层 entry
- **WHEN** review 返回删除指令
- **THEN** SHALL 移除内容少于 2 句的浅层 entry

#### Scenario: review 阶段 progress 事件
- **WHEN** review 阶段执行
- **THEN** SHALL 发出 phase='review' 的 progress 事件
